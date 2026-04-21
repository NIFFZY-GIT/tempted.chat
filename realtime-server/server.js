const http = require("http");
const { WebSocketServer } = require("ws");
const Redis = require("ioredis");
const admin = require("firebase-admin");
const crypto = require("crypto");

const PORT = Number(process.env.REALTIME_PORT || 8787);
const REDIS_URL = process.env.REDIS_URL || "";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "";

if (!admin.apps.length) {
  admin.initializeApp(FIREBASE_PROJECT_ID ? { projectId: FIREBASE_PROJECT_ID } : undefined);
}

const redis = REDIS_URL
  ? new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
    })
  : null;

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === "/status") {
    const status = {
      connectedUids: clientsByUid.size,
      queues: {
        text: inMemoryQueues.text.size,
        video: inMemoryQueues.video.size,
        group: inMemoryQueues.group.size,
      },
      openGroupRooms: Array.from(openGroupRooms.values()).map((room) => ({
        roomId: room.roomId,
        members: room.entries.size,
        uids: Array.from(room.entries.keys()),
        createdAt: room.createdAt,
        lastJoinAt: room.lastJoinAt,
      })),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status, null, 2));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

const clientsByUid = new Map();
const socketState = new WeakMap();
const socketHeartbeatState = new WeakMap();
const inMemoryQueues = {
  text: new Map(),
  video: new Map(),
  group: new Map(),
};
const openGroupRooms = new Map();

const WAITING_TTL_MS = 20000;
const GROUP_ROOM_SIZE = 10;
const GROUP_MIN_SIZE = 2;
const GROUP_ROOM_IDLE_TTL_MS = 10 * 60 * 1000;
const SOCKET_HEARTBEAT_INTERVAL_MS = 15000;

const send = (ws, event, payload) => {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify({ event, payload }));
};

const ageGroupMatches = (ageGroup, age) => {
  if (ageGroup === "Any age") return true;
  if (ageGroup === "Under 18") return age < 18;
  if (ageGroup === "18-25") return age >= 18 && age <= 25;
  return age >= 25;
};

const countryMatches = (country, countryCode) => {
  if (country === "Any") return true;
  return (countryCode || "").toUpperCase() === country;
};

const styleMatches = (a, b) => a === "Any style" || b === "Any style" || a === b;

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

const areUsersCompatibleForMode = (mode, a, b) => {
  if (mode === "group") {
    // Group rooms should remain joinable and social; do not hard-block joins by
    // strict pairwise filters used for 1:1 matching.
    return true;
  }
  return areUsersCompatible(a, b);
};

const now = () => Date.now();

const isUidConnected = (uid) => {
  const sockets = clientsByUid.get(uid);
  return Boolean(sockets && sockets.size > 0);
};

const queueKey = (mode) => `queue:${mode}`;
const queueMemberKey = (uid) => `queue:member:${uid}`;

const normalizeEntry = (uid, payload) => ({
  uid,
  mode: payload.mode,
  filters: payload.filters,
  profile: payload.profile,
  nickname: payload.nickname || `User${uid.slice(0, 4)}`,
  queuedAt: now(),
  lastSeenAt: now(),
});

const enqueueInMemory = (entry) => {
  inMemoryQueues[entry.mode].set(entry.uid, entry);
};

const dequeueInMemory = (uid, modeHint) => {
  if (modeHint) {
    inMemoryQueues[modeHint].delete(uid);
    return;
  }
  ["text", "video", "group"].forEach((mode) => inMemoryQueues[mode].delete(uid));
};

const pruneInMemory = () => {
  const cutoff = now() - WAITING_TTL_MS;
  ["text", "video", "group"].forEach((mode) => {
    for (const [uid, entry] of inMemoryQueues[mode]) {
      if (entry.lastSeenAt < cutoff) {
        inMemoryQueues[mode].delete(uid);
      }
    }
  });
};

const enqueueRedis = async (entry) => {
  if (!redis) return;
  const key = queueKey(entry.mode);
  await redis.multi()
    .hset(queueMemberKey(entry.uid), {
      uid: entry.uid,
      mode: entry.mode,
      payload: JSON.stringify(entry),
      updatedAt: String(entry.lastSeenAt),
    })
    .expire(queueMemberKey(entry.uid), Math.ceil(WAITING_TTL_MS / 1000))
    .zadd(key, entry.lastSeenAt, entry.uid)
    .exec();
};

const dequeueRedis = async (uid, modeHint) => {
  if (!redis) return;
  const member = await redis.hgetall(queueMemberKey(uid));
  const mode = modeHint || member.mode;
  const multi = redis.multi().del(queueMemberKey(uid));
  if (mode) {
    multi.zrem(queueKey(mode), uid);
  }
  await multi.exec();
};

