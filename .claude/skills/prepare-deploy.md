# Skill: Prepare Deploy

## Goal

Prepare a safe deployment checklist for backend + frontend + realtime.

## Flow

1. Confirm environment variables are set:
   - DB credentials
   - JWT secret
   - frontend API base URL
   - Redis URL (if required)
2. Validate database/schema compatibility for new code.
3. Run lint/build checks.
4. Verify critical user flows in staging.
5. Confirm socket and REST compatibility after deploy.
6. Prepare rollback note for risky migrations.

## Petaria release checks

- Login/logout + token refresh
- Profile edit + display name rendering
- Buddies page actions
- Global chat send/cooldown/history
- Hunting map entry/exit and modal interactions

