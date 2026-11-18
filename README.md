# Đặc san Khoa học & Phát triển — Full-stack MVP

Dự án mẫu **chạy được bằng Docker Compose**, gồm Next.js/React/TypeScript (frontend), Python FastAPI (backend), PostgreSQL, Redis/Celery (import PDF), và trình đọc PDF bằng PDF.js (`react-pdf`). Source frontend và backend độc lập, giao tiếp qua HTTP REST API.

## Bắt đầu nhanh

Yêu cầu: Docker Engine + Docker Compose plugin và quyền chạy Docker. Máy cần kết nối internet lần đầu để tải image và npm/pip packages.

```bash
cp .env.example .env
# Sửa tối thiểu SECRET_KEY và mật khẩu; giá trị ví dụ chỉ dùng local
# Linux/macOS: openssl rand -hex 32

docker compose up -d --build
# Theo dõi seed và migration:
docker compose logs -f backend
```

Truy cập:

| Thành phần | URL |
| --- | --- |
| Website độc giả | http://localhost:8080 |
| CMS | http://localhost:8080/admin |
| Frontend trực tiếp (ảnh/API sẽ không tải được) | http://localhost:3000 |
| REST API / Swagger | http://localhost:8000/docs |
| Healthcheck | http://localhost:8000/health |

Nginx proxy (cổng `PROXY_PORT`, mặc định 8080) luôn chạy và là cổng vào duy nhất: trang, `/api` và `/media` cùng một địa chỉ nên không bị gắn cứng `localhost`. Trên server test, đặt `PROXY_BIND=0.0.0.0` (HTTP thuần) hoặc đặt tunnel/proxy TLS trước cổng này. Cấu hình này **không** thay thế TLS production.

Tài khoản demo mặc định **chỉ dành cho môi trường phát triển**: `admin@example.local` / `ChangeMe123!`. Đổi các biến `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SECRET_KEY`, `POSTGRES_PASSWORD` và chuỗi `DATABASE_URL` trong `.env` trước khi triển khai public. Seed chỉ tạo admin khi chưa tồn tại, thay biến môi trường không reset mật khẩu tài khoản hiện hữu.

Lưu ý: `NEXT_PUBLIC_API_BASE_URL` và `NEXT_PUBLIC_MEDIA_BASE_URL` được nhúng lúc **build frontend**. Nếu đổi hostname/domain, cần build lại frontend.

## Điều đã triển khai

- Trang chủ phong cách đặc san, kho số phát hành, trang chi tiết số, mục lục chia chuyên mục.
- Đọc bài, liên kết đúng trang PDF; nội dung HTML chỉ công khai sau khi được xác nhận biên tập.
- Trình đọc PDF.js (next/prev, jump page, zoom, tải PDF).
- Tìm kiếm tiêu đề, tác giả, mô tả, và toàn văn đã được xác nhận.
- CMS có đăng nhập, dashboard, danh sách và tạo số, quản lý metadata, thêm chuyên mục/bài, hiệu đính toàn văn, xuất bản.
- PDF import bằng PyMuPDF chạy Celery background qua Redis; tạo bìa, tách 24 mục + 6 chuyên mục của PDF mẫu, trích xuất raw text và gắn trạng thái `needs_review`.
- PostgreSQL + Alembic migration, audit logs thao tác chỉnh sửa/xuất bản, idempotent seed.
- File PDF số 18 (136 trang) và HTML giao diện tham khảo đi kèm trong `sample/`.

## Mẫu PDF đã nhập

Trong `sample/KHPT_2-11.pdf`:

- Số 18 (9-2026), 136 trang PDF.
- Bìa: trang 1. Phóng sự ảnh: trang 2. Lời thưa: trang 3. Mục lục: trang 4.
- 6 chuyên mục, 24 mục chính từ trang 5 đến 133; thông tin xuất bản ở trang 134; trang phụ 135–136.
- Seed tự động hiển thị số 18 ở trang chủ, **chỉ công bố metadata mục lục và PDF gốc**. Toàn văn HTML ở trạng thái chờ kiểm chứng.

Quy trình thêm số mới:

