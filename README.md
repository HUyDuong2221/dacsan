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

> **Cẩn thận với `docker compose down -v`**: cờ `-v` xóa vĩnh viễn volume, tức toàn bộ DB, ảnh/PDF đã upload và bản thảo gửi về; Docker không khôi phục được. Chỉ dùng trên máy lập trình khi muốn làm lại dữ liệu mẫu (project `dacsan-dev`). **Không bao giờ chạy trên server**; trên server chỉ dùng `docker compose -f docker-compose.server.yml down` (không `-v`).

Lần đầu DB trống sẽ nạp dữ liệu mẫu (số 17 + 8 số cũ, hoạt động). Đặt `SEED_DEMO=false` để tắt.

Trình duyệt chỉ gọi cùng origin: Next chuyển tiếp `/api/*` và `/media/*` sang backend, nên không cần CORS.

## API

- `GET /api/v1/public/...`: `home`, `issues`, `issues/{slug}`, `articles/{slug}` (hai mục này nhận `?preview=<token>` để xem trước số chưa công bố), `search?q=&author=&field=&year=&issue=`, `search/options`, `pages`, `pages/{slug}`, `banners`, `POST track` (lượt xem/đọc/tải, trình duyệt gửi bằng sendBeacon), `POST subscribe` (gửi email xác nhận), `POST subscribe/confirm`, `POST unsubscribe`, `research`, `documents`, `activities`, `fields`, `site`, `POST subscribe`, `POST chat`, `POST submissions` (gửi bài, multipart), `POST submissions/track` (tra cứu bằng email + mã), `reviews/{token}` (phản biện viên: `GET`, `POST respond`, `POST submit`, `GET file`; xác thực bằng token trong link, không cần tài khoản)
- `/api/v1/admin/...` (Bearer JWT): `POST auth/login`, CRUD `issues|toc-entries|fields|activities|posts|settings` (`toc-entries` = mục lục của số; lọc bằng `?issue_id=`), `POST issues/{id}/toc/preview` và `toc/import` (tạo mục lục từ PDF), `GET/DELETE subscribers`, `POST upload`, CRUD `users` (chỉ admin), `POST auth/change-password`, `POST auth/forgot-password`, `POST auth/reset-password`, `POST auth/register` (tự đăng ký, chờ duyệt; ba mục này không cần đăng nhập), `GET outbox`, `GET outbox/config`, `GET outbox/{id}`, `POST outbox/{id}/resend`, `POST outbox/test` (hộp thư đi, chỉ admin), `GET backups`, `POST backups/run`, `POST backups/{name}/download-link`, `GET backups/download?token=` (sao lưu, chỉ admin), CRUD `pages` (trang nội dung tĩnh), CRUD `banners` (chỉ admin), `GET stats` và `GET stats/export` (thống kê, xuất .xlsx; admin và biên tập viên), `POST issues/{id}/preview-link`, `GET audit-logs` và `audit-logs/options` (nhật ký hoạt động, chỉ admin), `submissions` (danh sách, `PUT` ghi chú, `POST {id}/decision` đổi trạng thái kèm ghi chú bắt buộc, `GET {id}/history`, `GET|POST {id}/reviews` phân công phản biện, `POST {id}/reviews/{rid}/remind|link`, `POST {id}/toc-entry` (bài Đã nhận đăng → dòng mục lục của số chưa công bố), `GET {id}/file`, `DELETE`)

## Vai trò

`admin` (toàn quyền, quản lý người dùng) · `editor` (nội dung, công bố, xử lý bài gửi) · `contributor` (chỉ nhập/sửa mục lục của số **chưa công bố**). Quyền được kiểm tra ở backend cho mọi API và đọc lại từ DB mỗi request. Tài khoản đầu tiên là `ADMIN_EMAIL`/`ADMIN_PASSWORD`; các tài khoản khác tạo trong trang quản trị. Bản thảo gửi về lưu ở volume `private` (`PRIVATE_DIR`), không nằm trong `/media`.

## Định dạng toàn văn bài

Ô "Toàn văn" (tùy chọn) của mỗi dòng mục lục trong admin dùng markdown rút gọn: `## Đề mục`, đoạn cách nhau một dòng trống, ảnh `![chú thích](/media/x.jpg)`. Dòng mục lục không có toàn văn sẽ hiện thông báo "chỉ có bản in".

## Test

```bash
docker compose exec backend python -m pytest -q     # chạy trên SQLite
cd frontend && npm install && npm run typecheck && npm run build
```

## Chưa làm / lưu ý

- Migration: bảng mới dùng Alembic (`backend/app/migrations`, revision `0001_baseline` là mốc schema cũ). `init_db()` tự chạy `alembic upgrade head` khi khởi động; xem trạng thái bằng `docker compose exec backend alembic current`. Các bảng cũ vẫn tạo bằng `create_all` + `ALTER` thủ công trong `init_db()`.
- Email: cấu hình `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURITY` (starttls|ssl|none) và `SITE_URL` (địa chỉ website, dùng tạo link trong thư) trong `.env`. Chưa cấu hình thì thư chỉ lưu ở admin › Hộp thư đi. Thư mời/nhắc hạn phản biện và thư cho tác giả chưa nối vào bộ gửi (TODO trong `routers/reviews.py`).
- Giới hạn đăng nhập sai (theo IP và theo tài khoản), gửi bài, chống đếm lặp lượt xem dùng **IP thật của người dùng** lấy từ `X-Forwarded-For`. Trình duyệt đi qua Next.js nên backend chỉ thấy IP container frontend; vì vậy **reverse proxy phía trước phải ghi IP vào `X-Forwarded-For`** (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`; Caddy làm sẵn). Không có reverse proxy thì đặt `FORWARDED_HOPS=0` (mọi người dùng chung một giới hạn).
- **Sao lưu**: service `backup` tạo bản sao lưu hằng ngày (DB + media + bản thảo) vào volume `backups`; **quét mã độc**: service `clamav` quét mọi tệp tải lên. Cấu hình, đưa bản sao lưu ra ngoài máy chủ và **khôi phục**: [docs/SAO-LUU.md](docs/SAO-LUU.md).
- Giới hạn đăng nhập sai lưu trong bộ nhớ (1 instance). Token admin lưu `localStorage`.
- Chatbot là tra cứu theo từ khóa, chưa dùng LLM.
- Chưa có HTTPS/reverse proxy, backup DB, CI.
- Upload kiểm tra đuôi tệp và dung lượng, chưa quét nội dung.
