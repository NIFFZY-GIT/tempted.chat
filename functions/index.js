const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

const recaptchaSecret = defineSecret("RECAPTCHA_SECRET");

admin.initializeApp();

const ROOM_STALE_MS = 30 * 60 * 1000;
const ENDED_ROOM_GRACE_MS = 10 * 60 * 1000;
const MAX_ROOMS_PER_RUN = 200;

const toMillis = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "object" && typeof value.toMillis === "function") {
    try {
      const millis = value.toMillis();
      return Number.isFinite(millis) ? millis : null;
    } catch {
      return null;
    }
  }

  return null;
};

const latestPresenceMillis = (presenceBy) => {
  if (!presenceBy || typeof presenceBy !== "object") {
    return null;
  }

  const values = Object.values(presenceBy)
    .map((entry) => (typeof entry === "number" ? entry : null))
    .filter((entry) => typeof entry === "number");

  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
};

const deleteWaitingUsersForRoom = async (db, roomId) => {
  const waitingSnapshot = await db
    .collection("waitingUsers")
    .where("roomId", "==", roomId)
    .limit(500)
    .get();

  if (waitingSnapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  waitingSnapshot.docs.forEach((docSnapshot) => {
    batch.delete(docSnapshot.ref);
  });
  await batch.commit();

  return waitingSnapshot.size;
};

const deleteRoomStorageObjects = async (roomId) => {
  try {
    const bucket = admin.storage().bucket();
    await bucket.deleteFiles({
      prefix: `chatUploads/${roomId}/`,
      force: true,
    });
  } catch (error) {
    logger.warn("Storage cleanup skipped for room", {
      roomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const deleteRoomAndArtifacts = async (db, roomRef) => {
  const roomId = roomRef.id;

  await Promise.all([
    deleteWaitingUsersForRoom(db, roomId),
    deleteRoomStorageObjects(roomId),
  ]);

  await db.recursiveDelete(roomRef);
};

// ──────────────────────────────────────────────────────────────
// Server-side matchmaking (Omegle-style)
// ──────────────────────────────────────────────────────────────

const WAITING_STALE_THRESHOLD_MS = 12_000;
const MAX_GROUP_SIZE = 5;

const ageGroupMatches = (ageGroup, age) => {
  if (ageGroup === "Any age") return true;
  if (ageGroup === "Under 18") return age < 18;
  if (ageGroup === "18-25") return age >= 18 && age <= 25;
  return age >= 25; // "25+"
};

const countryMatches = (country, countryCode) => {
  if (country === "Any") return true;
  return (countryCode || "").toUpperCase() === country;
};

const styleMatches = (a, b) => {
  return a === "Any style" || b === "Any style" || a === b;
};

const profileMatchesFilters = (filters, profile) => {
  const genderOk = filters.gender === "Any" || filters.gender === profile.gender;
  const ageOk = ageGroupMatches(filters.ageGroup, profile.age);
  const countryOk = countryMatches(filters.country, profile.countryCode);
  return genderOk && ageOk && countryOk;
};

const areUsersCompatible = (a, b) => {
  return (
    styleMatches(a.filters.style, b.filters.style) &&
    profileMatchesFilters(a.filters, b.profile) &&
    profileMatchesFilters(b.filters, a.profile)
  );
};

const isValidWaitingUser = (data) => {
  if (!data || typeof data !== "object") return false;
  const { status, mode, profile, filters } = data;
  if (typeof data.uid !== "string") return false;
  if (status !== "searching" && status !== "matched") return false;
  if (mode !== "text" && mode !== "video" && mode !== "group") return false;
  if (!profile || typeof profile !== "object") return false;
  if (!filters || typeof filters !== "object") return false;
  if (
    profile.gender !== "Male" &&
    profile.gender !== "Female" &&
    profile.gender !== "Other"
  ) return false;
  if (typeof profile.age !== "number") return false;
  return true;
};

/**
 * Core matchmaking logic. Called by both the Firestore trigger and the
 * callable retry endpoint. Returns true if a match was made.
 */
const attemptMatch = async (db, uid) => {
  const myDocRef = db.collection("waitingUsers").doc(uid);
  const myDoc = await myDocRef.get();

  if (!myDoc.exists) return false;
  const myData = myDoc.data();
  if (!isValidWaitingUser(myData) || myData.status !== "searching") return false;

  const mode = myData.mode;
  const isGroup = mode === "group";

  const searchSnapshot = await db
    .collection("waitingUsers")
    .where("status", "==", "searching")
    .where("mode", "==", mode)
    .limit(100)
    .get();

  const now = Date.now();
  const staleThreshold = now - WAITING_STALE_THRESHOLD_MS;

  const candidates = searchSnapshot.docs
    .filter((d) => d.id !== uid)
    .map((d) => ({ uid: d.id, data: d.data() }))
    .filter((c) => isValidWaitingUser(c.data))
    .filter((c) => areUsersCompatible(myData, c.data))
    .filter((c) => {
      const ts = toMillis(c.data.lastSeenAt) ?? toMillis(c.data.createdAt);
      return typeof ts === "number" && ts >= staleThreshold;
    });

  if (candidates.length === 0) return false;

  // Shuffle for fairness
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  if (isGroup) {
    const groupSlice = candidates.slice(0, MAX_GROUP_SIZE - 1);

    await db.runTransaction(async (transaction) => {
      const myRef = db.collection("waitingUsers").doc(uid);
      const mySnap = await transaction.get(myRef);
      if (!mySnap.exists || mySnap.data().status !== "searching") {
        throw new Error("No longer searching");
      }

      const verifiedMembers = [];
      for (const c of groupSlice) {
        const ref = db.collection("waitingUsers").doc(c.uid);
        const snap = await transaction.get(ref);
        if (!snap.exists) continue;
        const d = snap.data();
        if (d.status !== "searching" || d.mode !== "group") continue;
        if (!areUsersCompatible(mySnap.data(), d)) continue;
        const activity = toMillis(d.lastSeenAt) ?? toMillis(d.createdAt);
        if (typeof activity === "number" && activity < Date.now() - WAITING_STALE_THRESHOLD_MS) continue;
        verifiedMembers.push({
          uid: c.uid,
          nickname: d.nickname || `User${c.uid.slice(0, 4)}`,
          gender: d.profile.gender,
          age: d.profile.age,
          countryCode: d.profile.countryCode || null,
          interests: Array.isArray(d.profile.interests) ? d.profile.interests : [],
        });
        if (verifiedMembers.length >= MAX_GROUP_SIZE - 1) break;
      }

      if (verifiedMembers.length === 0) {
        throw new Error("No verified group members");
      }

      const roomRef = db.collection("rooms").doc();
      const myTxData = mySnap.data();
      const allUids = [uid, ...verifiedMembers.map((m) => m.uid)];
      const allProfiles = [
        {
          uid,
          gender: myTxData.profile.gender,
          age: myTxData.profile.age,
          countryCode: myTxData.profile.countryCode || null,
          interests: Array.isArray(myTxData.profile.interests) ? myTxData.profile.interests : [],
          nickname: myTxData.nickname || `User${uid.slice(0, 4)}`,
        },
        ...verifiedMembers.map((m) => ({
          uid: m.uid,
          gender: m.gender,
          age: m.age,
          countryCode: m.countryCode,
          interests: Array.isArray(m.interests) ? m.interests : [],
          nickname: m.nickname,
        })),
      ];

      transaction.set(roomRef, {
        status: "active",
        mode: "group",
        participants: allUids,
        participantProfiles: allProfiles,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(myRef, {
        status: "matched",
        roomId: roomRef.id,
        matchedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      for (const m of verifiedMembers) {
        transaction.update(db.collection("waitingUsers").doc(m.uid), {
          status: "matched",
          roomId: roomRef.id,
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      logger.info("matchUsers: group matched", { roomId: roomRef.id, members: allUids.length });
    });

    return true;
  }

  // ── 1-on-1 matching (text / video) ──
  for (const candidate of candidates) {
    try {
      await db.runTransaction(async (transaction) => {
        const myRef = db.collection("waitingUsers").doc(uid);
        const candidateRef = db.collection("waitingUsers").doc(candidate.uid);

        const [mySnap, candidateSnap] = await Promise.all([
          transaction.get(myRef),
          transaction.get(candidateRef),
        ]);

        if (!mySnap.exists || !candidateSnap.exists) {
          throw new Error("Queue entry expired");
        }

        const myTxData = mySnap.data();
        const candidateData = candidateSnap.data();

        if (
          myTxData.status !== "searching" ||
          candidateData.status !== "searching" ||
          myTxData.mode !== mode ||
          candidateData.mode !== mode ||
          !areUsersCompatible(myTxData, candidateData)
        ) {
          throw new Error("Candidate no longer available");
        }

        const candidateActivity =
          toMillis(candidateData.lastSeenAt) ?? toMillis(candidateData.createdAt);
        if (
          typeof candidateActivity === "number" &&
          candidateActivity < Date.now() - WAITING_STALE_THRESHOLD_MS
        ) {
          throw new Error("Candidate stale");
        }

        const roomRef = db.collection("rooms").doc();

        transaction.set(roomRef, {
          status: "active",
          mode,
          participants: [uid, candidate.uid],
          participantProfiles: [
            {
              uid,
              gender: myTxData.profile.gender,
              age: myTxData.profile.age,
              countryCode: myTxData.profile.countryCode || null,
              interests: Array.isArray(myTxData.profile.interests) ? myTxData.profile.interests : [],
            },
            {
              uid: candidate.uid,
              gender: candidateData.profile.gender,
              age: candidateData.profile.age,
              countryCode: candidateData.profile.countryCode || null,
              interests: Array.isArray(candidateData.profile.interests) ? candidateData.profile.interests : [],
            },
          ],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.update(myRef, {
          status: "matched",
          roomId: roomRef.id,
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.update(candidateRef, {
          status: "matched",
          roomId: roomRef.id,
          matchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info("matchUsers: 1-on-1 matched", {
          roomId: roomRef.id,
          userA: uid,
          userB: candidate.uid,
          mode,
        });
      });

      return true; // matched
    } catch (err) {
      logger.warn("matchUsers: transaction failed", {
        uid,
        candidate: candidate.uid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return false; // no match
};

/**
 * Triggered when a user enters the matchmaking queue.
 */
exports.matchUsers = onDocumentCreated(
  {
    document: "waitingUsers/{uid}",
    region: "us-central1",
    memory: "256MiB",
    minInstances: 1,
    timeoutSeconds: 30,
  },
  async (event) => {
    const db = admin.firestore();
    const uid = event.params.uid;
    try {
      const matched = await attemptMatch(db, uid);
      if (!matched) {
        logger.info("matchUsers: no match on create", { uid });
      }
    } catch (err) {
      logger.warn("matchUsers: failed", {
        uid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

/**
 * Fallback trigger for matchmaking retries.
 * This runs when a waiting user document is updated (for example, heartbeat
 * updates to lastSeenAt), so matching can continue even if callable retries
 * fail on the client side.
 */
exports.matchUsersOnUpdate = onDocumentUpdated(
  {
    document: "waitingUsers/{uid}",
    region: "us-central1",
    memory: "256MiB",
    minInstances: 1,
    timeoutSeconds: 30,
  },
  async (event) => {
    const db = admin.firestore();
    const uid = event.params.uid;

    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    if (!afterData || afterData.status !== "searching") {
      return;
    }

    const beforeSeen = toMillis(beforeData?.lastSeenAt) ?? null;
    const afterSeen = toMillis(afterData.lastSeenAt) ?? null;

    // Only retry matching on meaningful queue-heartbeat updates.
    if (beforeSeen === afterSeen) {
      return;
    }

    try {
      const matched = await attemptMatch(db, uid);
      if (!matched) {
        logger.info("matchUsersOnUpdate: no match", { uid });
      }
    } catch (err) {
      logger.warn("matchUsersOnUpdate: failed", {
        uid,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

/**
 * Callable retry endpoint. Clients call this periodically while waiting
 * in case the initial trigger didn't find a match.
 */
exports.retryMatch = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    minInstances: 1,
    timeoutSeconds: 15,
    enforceAppCheck: false,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const db = admin.firestore();
    try {
      const matched = await attemptMatch(db, uid);
      return { matched };
    } catch (err) {
      logger.warn("retryMatch: failed", {
        uid,
        error: err instanceof Error ? err.message : String(err),
      });
      return { matched: false };
    }
  },
);

exports.cleanupOrphanRooms = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: "Etc/UTC",
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const db = admin.firestore();
    const nowMs = Date.now();

    const [endedSnapshot, activeSnapshot] = await Promise.all([
      db.collection("rooms").where("status", "==", "ended").limit(MAX_ROOMS_PER_RUN).get(),
      db.collection("rooms").where("status", "==", "active").limit(MAX_ROOMS_PER_RUN).get(),
    ]);

    const roomsToDelete = new Map();

    endedSnapshot.docs.forEach((roomDoc) => {
      const roomData = roomDoc.data();
      const endedAtMs = toMillis(roomData.endedAt);

      if (endedAtMs && nowMs - endedAtMs >= ENDED_ROOM_GRACE_MS) {
        roomsToDelete.set(roomDoc.id, roomDoc.ref);
      }
    });

    activeSnapshot.docs.forEach((roomDoc) => {
      const roomData = roomDoc.data();
      const createdAtMs = toMillis(roomData.createdAt);
      const latestPresenceMs = latestPresenceMillis(roomData.presenceBy);
      const newestSignalMs = Math.max(createdAtMs ?? 0, latestPresenceMs ?? 0);

      if (newestSignalMs > 0 && nowMs - newestSignalMs >= ROOM_STALE_MS) {
        roomsToDelete.set(roomDoc.id, roomDoc.ref);
      }
    });

    if (roomsToDelete.size === 0) {
      logger.info("cleanupOrphanRooms: no stale rooms found");
      return;
    }

    let deletedCount = 0;

    for (const roomRef of roomsToDelete.values()) {
      try {
        await deleteRoomAndArtifacts(db, roomRef);
        deletedCount += 1;
      } catch (error) {
        logger.error("cleanupOrphanRooms: failed to delete room", {
          roomId: roomRef.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info("cleanupOrphanRooms: completed", {
      scannedEnded: endedSnapshot.size,
      scannedActive: activeSnapshot.size,
      targeted: roomsToDelete.size,
      deleted: deletedCount,
    });
  },
);

exports.verifyRecaptcha = onCall(
  {
    region: "us-central1",
    secrets: [recaptchaSecret],
    enforceAppCheck: false,
  },
  async (request) => {
    const token = request.data?.token;

    if (!token || typeof token !== "string") {
      throw new HttpsError("invalid-argument", "Missing reCAPTCHA token.");
    }

    const secret = recaptchaSecret.value();
    const params = new URLSearchParams({ secret, response: token });

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const body = await res.json();

    if (!body.success) {
      logger.warn("reCAPTCHA verification failed", {
        success: body.success,
        hostname: body.hostname,
        errorCodes: body["error-codes"],
      });
      throw new HttpsError("permission-denied", "reCAPTCHA verification failed.");
    }

    logger.info("reCAPTCHA passed", { hostname: body.hostname });

    return { success: true };
  },
);
