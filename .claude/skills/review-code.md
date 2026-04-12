# Skill: Review Code

## Goal

Produce actionable code review feedback focused on bugs, regressions, security, and maintainability.

## Flow

1. Identify changed files and impacted modules.
2. Check behavior impact (not just style).
3. Prioritize findings by severity:
   - Critical
   - High
   - Medium
   - Low
4. For each finding include:
   - file/path
   - issue
   - impact
   - suggested fix
5. Mention missing tests and edge-case gaps.

## Petaria checklist

- Display name fallback preserved?
- JWT/auth checks still valid?
- Realtime payload compatible across socket + REST?
- Mobile UI still usable?
- `GameDialogModal` confirmation used for destructive actions?

