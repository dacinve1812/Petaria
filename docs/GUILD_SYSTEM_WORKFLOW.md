# Guild System Workflow

## Scope

This document describes the guild feature currently implemented in Petaria across frontend, backend API, and UI conventions.

## Frontend pages and routes

- Guild list / dashboard: `src/components/GuildPage.js` (`/guild`)
- Create guild: `src/components/CreateGuildPage.js` (`/guild/create`)
- Guild detail/apply: `src/components/GuildDetailPage.js` (`/guild/:name`)
- Router registration: `src/App.js`

Behavior:

- If user has no guild:
  - show guild search/list UI
  - allow opening applied list
  - allow navigate to guild detail and apply
- If user has a guild:
  - show guild dashboard
  - support edit/search/members modals
  - role-based actions (approve, kick, role update, disband)

## Guild banner + fraction system

Visual assets are selected from predefined lists:

- Banner pattern: `/images/guild/bannerXX.png`
- Fraction pattern: `/images/guild/fractionXX.png`
- Optional fraction: `none` (no overlay)

Implementation:

- Utility: `src/utils/guildBanners.js`
- Banner value persisted in `guilds.banner_url`
- Supported stored formats:
  - Banner only: `/images/guild/banner12.png`
  - Banner + fraction: `/images/guild/banner12.png::/images/guild/fraction01.png`

Rendering:

- Banner base fills full 600x900 ratio area (2:3)
- Fraction overlays on top layer with configured scale and top offset
- Edit preview and guild dashboard share the same parser/presentation helper

## Backend APIs (guild core)

Main location: `backend/server.js`

Key routes:

- `GET /api/guilds`
- `POST /api/guilds`
- `PUT /api/guilds/my`
- `GET /api/guilds/:guildName`
- `POST /api/guilds/:guildName/apply`
- `GET /api/guilds/my/members`
- `GET /api/guilds/my/applications`
- `DELETE /api/guilds/my/applications/:requestId`
- `GET /api/guilds/my/join-requests`
- `POST /api/guilds/my/join-requests/:requestId/approve`
- `POST /api/guilds/my/join-requests/:requestId/reject`
- `POST /api/guilds/my/members/:memberUserId/kick`
- `PUT /api/guilds/my/members/:memberUserId/role`
- `DELETE /api/guilds/my/disband`

Validation notes:

- Banner/fraction input is normalized by backend helper before save
- Guild rename requires peta cost (current logic in update route)

## Role and permission model

Roles:

- `leader`
- `officer`
- `elite`
- `member`

Rules:

- Guild creator is `leader`
- `leader` can update roles (including transfer leader)
- `leader` / `officer` can approve/reject join requests
- Kick and role actions are restricted by role priority and self-protection checks

## Modal/UI interaction conventions

- Use `GameDialogModal` for destructive confirmation (`kick`, `disband`)
- Member and approval flows use dedicated modal lists
- Keep z-index ordering so dialog confirms stay above list modals

## Data consistency expectations

- On join approval, clear other pending requests for that user
- On direct join to free guild, clear applied list
- On reject/cancel, keep request states consistent with guild membership
- On disband, remove or clear related guild references transactionally

## Maintenance checklist

When editing guild feature:

1. Update frontend page + API contract together.
2. Re-run eslint for touched frontend files.
3. Run backend syntax check when editing `server.js`.
4. Update this doc when workflow or payload format changes.