const pickCandidateInMemory = (entry) => {
  pruneInMemory();
  const queue = inMemoryQueues[entry.mode];
  const candidates = [];
  for (const [uid, candidate] of queue) {
    if (uid === entry.uid) continue;
    if (candidate.lastSeenAt < now() - WAITING_TTL_MS) continue;
    if (!areUsersCompatibleForMode(entry.mode, entry, candidate)) continue;
    candidates.push(candidate);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

const pickCandidatesInMemory = (entry, maxCount) => {
  pruneInMemory();
  const queue = inMemoryQueues[entry.mode];
  const candidates = [];
  for (const [uid, candidate] of queue) {
    if (uid === entry.uid) continue;
    if (candidate.lastSeenAt < now() - WAITING_TTL_MS) continue;
    if (!areUsersCompatibleForMode(entry.mode, entry, candidate)) continue;
    candidates.push(candidate);
  }

  if (candidates.length <= maxCount) {
    return candidates;
  }

  // Shuffle before slicing to keep candidate selection fair.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, maxCount);
};

const pickCandidateRedis = async (entry) => {
  if (!redis) return null;
  const key = queueKey(entry.mode);
  const cutoff = now() - WAITING_TTL_MS;
  await redis.zremrangebyscore(key, 0, cutoff);
  const candidateUids = await redis.zrevrangebyscore(key, "+inf", cutoff, "LIMIT", 0, 100);
  for (const uid of candidateUids) {
    if (uid === entry.uid) continue;
    const member = await redis.hgetall(queueMemberKey(uid));
    if (!member.payload) continue;
    const candidate = JSON.parse(member.payload);
    if (!areUsersCompatibleForMode(entry.mode, entry, candidate)) continue;
    return candidate;
  }
  return null;
};

const pickCandidatesRedis = async (entry, maxCount) => {
  if (!redis) return [];
  const key = queueKey(entry.mode);
  const cutoff = now() - WAITING_TTL_MS;
  await redis.zremrangebyscore(key, 0, cutoff);
  const candidateUids = await redis.zrevrangebyscore(key, "+inf", cutoff, "LIMIT", 0, 200);
  const candidates = [];

  for (const uid of candidateUids) {
    if (uid === entry.uid) continue;
    const member = await redis.hgetall(queueMemberKey(uid));
    if (!member.payload) continue;
    const candidate = JSON.parse(member.payload);
    if (!areUsersCompatibleForMode(entry.mode, entry, candidate)) continue;
    candidates.push(candidate);
    if (candidates.length >= maxCount) {
      break;
    }
  }

  return candidates;
};

const detachSocket = async (ws) => {
  socketHeartbeatState.delete(ws);
  const state = socketState.get(ws);
  if (!state?.uid) return;

  const uid = state.uid;
  const clients = clientsByUid.get(uid);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) {
      clientsByUid.delete(uid);

      // When the last socket for a uid disconnects, remove them from any
      // open group rooms so remaining members get an updated roster.
      for (const [roomId, room] of openGroupRooms) {
        if (room.entries.has(uid)) {
          removeFromGroupRoom(uid, roomId);
          break; // A uid can only be in one open room at a time.
        }
      }
    }
  }

  const modeHint = state.queueMode || null;
  dequeueInMemory(uid, modeHint);
  await dequeueRedis(uid, modeHint);
  socketState.set(ws, { ...state, queueMode: null });
};

const createRoomPayload = (a, b) => {
  const roomId = crypto.randomUUID();
  const chooser = Math.random() < 0.5;
  const offererUid = chooser ? a.uid : b.uid;

  const participants = [a.uid, b.uid];
  const profiles = [
    {
      uid: a.uid,
      gender: a.profile.gender,
      age: a.profile.age,
      countryCode: a.profile.countryCode || null,
      interests: a.profile.interests || [],
      nickname: a.nickname,
    },
    {
      uid: b.uid,
      gender: b.profile.gender,
      age: b.profile.age,
      countryCode: b.profile.countryCode || null,
      interests: b.profile.interests || [],
      nickname: b.nickname,
    },
  ];

  return { roomId, offererUid, participants, participantProfiles: profiles };
};

const toParticipantProfile = (entry) => ({
  uid: entry.uid,
  gender: entry.profile.gender,
  age: entry.profile.age,
  countryCode: entry.profile.countryCode || null,
  interests: entry.profile.interests || [],
  nickname: entry.nickname,
});

