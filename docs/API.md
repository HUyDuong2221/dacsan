# REST API specification

Base URL development: `http://localhost:8000/api/v1`. Interactive Swagger: `/docs`.

## Public

- `GET /home`: latest_issue, recent_issues, featured_articles.
- `GET /issues?page=1&limit=12&year=2026`: danh sách có pagination.
- `GET /issues/{slug}`: issue + sections + articles + editorial/imprint.
- `GET /articles/{slug}`: bài và nội dung HTML **chỉ khi đã hiệu đính**.
- `GET /search?q=...&page=1&limit=20`: tìm nội dung đã publish.
- `GET /media/{key}`: file PDF hoặc ảnh bìa.

## Authentication

- `POST /auth/login`: body `{ "email": "...", "password": "..." }`.
- `GET /auth/me`
- `POST /auth/logout` (cần cookie và CSRF header).

Cookie: `dacsan_access` (HttpOnly), `dacsan_csrf` (script-readable). Request cập nhật cần gửi `X-CSRF-Token` khớp CSRF cookie. Môi trường HTTPS cần `COOKIE_SECURE=true`.

## Admin (role editor/admin)

- `GET /admin/dashboard`
- `GET /admin/issues`
- `POST /admin/issues`
- `GET /admin/issues/{id}`
- `PATCH /admin/issues/{id}`
- `POST /admin/issues/{id}/sections`
- `POST /admin/issues/{id}/articles`
- `POST /admin/issues/{id}/pdf`
- `GET /admin/articles/{id}`
- `PATCH /admin/articles/{id}`
- `POST /admin/issues/import-pdf` (multipart form file)
- `GET /admin/import-jobs`
- `GET /admin/import-jobs/{id}`
- `POST /admin/issues/{id}/publish` (role admin)

FastAPI `openapi.json` là nguồn chính xác cho request schema và response.
