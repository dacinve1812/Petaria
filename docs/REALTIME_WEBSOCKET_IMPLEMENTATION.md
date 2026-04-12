# Realtime WebSocket Implementation

This document describes the realtime stack implemented for presence, chat, and global events.

## Goals

- Realtime `online / away / offline` status for buddies.
- Global chat via WebSocket.
- Global event broadcasting (`legend:caught`).
- Anti-spam chat cooldown (configurable 30s/60s or any value).

## Architecture

- Backend: `Express + Socket.IO` on the same HTTP server.
- Database: MySQL (persistent user/profile/chat data).
- Presence: `users.online_status` + `user_presence.last_seen_at`.
- Frontend: singleton Socket.IO client shared by pages/components.

## New/Updated Backend Pieces

- `backend/server.js`
  - `httpServer` + `SocketIOServer` initialization.
  - Socket auth via JWT in handshake (`auth.token`).
  - Presence update on connect/disconnect + heartbeat.
  - Chat send handling + cooldown check.
  - Global event emit for legend catch.
  - New tables ensured at startup:
    - `global_chat_messages`
    - existing buddies tables and presence table are reused.

## Presence Model

- `online`: user has active socket connection (`online_status = 1`).
- `away`: disconnected recently (`online_status = 0`, last seen within 30 minutes).
- `offline`: disconnected for longer.

### Heartbeat

- Client emits `presence:heartbeat` every 25 seconds.
- Backend throttles DB touch writes to reduce load (`PRESENCE_TOUCH_THROTTLE_MS`).

## Chat Model

- Global channel only (`room: global`) in current implementation.
- Chat persisted to `global_chat_messages`.
- Clients receive:
  - `chat:config` (cooldown seconds)
  - `chat:message`
  - `chat:error`

### Cooldown / Rate Limit

- Config via env:
  - `CHAT_COOLDOWN_SECONDS=30` (or `60`)
- Each user can send one message per cooldown window.
- On violation server emits:
  - `chat:error` with `CHAT_COOLDOWN` + `retryAfterSeconds`.

## Legend Broadcast

- REST trigger:
  - `POST /api/realtime/legend-caught`
- Backend emits socket event:
  - `legend:caught` to room `global`.

This endpoint is suitable for hooking into gameplay logic when a rare capture is confirmed.

## Frontend Realtime Integration

- `src/realtime/socketClient.js`
  - singleton socket client.
- `src/UserContext.js`
  - initializes socket after login/auth.
  - sends periodic heartbeat.
  - disconnects socket on logout.
- `src/components/BuddiesPage.js`
  - listens to `presence:update`.
  - updates friend/recommend/search status in realtime.
- `src/components/GlobalChatBox.js`
  - loads recent chat (`GET /api/chat/global`).
  - subscribes to realtime chat + legend events.
  - enforces cooldown UX countdown.

## API Reference (current)

- `GET /api/chat/global?limit=50&beforeId=<id>`
- `POST /api/realtime/legend-caught`
- Existing buddies APIs:
  - `GET /api/buddies`
  - `GET /api/buddies/search`
  - `POST /api/buddies/requests`
  - `POST /api/buddies/requests/:requestId/accept`
  - `POST /api/buddies/requests/:requestId/reject`
  - `POST /api/buddies/requests/:requestId/cancel`
  - `DELETE /api/buddies/:friendId`

## Deployment Notes

- Works on localhost and production.
- For multi-instance scaling, add Redis pub/sub adapter for Socket.IO.
- Keep cooldown and heartbeat values configurable by env.

## Suggested Env

```env
CHAT_COOLDOWN_SECONDS=30
REDIS_URL=redis://localhost:6379
```

To switch to 60 seconds cooldown:

```env
CHAT_COOLDOWN_SECONDS=60
```

