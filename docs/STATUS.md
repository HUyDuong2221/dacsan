# Tình trạng triển khai / backlog

## Implemented, kiểm tra backend đã chạy
- [x] FastAPI public endpoints / CMS endpoints
- [x] SQLAlchemy models và Alembic schema migration
- [x] PDF parser số 18: 136 trang / 6 chuyên mục / 24 mục
- [x] Tạo cover từ PDF, copy PDF vào media volume
- [x] Public HTML chỉ trả khi `full_text_verified`
- [x] Admin cookie auth + CSRF + audit logs cho sửa bài / publish
- [x] Seed idempotent
- [x] Next.js source: trang chủ, kho số, bài, search, PDF reader, admin console

## Not implemented / không nên hiểu nhầm
- [ ] Verify Next.js production build bằng npm (không có mạng ở môi trường đóng gói)
- [ ] Verify Docker Compose integration bằng Docker Engine (không có Docker ở môi trường đóng gói)
- [ ] General PDF layout parser, nhiều kiểu mục lục / OCR / xử lý bảng và ảnh chính xác
- [ ] UI review PDF + text side-by-side trong cùng một trang (MVP mở PDF trong tab riêng)
- [ ] Drag/drop TOC reorder
- [x] Tư liệu (tài liệu) và Thông báo: model, migration 0002, API, trang public `/tai-lieu` `/thong-bao`, admin
- [ ] Media Library, CRUD hoạt động, Nghiên cứu – Trao đổi, newsletter
- [ ] Tác giả quan hệ many-to-many
- [ ] Refresh token rotation, brute-force protection, rate limiting
- [ ] Full SEO, accessibility audit, automated E2E browser tests
- [ ] S3/MinIO provider production, backups, CI/CD pipeline, observability
- [ ] Search tiếng Việt không dấu có index, thay ILIKE hiện tại
- [ ] Fine-grained RBAC / contributor workflow
- [ ] AI assistant và FAQ

## Next suggested milestones
1. Chạy Docker ở máy có internet, sửa bất kỳ npm/build compatibility phát sinh.
2. Kiểm tra UI desktop/mobile với giao diện HTML mẫu; hoàn thiện pixel-fidelity.
3. Hoàn thiện editor có visual preview/TOC reorder.
4. Bổ sung parser OCR fallback và job retry/cancel.
5. Bảo mật & vận hành production.
