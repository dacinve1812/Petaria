# .claude README (Petaria)

## Muc dich

Thu muc `.claude/` giup bat ky session moi nao cung nhanh chong nho lai:

- project dang lam gi
- architecture tong the
- convention cua team
- workflow thuc thi task
- cac pitfall da biet

## Cau truc

- `CLAUDE.md`: context tong quan, always-remember, quick map
- `rules/`: rule theo concern (style, api, test, security, structure)
- `skills/`: flow lap lai (review, debug, test, deploy, analyze)
- `agents/`: role chuyen biet (backend/frontend/test/security)
- `settings.json`: config dung chung cho team
- `settings.local.json`: override local theo may ca nhan

## Lenh khoi dong session moi (copy/paste)

Dung prompt sau ngay dau session:

```text
Hay nap context du an tu .claude va lam viec theo dung convention team.

Bat buoc doc lan luot:
1) .claude/CLAUDE.md
2) .claude/rules/project-structure.md
3) .claude/rules/code-style.md
4) .claude/rules/api-conventions.md
5) .claude/rules/testing.md
6) .claude/rules/security.md
7) .claude/settings.json

Sau khi doc xong:
- Tom tat lai bang checklist "da nho" (architecture, workflow, naming, api, test, security)
- Neu task lien quan review/debug/test/deploy/module analysis thi tu dong ap dung skill tuong ung trong .claude/skills
- Neu task la review, uu tien tim bug/regression/security truoc, roi moi toi summary
- Truoc khi code, neu co yeu cau mo ho, hoi toi da 1-3 cau hoi lam ro
```

## Prompt nhanh theo loai task

### 1) Feature implementation

```text
Doc .claude/CLAUDE.md va rules lien quan, sau do implement task voi thay doi nho nhat an toan nhat, khong pha vo convention hien tai.
```

### 2) Code review

```text
Doc .claude/CLAUDE.md + .claude/skills/review-code.md va review theo muc do nghiem trong (critical -> low), tap trung bug/risk/regression/security.
```

### 3) Debug bug

```text
Doc .claude/CLAUDE.md + .claude/skills/debug-issue.md va debug theo flow: reproduce -> evidence -> root cause -> minimal fix -> regression check.
```

### 4) Trien khai/phat hanh

```text
Doc .claude/CLAUDE.md + .claude/skills/prepare-deploy.md, tao deployment checklist cho backend/frontend/realtime va neu ro risk rollback.
```

## Checklist nhanh truoc khi ket thuc task

- Da dung naming + display-name fallback chua?
- Da kiem tra auth/permission cho API thay doi chua?
- Neu co realtime, payload REST/socket da dong bo chua?
- Da lint/test cac file vua sua chua?
- Da cap nhat docs neu thay doi workflow/architecture chua?

