# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vietnamese-language site for a digitized science magazine (Đặc san KH&PT Đà Nẵng). UI strings, comments and docs are in Vietnamese; keep that convention. See [README.md](README.md) for the API/role overview and [docs/HUONG-DAN-DANG-BAI.md](docs/HUONG-DAN-DANG-BAI.md) for the editor workflow.

## Commands

Full stack (Docker; copy `.env.example` to `.env` first):
```bash
docker compose up -d --build        # web :3000, Swagger :8000/docs, admin :3000/admin
docker compose exec backend python -m pytest -q
```

Backend tests run on SQLite (no Postgres needed) from `backend/`:
```bash
cd backend && pip install -r requirements.txt
python -m pytest -q                         # all
python -m pytest tests/test_api.py -k name  # single test
```

Frontend (`frontend/`): `npm run dev` (port 3000), `npm run typecheck`, `npm run build`. There is no linter and no frontend test suite. Running the frontend outside Docker needs `API_INTERNAL_URL` (default `http://localhost:8000`) pointing at a running backend.

## Architecture

- **frontend/**: Next.js 14 App Router, TypeScript, plain CSS (per-page css such as `admin/admin.css`, `_home/d.css`, plus `globals.css`; no Tailwind). `next.config.mjs` rewrites `/api/*` and `/media/*` to the backend, so the browser is always same-origin and there is no CORS. Server components call the backend directly via `API_INTERNAL_URL` ([src/lib/api.ts](frontend/src/lib/api.ts) `get`/`getOrNull` pick the base URL by `typeof window`). The admin UI (`app/admin`, plus `SectionsEditor`, `SubmissionsManager`, `ResourceManager`, `TocImport`, etc. in `components/`) is client-side and talks to `/api/v1/admin` with a JWT kept in `localStorage`.
- **backend/**: FastAPI + SQLAlchemy 2 (sync) + Pydantic settings (`app/config.py`, env-driven). Routers: `public` (`/api/v1/public`), `admin` and `users` (`/api/v1/admin`), `submissions` (both a public and an admin router).
  - `admin.py` builds most endpoints with a generic `crud(model, prefix, order, ...)` factory driven by SQLAlchemy column metadata (`coerce()` does type conversion and required-field checks; `prepare=` hooks derive fields, e.g. `prepare_issue` auto-generates an issue's `label`/`year` from `number` + `published_at`; `guard=` enforces role rules). New simple resources should use this factory instead of hand-written routes.
  - Roles: `admin` > `editor` > `contributor`, enforced per endpoint with `require_roles(...)` (role sets `ADMIN`/`EDIT`/`STAFF`) and re-read from the DB on every request. Contributors may only edit TOC entries of unpublished issues (`guard_entry`).
  - Domain model: an `Issue` has many `TocEntry` rows (the table of contents). There is no separate "article" table; the public `/articles/{slug}` serves a TOC entry, and full text (`body`, a small markdown subset: `##` headings, `![caption](/media/..)` images) is optional. `toc.py` extracts a TOC from an uploaded PDF (PyMuPDF) via `issues/{id}/toc/preview` and `toc/import`.
  - Uploaded media goes to `MEDIA_DIR` (served publicly at `/media`); submitted manuscripts go to `PRIVATE_DIR` and must never be exposed under `/media`.
  - Search uses Postgres `unaccent`; chatbot is keyword lookup only (no LLM).
- **Schema management**: no Alembic. `init_db()` in [backend/app/main.py](backend/app/main.py) runs at startup: ensures the `unaccent` extension, does ad-hoc `ALTER TABLE ... IF NOT EXISTS` migrations, then `create_all`. Schema changes to existing columns must be added there by hand. It also creates the bootstrap admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` and seeds demo data (`app/seed.py`) unless `SEED_DEMO=false`.
- **Tests** ([backend/tests/test_api.py](backend/tests/test_api.py)) set env vars to a temp SQLite DB *before* importing `app`, and register a fake `unaccent` SQLite function. Keep that import order; Postgres-only SQL in code paths under test must have a SQLite-compatible fallback or the tests will break.
