# Realtime Matchmaking Server

Redis-backed WebSocket server for low-latency matchmaking and WebRTC signaling.

## Features

- Firebase ID token auth (`auth` event)
- Fast queue join/leave/heartbeat (`queue_join`, `queue_leave`, `queue_ping`)
- Instant 1-on-1 matching with compatibility checks
- WebRTC signaling relay (`signal`: offer/answer/ice)
- Optional Redis backing (`REDIS_URL`)
- In-memory fallback when Redis is not configured

## Setup

1. Install dependencies:

```bash
cd realtime-server
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Run server:

```bash
npm run dev
```

The server listens on `REALTIME_PORT` (default `8787`).

## Client configuration

Set this in the Next.js app environment:

```env
NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:8787
```

## Protocol

### Client -> Server

- `auth` `{ token }`
- `queue_join` `{ mode, filters, profile, nickname? }`
- `queue_ping` `{ mode }`
- `queue_leave` `{ mode? }`
- `signal` `{ roomId, toUid, kind: "offer"|"answer"|"ice", payload }`

### Server -> Client

- `hello`
- `auth_ok`
- `queue_joined`
- `queue_waiting`
- `queue_left`
- `match_found` `{ roomId, peerUid, isOfferer, participants, participantProfiles, mode }`
- `signal` `{ roomId, fromUid, kind, payload }`
- `error`
