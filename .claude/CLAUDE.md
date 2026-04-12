# CLAUDE Project Context - Petaria

## 1) Project mission

Petaria is a web game platform with:

- pet collection and progression
- hunting/world map gameplay (Phaser)
- arena/boss battles
- economy systems (bank, shop, auction, mail)
- admin management pages
- social systems (profile, buddies) and realtime foundations (presence/chat/events)

This file is the first entrypoint when a new session starts.

## 2) Core architecture

### Frontend

- Stack: React 19 + React Router 7 + CRA
- Entry: `src/App.js` (data router)
- Layout shell: `src/components/MainLayout.js`
- Global user/auth state: `src/UserContext.js`
- Phaser integration: `src/components/HuntingMap.jsx` + `src/game/**`
- Realtime socket client: `src/realtime/socketClient.js`

### Backend

- Stack: Express + MySQL + JWT
- Main server: `backend/server.js` (monolith, many routes)
- Socket.IO on same HTTP server in `backend/server.js`
- Optional Redis integration for match-state and future scaling
- Auction module split in `backend/routes/auctions.js`

### Static + tooling

- Assets: `public/**`
- Scripts: `scripts/**`
- System docs: `docs/**`

## 3) Non-negotiable conventions

- Use `REACT_APP_API_BASE_URL` for frontend API base (fallback localhost only when necessary).
- Use Bearer token from `UserContext` for authenticated API calls.
- Prefer display name fallback: `display_name/displayName -> username`.
- Keep UI labels and game text consistent with existing Vietnamese phrasing.
- Use `GameDialogModal` for confirm/alert game-style dialogs.
- Keep CSS naming component-scoped (`ComponentName.css`) unless change belongs to `styles/global.css`.

## 4) Team workflow

1. Read related docs in `docs/` before editing subsystem logic.
2. Implement smallest safe change first.
3. Validate:
   - backend syntax check (for `server.js` changes)
   - eslint for touched frontend files
4. Avoid unrelated refactors in same task.
5. Update docs when architecture/workflow changes.

## 5) Always remember

- `backend/server.js` is large and sensitive; search for existing route/event before adding new ones.
- There are two DB access styles:
  - `server.js` env-based pool
  - `backend/config/database.js` for auction router
- Do not assume `db/*.json` are migrations; use scripts/docs for DB changes.
- Realtime/presence/chat payload changes must stay consistent across:
  - socket events
  - REST history endpoints
  - frontend consumers (`BuddiesPage`, `GlobalChatBox`)
- For social/realtime features, preserve backward-compatible response keys when possible.

## 6) Quick map

- Backend API + socket: `backend/server.js`
- Auctions: `backend/routes/auctions.js`
- Frontend routing: `src/App.js`
- Auth/session: `src/UserContext.js`
- Buddies/social: `src/components/BuddiesPage.js`
- Global chat UI: `src/components/GlobalChatBox.js`
- Game modal UI: `src/components/ui/GameDialogModal.js`
- Docs: `docs/*.md`

## 7) Required docs to check by feature

- Realtime/presence/chat: `docs/REALTIME_WEBSOCKET_IMPLEMENTATION.md`
- Game modal/UI patterns: `docs/GLOBAL_GAME_UI.md`, `docs/GLOBAL_ITEM_MODAL_CSS.md`
- Auth: `docs/AUTHENTICATION_SYSTEM_DOCS.md`
- Hunting map admin workflow: `docs/HUNTING_MAP_ADMIN_WORKFLOW.md`
- Encounter: `docs/ENCOUNTER_SYSTEM_DOCS.md`
- DB migration notes: `docs/DB_MIGRATION_GUIDE.md`

