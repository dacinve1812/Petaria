# Project Structure Rules

## Root overview

- `backend/`: API server, socket events, DB integration
- `src/`: frontend application
- `public/`: static assets
- `scripts/`: one-off migration/generation scripts
- `docs/`: technical and feature documentation
- `db/`: exported JSON snapshots/reference data

## Frontend boundaries

- Keep page-level components in `src/components/*`.
- Keep game runtime logic under `src/game/*`.
- Keep reusable utilities under `src/utils/*`.
- Keep realtime client logic under `src/realtime/*`.
- Keep route registration in `src/App.js`.

## Backend boundaries

- Default API logic in `backend/server.js` (existing pattern).
- If adding complex new domain, prefer extracting to `backend/routes/*` + helpers.
- Keep auth middleware in `backend/middleware/*`.

## Documentation boundaries

- Add or update docs under `docs/` for major workflows.
- Do not create new root-level markdown files (except root `README.md`).

