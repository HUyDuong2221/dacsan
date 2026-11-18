# Đặc san Khoa học & Phát triển Đà Nẵng

Website đọc toàn văn đặc san số hóa. Frontend và backend tách riêng, giao tiếp qua REST API.

| Thành phần | Công nghệ |
|---|---|
| `frontend/` | Next.js 14 (React, TypeScript), SSR |
| `backend/`  | FastAPI, SQLAlchemy 2, Pydantic |
| DB          | PostgreSQL 16 (extension `unaccent` cho tìm kiếm không dấu) |
| Triển khai  | Docker Compose: `db`, `backend`, `frontend` |

## Chạy (Docker trong WSL)

```bash
cp .env.example .env        # sửa JWT_SECRET, ADMIN_PASSWORD
docker compose up -d --build
```

- Website: http://localhost:3000 (đổi bằng `WEB_PORT`)
- Quản trị: http://localhost:3000/admin (tài khoản lấy từ `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- Swagger: http://localhost:8000/docs (đổi bằng `BACKEND_PORT`; bỏ mục `ports` của `backend` khi production)

Lần đầu DB trống sẽ nạp dữ liệu mẫu (số 17 + 8 số cũ, hoạt động, thông báo, tư liệu). Đặt `SEED_DEMO=false` để tắt.

Trình duyệt chỉ gọi cùng origin: Next chuyển tiếp `/api/*` và `/media/*` sang backend, nên không cần CORS.

## API

- `GET /api/v1/public/...`: `home`, `issues`, `issues/{slug}`, `articles/{slug}`, `search?q=&issue=`, `research`, `documents`, `notices`, `activities`, `fields`, `site`, `POST subscribe`, `POST chat`
- `/api/v1/admin/...` (Bearer JWT): `POST auth/login`, CRUD `issues|toc-entries|fields|activities|notices|documents|settings` (`toc-entries` = mục lục của số; lọc bằng `?issue_id=`), `POST issues/{id}/toc/preview` và `toc/import` (tạo mục lục từ PDF), `GET/DELETE subscribers`, `POST upload`

## Định dạng toàn văn bài

Ô "Toàn văn" (tùy chọn) của mỗi dòng mục lục trong admin dùng markdown rút gọn: `## Đề mục`, đoạn cách nhau một dòng trống, ảnh `![chú thích](/media/x.jpg)`. Dòng mục lục không có toàn văn sẽ hiện thông báo "chỉ có bản in".

## Test

```bash
docker compose exec backend python -m pytest -q     # 11 test, chạy trên SQLite
cd frontend && npm install && npm run typecheck && npm run build
```

## Chưa làm / lưu ý

- Schema tạo bằng `create_all` khi khởi động; chưa dùng Alembic. Thêm Alembic trước khi sửa schema trên dữ liệu thật.
- Giới hạn đăng nhập sai lưu trong bộ nhớ (1 instance). Token admin lưu `localStorage`.
- Chatbot là tra cứu theo từ khóa, chưa dùng LLM. Newsletter mới lưu email, chưa gửi thư.
- Chưa có HTTPS/reverse proxy, backup DB, CI.
- Upload kiểm tra đuôi tệp và dung lượng, chưa quét nội dung.