1. Vào `/admin` và đăng nhập.
2. Chọn **Nhập PDF** và upload PDF (tối đa 60 MB).
3. Chờ worker xử lý và chọn **Làm mới** để xem kết quả. Status `needs_review` nghĩa là đã tạo bản nháp.
4. Vào **Số đặc san**, chọn số → mở từng bài, đối chiếu với PDF gốc → sửa nội dung và tích **đã hiệu đính** khi chính xác.
5. Người có quyền `admin` chọn **Xuất bản**. Toàn văn chưa hiệu đính vẫn có thể đọc trong PDF nhưng không xuất hiện dưới dạng HTML.

Bộ phân tích PDF hiện có quy tắc nhận diện dành cho **dạng mục lục của số 18**, chưa phải engine tổng quát cho mọi kiểu PDF. Khi nhập số có dàn trang khác, import có thể thất bại rõ ràng; cần bổ sung template/parser hoặc chỉnh thủ công.

## Thiết kế repo

```text
dacsan-platform/
  frontend/     Next.js App Router, React, TypeScript, Tailwind
  backend/      FastAPI, SQLAlchemy 2, Alembic, PyMuPDF, Celery
  sample/       PDF số 18, HTML tham chiếu
  docs/         Tài liệu phân tích, kiến trúc, API, trạng thái
  scripts/      Công cụ kiểm tra
  docker-compose.yml
  .env.example
```

### Sử dụng API

- Public: `GET /api/v1/home`, `/issues`, `/issues/{slug}`, `/articles/{slug}`, `/search?q=...`.
- CMS: `/api/v1/auth/login`, `/api/v1/admin/dashboard`, `/admin/issues`, `/admin/articles/{id}`, `/admin/issues/import-pdf`, `/admin/import-jobs`, `/admin/issues/{id}/publish`.
- API schema: http://localhost:8000/openapi.json.

CMS sử dụng cookie HttpOnly cho access JWT, cookie CSRF và header `X-CSRF-Token` cho request ghi dữ liệu.

## Commands

```bash
# Khởi động
docker compose up -d --build
# Xem trạng thái
docker compose ps
# Xem log worker
docker compose logs -f worker
# Chạy lại seed an toàn
docker compose exec backend python -m app.seed
# Chạy migration
docker compose exec backend alembic upgrade head
# Chạy backend tests
docker compose exec -e DATABASE_URL=sqlite+pysqlite:////tmp/dacsan-pytest.sqlite backend pytest -q
# Dừng không xóa dữ liệu
docker compose down
# XÓA TOÀN BỘ DATABASE & FILE UPLOAD (cẩn thận)
docker compose down -v
```

Nếu chạy riêng ở máy dev: frontend cần `npm install`, `npm run dev`; backend cần Python 3.12 với `pip install -r requirements.txt`, PostgreSQL và Redis, cấu hình đúng URL dịch vụ trong `.env`.

## Lưu ý quan trọng / hiện trạng thử nghiệm

Đây là **MVP**, không phải phiên bản production đã được audit bảo mật. Chưa có: email newsletter, chatbot AI, full RBAC permission matrix, quản lý media tổng quát, OCR PDF scan, parser đa dạng tạp chí, bản dịch Anh/Việt, tìm kiếm không dấu nâng cao, hệ thống bài phản biện, CI/CD, backup/restore tự động, refresh-token rotation, rate limiting và E2E browser tests.

Các yêu cầu chưa hoàn thiện được ghi trong `docs/STATUS.md`. Không triển khai internet-facing trước khi hardening (HTTPS, cookie secure, secrets, giới hạn tài nguyên worker, kiểm tra file độc hại, phân quyền, backups, rate limits, logging/monitoring).

### Trạng thái kiểm thử tại thời điểm đóng gói

- Python module compilation: **PASS**.
- PyMuPDF parser số 18: **PASS** — 6 chuyên mục, 24 mục, 136 trang.
- Migration SQLite, seed idempotent: **PASS**.
- FastAPI TestClient public API/auth/CMS update: **PASS** trên SQLite.
- Docker Compose build và Next.js production build: **CHƯA KIỂM CHỨNG** do môi trường đóng gói không có Docker và không có mạng npm. Các dependency cần được cài khi bạn chạy project ở môi trường có internet.
# dacsan
