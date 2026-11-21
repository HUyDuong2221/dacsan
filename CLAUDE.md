# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vietnamese-language site for a digitized science magazine (Đặc san KH&PT Đà Nẵng). UI strings, comments and docs are in Vietnamese; keep that convention. See [README.md](README.md) for the API/role overview and [docs/HUONG-DAN-DANG-BAI.md](docs/HUONG-DAN-DANG-BAI.md) for the editor workflow.

## Commands

Full stack (Docker; copy `.env.example` to `.env` first):
```bash
docker compose up -d --build        # web :3000, Swagger :8000/docs, admin :3000/admin
docker compose exec backend python -m pytest -q
```
There are two compose files:
- `docker-compose.yml` is **local dev only**. It bind-mounts `backend/app`, `backend/tests` and `frontend/`, and runs `uvicorn --reload` plus `next dev` (frontend image built only to the `deps` stage). Code edits apply without rebuilding. Backend restarts on file changes, which re-runs `init_db()`.
- `docker-compose.server.yml` is for the dev/staging server. It uses built images (frontend `run` stage = `next build` standalone), mounts no code, and keeps the DB port closed. It requires `POSTGRES_PASSWORD`/`JWT_SECRET`/`ADMIN_*` in `.env` (template: `.env.server.example`). Deploy with `docker compose -f docker-compose.server.yml up -d --build`.

Backend tests run on SQLite (no Postgres needed) from `backend/`:
```bash
cd backend && pip install -r requirements.txt
python -m pytest -q                         # all
python -m pytest tests/test_api.py -k name  # single test
```

Frontend (`frontend/`): `npm run dev` (port 3000), `npm run typecheck`, `npm run build`. There is no linter and no frontend test suite. Running the frontend outside Docker needs `API_INTERNAL_URL` (default `http://localhost:8000`) pointing at a running backend.

The backend cannot simply be started with `uvicorn` against a SQLite `DATABASE_URL`: the startup hook `init_db()` runs Postgres-only SQL (`CREATE EXTENSION unaccent`) and crashes. To run it without Postgres, do what the tests do: register a Python `unaccent` function on the engine, call `Base.metadata.create_all` + `seed()`, and replace the app's lifespan with a no-op.

Settings (`Setting` key/value rows, edited in admin "Cài đặt trang") feed the header/footer: `org_name`, `issn`, `contact`, `license`, `copyright`, `publisher`, `editors`, `logo_url`. `seed()` only inserts keys that are missing, so changing a default in `seed.py` does not update an existing DB.

## Architecture

