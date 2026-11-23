# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vietnamese-language site for a digitized science magazine (Đặc san KH&PT Đà Nẵng). UI strings, comments and docs are in Vietnamese; keep that convention. See [README.md](README.md) for the API/role overview and [docs/HUONG-DAN-DANG-BAI.md](docs/HUONG-DAN-DANG-BAI.md) for the editor workflow.

## Commands

Full stack (Docker; copy `.env.example` to `.env` first):
```bash
docker compose up -d --build        # web :3000, Swagger :8000/docs, admin :3000/admin
docker compose exec backend python -m pytest -q
```
Host ports come from `WEB_PORT`/`BACKEND_PORT` in `.env` (defaults 3000/8000). A local `.env` may override them (e.g. 3100/8100), so read `.env` or `docker ps` before assuming a port. Another process on the default port may not be this stack's backend.

Admin API scripting: `POST /api/v1/admin/auth/login` with `{email, password}` returns `{"token": ...}`; send it as `Authorization: Bearer <token>`. Uploads go to `POST /api/v1/admin/upload` (multipart field `file`) and return `{"url": "/media/..."}`.

There are two compose files:
- The two files use different project names (`dacsan-dev` vs `dacsan`) so their named volumes never collide. Never suggest `docker compose down -v` without first confirming which machine it runs on: it permanently deletes the DB, media and private volumes (this already wiped a developer's local data once).
- `docker-compose.yml` is **local dev only**. It bind-mounts `backend/app`, `backend/tests` and `frontend/`, and runs `uvicorn --reload` plus `next dev` (frontend image built only to the `deps` stage). Code edits apply without rebuilding. Backend restarts on file changes, which re-runs `init_db()`.
- `docker-compose.server.yml` is for the dev/staging server. It uses built images (frontend `run` stage = `next build` standalone), mounts no code, and keeps the DB port closed. It requires `POSTGRES_PASSWORD`/`JWT_SECRET`/`ADMIN_*` in `.env` (template: `.env.server.example`). Deploy with `docker compose -f docker-compose.server.yml up -d --build`.

Backend tests run on SQLite (no Postgres needed) from `backend/`:
```bash
cd backend && pip install -r requirements.txt
python -m pytest -q                         # all
python -m pytest tests/test_05_reviews.py -k name  # one file / one test
```

Frontend (`frontend/`): `npm run dev` (port 3000), `npm run typecheck`, `npm run build`. There is no linter and no frontend test suite. Running the frontend outside Docker needs `API_INTERNAL_URL` (default `http://localhost:8000`) pointing at a running backend.

The backend cannot simply be started with `uvicorn` against a SQLite `DATABASE_URL`: the startup hook `init_db()` runs Postgres-only SQL (`CREATE EXTENSION unaccent`) and crashes. To run it without Postgres, do what the tests do: register a Python `unaccent` function on the engine, call `Base.metadata.create_all` + `seed()`, and replace the app's lifespan with a no-op.

Settings (`Setting` key/value rows, edited in admin "Cấu hình site") feed the header/footer: `org_name`, `issn`, `contact`, `license`, `copyright`, `publisher`, `editors`, `logo_url`. `seed()` only inserts keys that are missing, so changing a default in `seed.py` does not update an existing DB.

## Architecture

- **frontend/**: Next.js 14 App Router, TypeScript, plain CSS (per-page css such as `admin/admin.css`, `_home/v7.css`, plus `globals.css`; no Tailwind). `next.config.mjs` rewrites `/api/*` and `/media/*` to the backend, so the browser is always same-origin and there is no CORS. Server components call the backend directly via `API_INTERNAL_URL` ([src/lib/api.ts](frontend/src/lib/api.ts) `get`/`getOrNull` pick the base URL by `typeof window`). The admin UI (`app/admin` + `components/admin/`) is client-side and talks to `/api/v1/admin` with a JWT kept in `localStorage`.
  - `components/` is split by area: `admin/` (admin screens; `resources.ts` holds the admin menu groups, icons, per-role tabs and every `ResourceDef`), `site/` (public chrome and forms: `SiteNav`, `Footer`, `BannerSlider`, `ChatWidget`, `PreviewBar`, `TrackView`, `SubmitForm`, `ReviewForm`, lists), `reader/` (`IssueBrowser`, `ArticleReader`, `PdfReader`, `IssueTile`, `Parts`…), `ui/` (`Portal`). Each component's CSS sits next to it. Cross-cutting helpers live in `lib/` (`api`, `menu`, `banners`, `preview`, `track`).
- **backend/**: FastAPI + SQLAlchemy 2 (sync) + Pydantic settings (`app/config.py`, env-driven). Routers (`app/routers/`): `public` (`/api/v1/public`); admin side (`/api/v1/admin`): `accounts` (all `/auth/*`: login, me, change/forgot/reset password, self-registration), `admin` (content resources built with the CRUD factory + field merge, subscribers, preview link), `media` (uploads, image libraries, `media_path`/`pdf_page_count`), `toc_import` (TOC from PDF), `audit_logs`, `users`, `stats`, `mail`, `backups`; `submissions`, `reviews`, `stats`, `mail` also have public routers. Shared services live in `app/services/` (`audit`, `mailer`, `scanner`, `toc`, `util`).
  - Submission workflow:
    - Status changes go only through `POST submissions/{id}/decision`. It needs a note, and the target must be allowed by `SUBMISSION_TRANSITIONS` in `models.py`. `PUT` rejects status changes.
    - Every change and event (assignment, reminder, review submitted) is written to `submission_history` via `add_history()`.
    - Reviewers are external, with no account. They use `/phan-bien/<token>` → `public/reviews/{token}`. Only the token's sha256 is stored, and the plain token is returned once on assign or relink. The reviewer view must not expose author identity.
    - No email is sent yet; `TODO(email)` in `routers/reviews.py` marks where it should be.
    - An `accepted` submission reaches the public site only through `POST submissions/{id}/toc-entry`. It creates a `TocEntry` in an unpublished issue and links it via `Submission.toc_entry_id`. The FK uses `ON DELETE SET NULL`, so deleting the entry unlinks it. The column was added by Alembic `0003`.
  - `routers/admin.py` builds most endpoints with the generic `crud(model, prefix, order, ...)` factory from `routers/crud.py` driven by SQLAlchemy column metadata (`coerce()` does type conversion and required-field checks; `prepare=` hooks derive fields, e.g. `prepare_issue` auto-generates an issue's `label`/`year` from `number` + `published_at`; `guard=` enforces role rules). New simple resources should use this factory instead of hand-written routes.
  - Roles: `admin` > `editor` > `contributor`, enforced per endpoint with `require_roles(...)` (role sets `ADMIN`/`EDIT`/`STAFF` in `security.py`) and re-read from the DB on every request. Contributors may only edit TOC entries of unpublished issues (`guard_entry`).
  - An issue's chuyên mục is its `theme` string, picked in admin from `Field` names. There is no FK; the homepage "Chuyên mục" block matches `Issue.theme == Field.name`. This is separate from `TocEntry.field_id`, the per-article section inside an issue's TOC. `Issue.featured` + `Issue.title` drive the homepage "Tiêu điểm" carousel (10 newest featured; falls back to latest issue + featured TOC entries). `Issue.page_count` is auto-filled from the uploaded PDF (`pdf_page_count`, also backfilled in `init_db`). Use `media_path(url)` in `routers/media.py` to map a `/media/...` (or full `http(s)://host/media/...`) URL to a file in `MEDIA_DIR`.
  - `Issue.number` is unique and drives ordering. Public `/issues` and "latest issue" sort by `number desc`, not by date, so an issue with a higher number but an older `published_at` would become "Số mới nhất". The `/featured` list and the homepage Tiêu điểm block sort by `published_at`.
  - Domain model: an `Issue` has many `TocEntry` rows (the table of contents). There is no separate "article" table; the public `/articles/{slug}` serves a TOC entry, and full text (`body`, a small markdown subset: `##` headings, `![caption](/media/..)` images) is optional. `services/toc.py` extracts a TOC from an uploaded PDF (PyMuPDF) via `issues/{id}/toc/preview` and `toc/import` (`routers/toc_import.py`).
  - Uploaded media goes to `MEDIA_DIR` (served publicly at `/media`); submitted manuscripts go to `PRIVATE_DIR` and must never be exposed under `/media`.
  - Search uses Postgres `unaccent`; chatbot is keyword lookup only (no LLM).
- **Audit log**: `AuditMiddleware` (`app/services/audit.py`, viewed through `routers/audit_logs.py`) writes an `audit_logs` row for every successful POST/PUT/PATCH/DELETE under `/api/v1/admin` and for every login attempt, including failed ones.
  - The user comes from the JWT. Handlers add a readable summary with `audit.note(request, "...")`; the `crud()` factory already does this.
  - When adding an admin route, add `request: Request` and call `audit.note`. Register new path prefixes and action names in `ENTITY_LABELS` / `ACTION_LABELS`.
  - Read-only POSTs must be listed in `SKIP_SUFFIXES`.
- **Issue preview**: `POST admin/issues/{id}/preview-link` returns `/xem-truoc?token=..&slug=..`. The token is a JWT with `purpose: "preview"`, signed with `JWT_SECRET`; `current_user` rejects it.
  - The Next route `app/xem-truoc/route.ts` stores the token in the `dacsan_preview` cookie. The issue, article and PDF pages pass it on via `previewQS()` (`lib/preview.ts`).
  - The public `issues/{slug}` and `articles/{slug}` then also serve that one unpublished issue and return `preview: true`, which shows `PreviewBar`.
- **Configurable chrome**: these are `Setting` rows.
  - `nav_menu` holds the main menu as JSON (`[{label, href, hidden?}]`). `lib/menu.ts` parses it and falls back to `DEFAULT_MENU`. `SiteNav` renders `visibleMenu()`, which drops hidden items; the menu is edited with `NavMenuEditor`.
  - Homepage banners are rows of the `Banner` model (Alembic `0005`, admin `BannerAdmin`, public `GET /banners`). Each row has a `position` from `BANNER_POSITIONS` (backend `models.py`, which must match frontend `lib/banners.ts`).
  - `HomeV7` renders `zone(pos)` at six places. Banners that share a position become one `BannerSlider`.
  - Size, width mode, fit, slide interval and `hidden` (hides the whole zone) are set per position, not per banner, in the `banner_layout` setting (JSON, parsed and clamped by `parseLayouts`). Individual banners are hidden with `Banner.published`.
  - `ResourceManager` supports `type: 'image'`, which shows a thumbnail and uploads to the `/media/<uploadKind>/` library.
  - Static pages (`Page` model, admin "Trang nội dung") are served at `/trang/<slug>` and listed in the footer.
- **Statistics** (`routers/stats.py`):
  - Counting: the browser calls `track()` in `lib/track.ts`, either through `<TrackView>` on the issue, article and PDF pages or through the PdfReader download button (`stats` prop). It sends a beacon to `POST public/track`, which upserts daily counters in `view_stats` (Alembic `0006`; days in VN time; kinds `view|read|download`; targets `issue|article`). Bots, unpublished issues and preview mode are skipped.
  - Dedup runs per session in the browser and per visitor for 30 minutes in server memory. The visitor IP comes from `client_ip()` in `security.py` (also used by the login/submission limiters and the audit log).
  - `build_report()` feeds both `GET admin/stats` and `GET admin/stats/export` (openpyxl). String cells are forced to text type so that submitted titles cannot become Excel formulas.
- **Real client IP**: the browser reaches the backend through the Next rewrite, so `request.client.host` is the frontend container for everyone, and Next 14 rewrites do not add `X-Forwarded-For`. `client_ip()` trusts `X-Forwarded-For` only when the request comes from a private/loopback address and takes the `FORWARDED_HOPS`-th entry from the right, so it relies on a reverse proxy in front (nginx `$proxy_add_x_forwarded_for`, Caddy) writing the real IP. Without one, set `FORWARDED_HOPS=0`. Failed logins are also limited per account (`account_limiter`).
- **Email** (`app/services/mailer.py`):
  - `queue()` writes an `EmailOutbox` row inside the request transaction. After commit, the handler schedules `mailer.deliver(ids)` with FastAPI `BackgroundTasks`; it sends over SMTP with its own session.
  - If `SMTP_HOST`/`SMTP_FROM` are unset, rows stay `unconfigured`; admins see them under "Hộp thư đi" (`routers/mail.py`).
  - Use `mailer.render()` for bodies: it escapes everything for HTML. `queue()` strips newlines from subjects to block header injection.
  - Links in emails are built with `mailer.site_url()` (`SITE_URL`).
  - Flows:
    - `routers/accounts.py`: forgot and reset password (single-use JWT `purpose: "reset"` bound to a password-hash fingerprint), and self-registration that creates `User.pending=True, is_active=False`. Activating a pending user in `users.py` approves it and emails the user.
    - `routers/mail.py`: double opt-in newsletter (`Subscriber.confirmed`, `Subscriber.token` for confirm and unsubscribe links).
    - New-issue mail is automatic: the `crud()` factory accepts an `after=` hook (runs after a successful create/update, with `BackgroundTasks`). `after_issue` in `routers/admin.py` calls `services/newsletter.py` when an issue is published and `Issue.notified_at` is still null, so each issue mails once. Re-publishing or editing does not resend. Alembic `0008` marked every already-published issue as notified. In admin, `FieldDef.confirmTrue` asks for confirmation before ticking *Công bố* on an issue that has not mailed yet.
  - All of these columns come from Alembic `0007` (`0008` backfills `Issue.notified_at`).
  - Tests replace `smtplib.SMTP` with a fake (`FakeSMTP` in `tests/test_10_email.py`).
- **Backups and malware scanning**: details are in [docs/SAO-LUU.md](docs/SAO-LUU.md).
  - The `backup` compose service (`backup/backup.sh`, postgres:16-alpine) writes `dacsan-*.tar.gz` files to the `backups` volume. Each holds `db.dump` (`pg_dump -Fc`), `media/` and `private/`. It runs nightly, and also when the backend creates `/backups/.request`.
  - `routers/backups.py` lists backups and serves downloads through a 5-minute signed link (JWT `purpose: "backup"`). Downloads are audited with `audit.record()`, because the middleware only logs write methods.
  - `app/services/scanner.py` sends `SCAN <path>` to clamd (`CLAMAV_HOST`). The `clamav` service mounts `media` and `private` read-only at the same paths as the backend; that is how SCAN avoids the INSTREAM 25MB limit.
  - The scan is fail-closed by default (`CLAMAV_FAIL_OPEN=false`): if clamd is down, uploads return 503.
  - Every new upload path must call `scanner.check_file()` after saving the file.
  - In dev compose, clamav sits behind `--profile scan`.
- **Schema management** is hybrid. `init_db()` in [backend/app/main.py](backend/app/main.py) runs at startup in this order:
  1. Ensures the `unaccent` extension.
  2. Runs `create_all` for the legacy tables. Tables whose `__table_args__` carry `info={"alembic": True}` are skipped.
  3. Applies the ad-hoc `ALTER TABLE ... IF NOT EXISTS` upgrades for legacy columns.
  4. Runs `run_migrations()` (`alembic upgrade head`, scripts in `backend/app/migrations`, CLI config `backend/alembic.ini`).

    After that it creates the bootstrap admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` and seeds demo data (`app/seed.py`) unless `SEED_DEMO=false`.

  Tables added since Alembic (`reviews`, `submission_history`, `audit_logs`, `pages`, `banners`, `view_stats`, `email_outbox`) and later column changes live in Alembic revisions `0002`–`0008`; `0001_baseline` is a no-op marker for the pre-Alembic schema. Add new schema changes as Alembic revisions and mark new models with `info=ALEMBIC_INFO`. The tests still `create_all` everything on SQLite; `tests/test_12_migrations.py` checks the migrations against a legacy DB. The old `notices` table (removed feature) may still exist in older databases and is no longer used.
- **Tests** ([backend/tests/](backend/tests/)): `conftest.py` sets env vars to a temp SQLite DB *before* importing `app`, registers a fake `unaccent` SQLite function, and provides session-scoped `client`/`auth` fixtures; shared constants and helpers (`P`, `A`, `_login`, `_form`, `_new_submission`…) are in `helpers.py`. The files are numbered (`test_01_…` to `test_12_…`) because they share one database and some tests (e.g. `test_home`) expect the initial seed state, so keep new tests that change shared data at the end or clean up after themselves. Postgres-only SQL in code paths under test must have a SQLite-compatible fallback or the tests will break.
- **Dev tooling dirs**: `.taste-skill/`, `.agents/`, `.claude/skills/`, `shots/` and `frontend/design/` are design-skill/tooling artifacts (gate results, screenshots, layout mockups), not application code; ignore them when changing app behavior.
- **Site chrome**:
  - [layout.tsx](frontend/src/app/layout.tsx) renders the shared header `SiteNav` (utility bar + logo masthead + sticky nav, styles in `components/site/site-nav.css`, classes `v7h`/`v7-*`) and `Footer` (`components/site/footer.css`) on every public page.
  - The homepage ([page.tsx](frontend/src/app/page.tsx) → `_home/HomeV7.tsx`) only renders its body sections. Its CSS (`v7.css`) is scoped under `.v7`, and `body:has(.v7)` hides the layout's decorative `.sci-bg`.
  - Admin hides header/footer via `body:has(.adm-root)` rules in `admin.css`.
  - The sticky nav is ~45px tall, so other sticky elements (`.ctx`, `.side`, `.aside-*`, `.idt-side`) are offset in `site-nav.css` or their own CSS.
  - `.shell > main` has `z-index: 1`, which creates a stacking context. A `position: fixed` full-screen overlay rendered inside a page can never sit above the header, whatever its z-index. Hide the chrome with a `body:has(...)` rule instead (as `pdf-reader.css` and `admin.css` do) or wrap the overlay in `components/ui/Portal.tsx`, which renders to `document.body` and locks body scroll while mounted (used by the modals/drawers in `ArticleReader`, `IssueToc`, `SubmissionsManager`, `TocImport`).
  - `globals.css` sets `html, body { overflow-x: clip }` on small screens. Keep it `clip`, not `hidden`: `hidden` turns body into a scroll container and silently breaks every `position: sticky` on mobile.
- **Issue UI**:
  - `components/reader/IssueTile.tsx` (+ `issue-tile.css`, grid class `.itile-grid`) is the shared issue card for the homepage "Chuyên mục" block and `/issues`. Use `toTile()` to map an API `issue_card` dict to it.
  - The issue detail page `/issues/[slug]` is `components/reader/IssueBrowser.tsx` (+ `issue-detail.css`, scoped `.idt`). It renders its own full-width hero, so the page does not wrap it in `.wrap`. Chuyên mục navigation scrolls to sections (scrollspy) instead of filtering; `?field=` still deep-links.
  - The `/issues` list page (styles `app/issues/issues.css`, scoped `.iss`) has three parts. The latest-issue card is first. "Trong số này" (`IssueTabs`) shows 4 articles per step. "Các số trước" (`PastIssues`) has year tabs and shows 4 issues per step.
  - Listing pages use a "show N, then Xem thêm adds N" client pattern with a `STEP` constant: `PastIssues`/`IssueTabs` (4), `SpotList` for `/tieu-diem` (10), and `NewsList` for `/tin-hoat-dong` (10). The server page fetches the data and passes the full list to the client component.
  - Homepage responsive behaviour lives in a `@media(max-width:720px)` block at the end of `v7.css`. The archive ("Kho lưu trữ") paging step (10 desktop / 6 mobile) is chosen in JS via `matchMedia`, so keep the CSS breakpoint and the JS one in sync.
- **PDF reading**: every place that shows an issue PDF uses `components/reader/PdfReader.tsx` (+ `pdf-reader.css`, scoped `.pdr`). It is a Google-Drive-style reader drawn with `pdfjs-dist` (pinned 3.11.174, `legacy` build, worker loaded via `new URL(..., import.meta.url)`). It provides lazy page rendering, thumbnails, a "Mục lục" panel, search with highlights, zoom and rotate. Do not reintroduce `<iframe>` PDF embeds.
  - Full-screen mode is the route `/issues/[slug]/pdf?page=N`. Every "Đọc bản PDF" link (homepage, `/issues`, issue detail, article page) points there.
  - `embed` mode renders it inline with a fixed height. `ArticleReader` uses it for articles without full text, opened at the article's page.
  - Page convention: the digits of `TocEntry.page_label` ("tr. 45") are the PDF page index. The "Mục lục" panel is built from the issue's TOC this way. If an issue has no TOC, the panel falls back to the PDF's own bookmarks.
- **Admin resource tables**: `components/admin/ResourceManager.tsx` renders each `ResourceDef` from `components/admin/resources.ts`.
  - `FieldDef.list` puts a field in the table, and `listLabel` shortens its column header. `ResourceDef.hideId` drops the ID column.
  - `bool` list fields render as checkboxes that PUT immediately (optimistic, reverted on error).
  - `optionsFrom` loads select options from another admin resource.
- **Frontend rich text**: the admin editor uses CKEditor 5 and `mammoth` (DOCX import) client-side; the stored `body` is still the markdown subset described above, so keep conversions consistent when touching those components.
- **Docker ports**: in both compose files the backend is bound to `127.0.0.1:8000` only (Swagger). Media/private files live in the `media`/`private` named volumes. Moving to another server means copying those volumes as well as the DB, otherwise PDF-dependent features (TOC import, page count) fail. A reverse proxy in front must allow uploads up to `MAX_UPLOAD_MB` (50MB).