const createGroupRoom = (entries) => {
  const roomId = crypto.randomUUID();
  return {
    roomId,
    entries: new Map(entries.map((entry) => [entry.uid, entry])),
    createdAt: now(),
    lastJoinAt: now(),
  };
};

const getGroupRoomSnapshot = (room) => {
  const entries = Array.from(room.entries.values());
  return {
    roomId: room.roomId,
    participants: entries.map((entry) => entry.uid),
    participantProfiles: entries.map(toParticipantProfile),
  };
};

const pruneOpenGroupRooms = () => {
  const staleCutoff = now() - GROUP_ROOM_IDLE_TTL_MS;

  for (const [roomId, room] of openGroupRooms) {
    for (const uid of room.entries.keys()) {
      if (!isUidConnected(uid)) {
        room.entries.delete(uid);
      }
    }

    if (room.entries.size === 0 || room.lastJoinAt < staleCutoff) {
      openGroupRooms.delete(roomId);
      continue;
    }

    if (room.entries.size >= GROUP_ROOM_SIZE) {
      openGroupRooms.delete(roomId);
    }
  }
};

const sendGroupMatchFound = (entry, roomSnapshot) => {
  const peerUid = roomSnapshot.participants.find((uid) => uid !== entry.uid) || entry.uid;
  broadcastToUid(entry.uid, "match_found", {
    roomId: roomSnapshot.roomId,
    mode: "group",
    peerUid,
    isOfferer: false,
    participants: roomSnapshot.participants,
    participantProfiles: roomSnapshot.participantProfiles,
  });
};

const tryJoinOpenGroupRoom = async (entry) => {
  pruneOpenGroupRooms();

  for (const room of openGroupRooms.values()) {
    if (room.entries.has(entry.uid)) continue;
    if (room.entries.size >= GROUP_ROOM_SIZE) continue;

    const existingEntries = Array.from(room.entries.values());
    const compatible = existingEntries.every((existing) => areUsersCompatibleForMode("group", existing, entry));
    if (!compatible) continue;

    room.entries.set(entry.uid, entry);
    room.lastJoinAt = now();

    dequeueInMemory(entry.uid, entry.mode);
    await dequeueRedis(entry.uid, entry.mode);

    const snapshot = getGroupRoomSnapshot(room);
    console.log(`[group] ${entry.uid} joined open room ${room.roomId} (now ${snapshot.participants.length} members)`);
    snapshot.participants.forEach((participantUid) => {
      const participantEntry = room.entries.get(participantUid);
      if (participantEntry) {
        sendGroupMatchFound(participantEntry, snapshot);
      }
    });

    if (room.entries.size >= GROUP_ROOM_SIZE) {
      openGroupRooms.delete(room.roomId);
    }

    return true;
  }

  return false;
};

const removeFromGroupRoom = (uid, roomId) => {
  const room = openGroupRooms.get(roomId);
  if (!room) return;

  const existed = room.entries.has(uid);
  room.entries.delete(uid);

  if (room.entries.size === 0) {
    openGroupRooms.delete(roomId);
    console.log(`[group] room ${roomId} deleted (empty after ${uid} left)`);
    return;
  }

  if (existed) {
    const snapshot = getGroupRoomSnapshot(room);
    console.log(`[group] ${uid} left room ${roomId} (now ${snapshot.participants.length} members)`);
    // Notify remaining members about the updated roster
    snapshot.participants.forEach((participantUid) => {
      broadcastToUid(participantUid, "group_member_left", {
        roomId: room.roomId,
        leftUid: uid,
        participants: snapshot.participants,
        participantProfiles: snapshot.participantProfiles,
      });
    });
  }
};

const broadcastToUid = (uid, event, payload) => {
  const sockets = clientsByUid.get(uid);
  if (!sockets || sockets.size === 0) return;
  sockets.forEach((ws) => send(ws, event, payload));
};

