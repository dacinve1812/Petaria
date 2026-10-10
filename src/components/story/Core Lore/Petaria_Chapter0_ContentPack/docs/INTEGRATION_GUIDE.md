# Codex integration & QA guidance

## Read before implementing

1. Inspect real Petaria routes, map location IDs, pet adoption flows, battle/training services, inventory, user data schema, and existing quest features.
2. Map symbolic identifiers in this pack (`ORPHANAGE`, `POST_OFFICE`, `FLOWER_FIELDS`, etc.) to actual route/location keys. Do NOT assume they already exist.
3. Implement **data-driven** scene/quest loading, not hardcoded JSX per story. Do not execute arbitrary code provided by story JSON; action names must be allowlisted.
4. Backend is source of truth for adoption, quest acceptance, battle result and rewards; UI animation may be optimistic only for display, never success claims.
5. Opening scene skippable; starter choice mandatory for truly new accounts. Optional guide scenes are dismissible and resumable; dismiss != completion.
6. Keep non-Pet activities accessible where existing rules permit. After adoption, home / Healia / shop can be completed in any order or dismissed. An Arena win against the existing level-1 NPC and letter acceptance are required before the Chapter 1 transition. Training Camp is mentioned only.
7. Persist quest progress per user, deduplicate grants with stable transaction keys, allow restart/logout/resume; no duplicate starter.
8. For iOS Safari, preserve touch vertical scrolling and horizontal map scroller, bind spotlight to in-map clickable locations, respect reduced motion and safe areas.
9. Asset keys are placeholders; use existing city artwork and real starter pet art. Do not accidentally use placeholder generated imagery in production.

## Critical consistency check

- `CH0_Q01` is an optional acknowledgement; skipping intro should not block adoption.
- `CH0_Q02` grants one pet from the current orphanage list. Any waiting pet is valid. Starter species filter is configured later. Do not create Emberlyn, Bubblin, Springgoo, or any new species.
- Guidance is a highlight on an existing capital hotspot or nav target. The player clicks through. Do not teleport them.
- `CH0_Q06` completes on a server-validated Arena win (`/battle` → `/battle/arena`, existing level-1 NPC). A loss does not complete it. There is no scripted auto-win. `/battle/training` is not this quest.
- `CH0_Q03..05` are optional, may be completed out of order and may not prevent Q06.
- `CH0_Q07` dialogue choice LATER never grants letter or completes quest.
- `CH0_Q08` completion is based on server-validated entry to `FLOWER_FIELDS`, not a client event.
- `CH0_DEPART` is a chapter transition and should run only once for first completion (replay through archive is allowed without reward).
- If starter was already claimed but tutorial interrupted, resume after adoption.
- Existing/legacy accounts with Pet should not be forced into Starter Selection or receive a second pet.

## Acceptance tests

1. New player complete path.
2. Skip opening, continue adoption.
3. Leave starter selection and return.
4. Double-click starter claim / duplicate HTTP POST / refresh mid-request: one pet only.
5. Dismiss optional scenes, proceed to Arena and the mail quest.
6. Visit Healia before My Home and shop out of order.
7. Lose the level-1 Arena fight, retry, then win; the quest finishes exactly once. Rewards come from that Arena win, not from Training Camp.
8. Reject letter (LATER), accept later; no quest item on rejection.
9. Refresh / logout / multi-device in each phase.
10. Old user with 1+ pets bypass starter safely, preserve all accounts.
11. Desktop and mobile Safari scroll, spotlight alignment, no one-finger zoom.
12. Rewatch scenes: no repeated reward or story advance.

## Content status

- Canon spine approved by user.
- Chapter 0 narrative implementation drafted pending game-data alignment.
- Reward amounts and item IDs stay unresolved. The first pet is any current orphanage pet. Arena uses the existing level-1 NPC. My Home, Orphanage, and port spotlight rects are in `transitions.config.json` for both desktop `2396×1760` and mobile `1087×1447`. Letter delivery to Mira belongs to Chapter 1.
