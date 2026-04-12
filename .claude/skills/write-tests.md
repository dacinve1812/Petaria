# Skill: Write Tests

## Goal

Add tests that protect behavior and prevent regressions.

## Flow

1. Identify critical behavior and edge cases.
2. Choose smallest test scope:
   - unit for pure helpers
   - integration for API/service behavior
   - UI behavior test for user flow
3. Write tests around current contract before heavy refactor.
4. Include negative/error-path assertions.
5. Keep fixtures minimal and readable.

## Petaria priority targets

- `getDisplayName` fallback behavior.
- Buddies actions (search/request/accept/remove) response handling.
- Realtime chat cooldown and error paths.
- Profile update validation flows.