const attemptMatch = async (entry) => {
  if (entry.mode === "group") {
    const joinedExistingRoom = await tryJoinOpenGroupRoom(entry);
    if (joinedExistingRoom) {
      return true;
    }

    const rawCandidates = redis
      ? await pickCandidatesRedis(entry, GROUP_ROOM_SIZE - 1)
      : pickCandidatesInMemory(entry, GROUP_ROOM_SIZE - 1);

    const selected = [entry];
    rawCandidates.forEach((candidate) => {
      if (selected.length >= GROUP_ROOM_SIZE) {
        return;
      }

      const unique = selected.every((existing) => existing.uid !== candidate.uid);
      if (!unique) {
        return;
      }

      const compatibleWithGroup = selected.every((existing) => areUsersCompatibleForMode("group", existing, candidate));
      if (!compatibleWithGroup) {
        return;
      }

      selected.push(candidate);
    });

    if (selected.length < GROUP_MIN_SIZE) {
      return false;
    }

    // Create the room and register it in openGroupRooms BEFORE the async
    // dequeue step.  This eliminates a race where a new arrival's
    // tryJoinOpenGroupRoom runs during the dequeueRedis await and can't
    // find the room yet.
    const room = createGroupRoom(selected);
    if (room.entries.size < GROUP_ROOM_SIZE) {
      openGroupRooms.set(room.roomId, room);
    }

    // Now dequeue (sync in-memory is instant, Redis is async but the
    // room is already visible to concurrent joiners).
    await Promise.all(selected.map(async (participant) => {
      dequeueInMemory(participant.uid, participant.mode);
      await dequeueRedis(participant.uid, participant.mode);
    }));

    const snapshot = getGroupRoomSnapshot(room);
    console.log(`[group] new room ${room.roomId} created with ${selected.length} members: ${selected.map((s) => s.uid).join(", ")}`);

    selected.forEach((participant) => {
      sendGroupMatchFound(participant, snapshot);
    });

    return true;
  }

  const candidate = (await pickCandidateRedis(entry)) || pickCandidateInMemory(entry);
  if (!candidate) return false;

  dequeueInMemory(entry.uid, entry.mode);
  dequeueInMemory(candidate.uid, candidate.mode);
  await Promise.all([
    dequeueRedis(entry.uid, entry.mode),
    dequeueRedis(candidate.uid, candidate.mode),
  ]);

  const room = createRoomPayload(entry, candidate);

  const payloadForA = {
    roomId: room.roomId,
    mode: entry.mode,
    peerUid: candidate.uid,
    isOfferer: room.offererUid === entry.uid,
    participants: room.participants,
    participantProfiles: room.participantProfiles,
  };

  const payloadForB = {
    roomId: room.roomId,
    mode: candidate.mode,
    peerUid: entry.uid,
    isOfferer: room.offererUid === candidate.uid,
    participants: room.participants,
    participantProfiles: room.participantProfiles,
  };

  broadcastToUid(entry.uid, "match_found", payloadForA);
  broadcastToUid(candidate.uid, "match_found", payloadForB);
  return true;
};

const heartbeatQueue = async (uid, mode) => {
  if (!mode) return;
  const queue = inMemoryQueues[mode];
  const current = queue.get(uid);
  if (current) {
    current.lastSeenAt = now();
    queue.set(uid, current);
    if (redis) {
      await enqueueRedis(current);
    }
    // Re-attempt matching on each heartbeat so queued users can
    // discover open group rooms (or new queue arrivals) that appeared
    // after their initial attemptMatch call.
    await attemptMatch(current);
  }
};

const verifyToken = async (token) => {
  const decoded = await admin.auth().verifyIdToken(token, true);
  return decoded.uid;
};

const parseMessage = (raw) => {
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
};