- **frontend/**: Next.js 14 App Router, TypeScript, plain CSS (per-page css such as `admin/admin.css`, `_home/v7.css`, plus `globals.css`; no Tailwind). `next.config.mjs` rewrites `/api/*` and `/media/*` to the backend, so the browser is always same-origin and there is no CORS. Server components call the backend directly via `API_INTERNAL_URL` ([src/lib/api.ts](frontend/src/lib/api.ts) `get`/`getOrNull` pick the base URL by `typeof window`). The admin UI (`app/admin`, plus `SectionsEditor`, `SubmissionsManager`, `ResourceManager`, `TocImport`, etc. in `components/`) is client-side and talks to `/api/v1/admin` with a JWT kept in `localStorage`.
- **backend/**: FastAPI + SQLAlchemy 2 (sync) + Pydantic settings (`app/config.py`, env-driven). Routers: `public` (`/api/v1/public`), `admin` and `users` (`/api/v1/admin`), `submissions` (both a public and an admin router).
  - `admin.py` builds most endpoints with a generic `crud(model, prefix, order, ...)` factory driven by SQLAlchemy column metadata (`coerce()` does type conversion and required-field checks; `prepare=` hooks derive fields, e.g. `prepare_issue` auto-generates an issue's `label`/`year` from `number` + `published_at`; `guard=` enforces role rules). New simple resources should use this factory instead of hand-written routes.
  - Roles: `admin` > `editor` > `contributor`, enforced per endpoint with `require_roles(...)` (role sets `ADMIN`/`EDIT`/`STAFF`) and re-read from the DB on every request. Contributors may only edit TOC entries of unpublished issues (`guard_entry`).
  - An issue's chuyên mục is its `theme` string, picked in admin from `Field` names. There is no FK; the homepage "Chuyên mục" block matches `Issue.theme == Field.name`. This is separate from `TocEntry.field_id`, the per-article section inside an issue's TOC. `Issue.featured` + `Issue.title` drive the homepage "Tiêu điểm" carousel (10 newest featured; falls back to latest issue + featured TOC entries). `Issue.page_count` is auto-filled from the uploaded PDF (`pdf_page_count`, also backfilled in `init_db`). Use `media_path(url)` in `admin.py` to map a `/media/...` (or full `http(s)://host/media/...`) URL to a file in `MEDIA_DIR`.
  - Domain model: an `Issue` has many `TocEntry` rows (the table of contents). There is no separate "article" table; the public `/articles/{slug}` serves a TOC entry, and full text (`body`, a small markdown subset: `##` headings, `![caption](/media/..)` images) is optional. `toc.py` extracts a TOC from an uploaded PDF (PyMuPDF) via `issues/{id}/toc/preview` and `toc/import`.
  - Uploaded media goes to `MEDIA_DIR` (served publicly at `/media`); submitted manuscripts go to `PRIVATE_DIR` and must never be exposed under `/media`.
  - Search uses Postgres `unaccent`; chatbot is keyword lookup only (no LLM).
- **Schema management**: no Alembic. `init_db()` in [backend/app/main.py](backend/app/main.py) runs at startup: ensures the `unaccent` extension, does ad-hoc `ALTER TABLE ... IF NOT EXISTS` migrations, then `create_all`. Schema changes to existing columns must be added there by hand. It also creates the bootstrap admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` and seeds demo data (`app/seed.py`) unless `SEED_DEMO=false`.
- **Tests** ([backend/tests/test_api.py](backend/tests/test_api.py)) set env vars to a temp SQLite DB *before* importing `app`, and register a fake `unaccent` SQLite function. Keep that import order; Postgres-only SQL in code paths under test must have a SQLite-compatible fallback or the tests will break.
- **Dev tooling dirs**: `.taste-skill/`, `.agents/`, `.claude/skills/`, `shots/` and `frontend/design/` are design-skill/tooling artifacts (gate results, screenshots, layout mockups), not application code; ignore them when changing app behavior.
- **Site chrome**:
  - [layout.tsx](frontend/src/app/layout.tsx) renders the shared header `SiteNav` (utility bar + logo masthead + sticky nav, styles in `components/site-nav.css`, classes `v7h`/`v7-*`) and `Footer` (`components/footer.css`) on every public page.
  - The homepage ([page.tsx](frontend/src/app/page.tsx) → `_home/HomeV7.tsx`) only renders its body sections. Its CSS (`v7.css`) is scoped under `.v7`, and `body:has(.v7)` hides the layout's decorative `.sci-bg`.
  - Admin hides header/footer via `body:has(.adm-root)` rules in `admin.css`.
  - The sticky nav is ~45px tall, so other sticky elements (`.ctx`, `.side`, `.aside-*`, `.idt-side`) are offset in `site-nav.css` or their own CSS.
  - `globals.css` sets `html, body { overflow-x: clip }` on small screens. Keep it `clip`, not `hidden`: `hidden` turns body into a scroll container and silently breaks every `position: sticky` on mobile.
- **Issue UI**:
  - `components/IssueTile.tsx` (+ `issue-tile.css`, grid class `.itile-grid`) is the shared issue card for the homepage "Chuyên mục" block and `/issues`. Use `toTile()` to map an API `issue_card` dict to it.
  - The issue detail page `/issues/[slug]` is `components/IssueBrowser.tsx` (+ `issue-detail.css`, scoped `.idt`). It renders its own full-width hero, so the page does not wrap it in `.wrap`. Chuyên mục navigation scrolls to sections (scrollspy) instead of filtering; `?field=` still deep-links.
  - Homepage responsive behaviour lives in a `@media(max-width:720px)` block at the end of `v7.css`. The archive ("Kho lưu trữ") paging step (10 desktop / 6 mobile) is chosen in JS via `matchMedia`, so keep the CSS breakpoint and the JS one in sync.
- **Admin resource tables**: `ResourceManager` renders each `ResourceDef` from `app/admin/page.tsx`.
  - `FieldDef.list` puts a field in the table, and `listLabel` shortens its column header. `ResourceDef.hideId` drops the ID column.
  - `bool` list fields render as checkboxes that PUT immediately (optimistic, reverted on error).
  - `optionsFrom` loads select options from another admin resource.
- **Frontend rich text**: the admin editor uses CKEditor 5 and `mammoth` (DOCX import) client-side; the stored `body` is still the markdown subset described above, so keep conversions consistent when touching those components.
- **Docker ports**: in both compose files the backend is bound to `127.0.0.1:8000` only (Swagger). Media/private files live in the `media`/`private` named volumes. Moving to another server means copying those volumes as well as the DB, otherwise PDF-dependent features (TOC import, page count) fail. A reverse proxy in front must allow uploads up to `MAX_UPLOAD_MB` (50MB).
