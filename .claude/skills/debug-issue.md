# Skill: Debug Issue

## Goal

Find root cause quickly and fix with minimal blast radius.

## Flow

1. Reproduce issue with exact steps.
2. Collect evidence:
   - console/server logs
   - network request/response
   - state assumptions
3. Locate likely module (frontend, backend, realtime, game loop).
4. Validate root cause with targeted checks.
5. Implement smallest safe fix.
6. Verify original scenario + one regression scenario.

## Petaria-specific hints

- User identity bugs: inspect `UserContext.js` and `getDisplayName`.
- Realtime bugs: inspect both `backend/server.js` socket handlers and `src/realtime/socketClient.js`.
- Hunting/encounter bugs: inspect event bridge in `EncounterModalContainer`.
- Multi-step actions should use confirm modal where expected.