wss.on("connection", (ws) => {
  socketState.set(ws, { uid: null, queueMode: null, roomId: null });
  socketHeartbeatState.set(ws, { isAlive: true });
  send(ws, "hello", { ts: now() });

  ws.on("pong", () => {
    const heartbeat = socketHeartbeatState.get(ws);
    if (heartbeat) {
      heartbeat.isAlive = true;
    }
  });

  ws.on("message", async (raw) => {
    const heartbeat = socketHeartbeatState.get(ws);
    if (heartbeat) {
      heartbeat.isAlive = true;
    }

    const msg = parseMessage(raw);
    if (!msg || typeof msg !== "object") {
      send(ws, "error", { code: "bad-payload" });
      return;
    }

    const { event, payload } = msg;
    const state = socketState.get(ws) || { uid: null, queueMode: null, roomId: null };

    if (event === "auth") {
      const token = payload?.token;
      if (!token || typeof token !== "string") {
        send(ws, "error", { code: "missing-token" });
        return;
      }

      try {
        const uid = await verifyToken(token);
        const nextState = { ...state, uid };
        socketState.set(ws, nextState);

        const existing = clientsByUid.get(uid) || new Set();
        existing.add(ws);
        clientsByUid.set(uid, existing);
        send(ws, "auth_ok", { uid });
      } catch {
        send(ws, "error", { code: "auth-failed" });
      }
      return;
    }

    if (!state.uid) {
      send(ws, "error", { code: "unauthenticated" });
      return;
    }

    if (event === "queue_join") {
      const mode = payload?.mode;
      if (mode !== "text" && mode !== "video" && mode !== "group") {
        send(ws, "error", { code: "invalid-mode" });
        return;
      }

      if (!payload?.filters || !payload?.profile) {
        send(ws, "error", { code: "invalid-filters" });
        return;
      }

      const entry = normalizeEntry(state.uid, payload);
      dequeueInMemory(state.uid, state.queueMode || null);
      await dequeueRedis(state.uid, state.queueMode || null);

      enqueueInMemory(entry);
      await enqueueRedis(entry);

      const nextState = { ...state, queueMode: mode };
      socketState.set(ws, nextState);
      send(ws, "queue_joined", { mode });

      if (mode === "group") {
        console.log(`[group] ${state.uid} joined queue (group queue size: ${inMemoryQueues.group.size}, open rooms: ${openGroupRooms.size})`);
      }

      try {
        const matched = await attemptMatch(entry);
        if (!matched) {
          send(ws, "queue_waiting", { mode });
        }
      } catch (err) {
        console.error(`[matchmaking] attemptMatch error for ${state.uid}:`, err);
        send(ws, "queue_waiting", { mode });
      }
      return;
    }

    if (event === "queue_ping") {
      await heartbeatQueue(state.uid, state.queueMode);
      return;
    }

    if (event === "queue_leave") {
      dequeueInMemory(state.uid, state.queueMode || null);
      await dequeueRedis(state.uid, state.queueMode || null);
      socketState.set(ws, { ...state, queueMode: null });
      send(ws, "queue_left", { ok: true });
      return;
    }

    if (event === "peer_left") {
      const roomId = payload?.roomId;
      const toUid = payload?.toUid;
      if (!roomId || !toUid) {
        send(ws, "error", { code: "invalid-peer-left" });
        return;
      }
      broadcastToUid(toUid, "peer_left", { roomId, fromUid: state.uid });
      return;
    }

    if (event === "signal") {
      const roomId = payload?.roomId;
      const toUid = payload?.toUid;
      const kind = payload?.kind;
      const signalPayload = payload?.payload;

      if (!roomId || !toUid || !kind || !signalPayload) {
        send(ws, "error", { code: "invalid-signal" });
        return;
      }

      if (kind !== "offer" && kind !== "answer" && kind !== "ice") {
        send(ws, "error", { code: "invalid-signal-kind" });
        return;
      }

      broadcastToUid(toUid, "signal", {
        roomId,
        fromUid: state.uid,
        kind,
        payload: signalPayload,
      });
      return;
    }

    if (event === "chat") {
      const roomId = payload?.roomId;
      const toUid = payload?.toUid;
      const data = payload?.data;
      if (!roomId || !toUid || !data) {
        send(ws, "error", { code: "invalid-chat" });
        return;
      }

      broadcastToUid(toUid, "chat", {
        roomId,
        fromUid: state.uid,
        data,
      });
      return;
    }

    if (event === "room_leave") {
      const roomId = payload?.roomId;
      if (!roomId) {
        send(ws, "error", { code: "invalid-room-leave" });
        return;
      }
      removeFromGroupRoom(state.uid, roomId);
      send(ws, "room_left", { roomId });
      return;
    }

    send(ws, "error", { code: "unknown-event" });
  });

  ws.on("close", () => {
    void detachSocket(ws);
  });

  ws.on("error", () => {
    void detachSocket(ws);
  });
});

// Periodic sweep: prune stale entries and re-attempt matching for all
// queued users so they can discover open group rooms or new arrivals.
const sweepQueues = async () => {
  pruneInMemory();
  pruneOpenGroupRooms();

  // Re-attempt matching for every queued user (group mode benefits most).
  for (const mode of ["group", "text", "video"]) {
    const queue = inMemoryQueues[mode];
    for (const [, entry] of queue) {
      try {
        await attemptMatch(entry);
      } catch (err) {
        console.error("[sweep] attemptMatch error", entry.uid, err);
      }
    }
  }
};

setInterval(() => {
  void sweepQueues();
}, 3000);

setInterval(() => {
  wss.clients.forEach((ws) => {
    const heartbeat = socketHeartbeatState.get(ws);
    if (!heartbeat) {
      return;
    }

    if (!heartbeat.isAlive) {
      try {
        ws.terminate();
      } catch {
        // Ignore termination races.
      }
      return;
    }

    heartbeat.isAlive = false;
    try {
      ws.ping();
    } catch {
      try {
        ws.terminate();
      } catch {
        // Ignore termination races.
      }
    }
  });
}, SOCKET_HEARTBEAT_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`[realtime] websocket server listening on :${PORT}`);
  if (REDIS_URL) {
    console.log("[realtime] redis enabled");
  } else {
    console.log("[realtime] redis disabled (in-memory fallback)");
  }
});
