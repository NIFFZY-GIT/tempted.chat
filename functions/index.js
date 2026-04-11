const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

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
