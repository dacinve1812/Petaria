# Testing Rules

## Minimal validation after changes

- Frontend changes:
  - run eslint on touched files
  - verify affected screen manually in browser
- Backend changes:
  - syntax/runtime check for modified code paths
  - test changed endpoints with auth/non-auth scenarios
- Realtime changes:
  - test at least 2 clients connected simultaneously

## Regression checks

- Preserve existing workflow for login/session/profile.
- Verify modal flows when touching confirmations or dangerous actions.
- Verify mobile layout for any major UI changes.

## What to include in task output

- Files changed
- Behavior changed
- How it was tested
- Known gaps (if any)

