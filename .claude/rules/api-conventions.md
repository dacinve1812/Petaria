# API Conventions

## Base patterns

- Backend routes are primarily under `/api/*`.
- Authenticated routes require Bearer JWT.
- Frontend uses `process.env.REACT_APP_API_BASE_URL` as base URL.

## Request/response expectations

- Keep response shape stable for existing clients.
- For user identity fields, include display-name compatible keys where applicable.
- Return meaningful HTTP status codes:
  - `200` success read/update
  - `201` created
  - `400` validation error
  - `401` auth failure
  - `403` permission denied
  - `404` not found
  - `500` internal error

## Error handling

- Prefer explicit message payloads (`{ message: "..." }`).
- Avoid leaking stack traces to client responses.
- Log enough context on server side for debugging.

## Realtime integration

- If data exists in both REST + socket flow, keep payload keys aligned.
- Presence/chat changes must be coordinated with:
  - `src/components/BuddiesPage.js`
  - `src/components/GlobalChatBox.js`
  - `src/realtime/socketClient.js`

