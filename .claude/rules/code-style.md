# Code Style Rules

## JavaScript/React

- Use functional components + hooks.
- Prefer `const`; avoid `var`.
- Keep functions focused; split helpers when logic grows.
- Guard async calls with early returns for missing auth/token.
- Reuse existing utilities before creating new helper functions.

## Naming

- Components: PascalCase (`UserProfile`, `BuddiesPage`).
- Utilities and hooks: camelCase (`getDisplayName`, `useIsMobile`).
- CSS classes: component-prefixed kebab-case.

## UI/CSS

- Prefer component-local CSS file for feature styles.
- Use shared design tokens from `src/styles/variables.css` when available.
- Use responsive rules for desktop/tablet/mobile (avoid desktop-only layout).
- Keep consistent game UI style for modal/button interactions.

## Comments

- Add comments only for non-obvious logic.
- Do not comment trivial assignments.

## Editing boundaries

- Do not refactor unrelated files in the same task.
- Preserve existing language tone (Vietnamese user-facing labels where already used).

