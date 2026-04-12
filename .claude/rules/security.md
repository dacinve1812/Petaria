# Security Rules

## Secrets and credentials

- Never hardcode secrets in source files.
- Prefer environment variables for DB/JWT/API credentials.
- Avoid committing sensitive local overrides.

## Auth and permissions

- Validate JWT on protected routes.
- Check ownership/authorization before update/delete actions.
- Do not trust client-provided user IDs without server-side verification.

## Input safety

- Validate and sanitize request payloads.
- Use parameterized SQL queries only.
- Restrict upload file types and destination paths.

## Realtime safety

- Require socket authentication for private events.
- Throttle spam-prone events (chat, heartbeat abuse protections).
- Avoid broad CORS in production deployments.

## Error and logging

- Do not return internal stack traces to client.
- Log security-relevant events with minimal sensitive data.

