# Petaria classic release — local verification

This change is local only. No push or deployment was performed.

## Database

Run `node scripts/migrate_classic_release.js` before starting this version. It is additive and repeatable. It creates `arena_match_receipts`, `account_security`, and `account_email_tokens`; existing pet/account data is preserved. The migration was applied to the local database during implementation.

## Email delivery

Add these values to the project's existing `.env` using your SMTP provider's credentials, then restart the backend. Do not commit credentials.

```
APP_PUBLIC_URL=http://localhost:3000
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=Petaria <your-verified-sender@example.com>
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
```

For port 465, set `SMTP_SECURE=true`. Use an HTTPS public URL when deploying. The application deliberately does not return reset tokens in API responses or logs. Without SMTP configuration, registration works, but email verification/recovery cannot send mail; recovery returns a clear unavailable response.

New accounts have two independently hashed passwords. Email verification is required before recovery. An email recovery link resets both passwords and invalidates earlier HTTP sessions. The authenticated secondary-password form can change the primary password. Existing accounts continue to log in and can add email/password 2 from Profile → Email và mật khẩu cấp 2. A resend-verification button is available on the account page.

## Battle behavior

Only 1vs1 is exposed. Champion routes redirect to Arena, multi-pet match requests and formation upgrades are rejected. Existing squad code/data is retained for a later release.

The new match page uses static images on white, short logs and server actions. After win/loss it renders only the result, not the arena underneath. A remembered match ID lets a refresh retrieve committed results. Return navigation supports hunting maps.

Legacy EXP/HP/loot/hunger postbattle APIs now return 410 for authenticated clients. The server finalizes these effects. Rewards, pet EXP/HP, hunger, counters and the result receipt are committed in one MySQL transaction. Receipt locking makes repeated finalization idempotent. MySQL advisory locks serialize start/turn/terminate/status requests across server processes, and expected-turn/match IDs reject stale actions. Shield power comes from the owned equipped item in the database.

## Automated checks

```
node --test backend/tests/classicRelease.test.js backend/tests/classicHttp.test.js
npm test -- --watchAll=false --runInBand --runTestsByPath src/components/battle/ClassicBattlePage.test.js
npm run build
```

The backend integration test creates a randomly named disposable MySQL schema beginning `petaria_classic_test_`, exercises concurrency/rollback and account recovery, then drops only that schema. It needs local MySQL create/drop permissions; it does not use real player rows as fixtures.

## Local acceptance checklist

- Existing account login still works; register a new account with two different passwords.
- Verify its email, recover both passwords, then try the link again (must fail). Check expired links too.
- Log in as a normal user; admin endpoints must reject access regardless of submitted `adminUserId`.
- Win a 1vs1, confirm rewards match database changes, refresh the result, and verify rewards are unchanged.
- Lose/flee a match and confirm the result has no winnings and hides the arena.
- Test two tabs and repeated clicks; no duplicate turns or rewards.
- Use a shield, refresh during combat, and test an item that breaks.
- Try the hunt → boss → result → return-to-map path.
- Review desktop and 390px mobile widths. SMTP delivery still needs real provider configuration to test end to end.

The repo already contains other uncommitted changes and lint warnings. This is not a complete audit of every legacy endpoint or every game system.
