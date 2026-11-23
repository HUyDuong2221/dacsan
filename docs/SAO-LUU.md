# Sao lưu, khôi phục và quét mã độc

Tài liệu cho người quản trị máy chủ. Các lệnh dưới đây dùng tệp `docker-compose.server.yml` (project `dacsan`).
Trên máy lập trình thay bằng `docker compose` (tệp `docker-compose.yml`, project `dacsan-dev`, volume có tiền tố `dacsan-dev_`).

## 1. Sao lưu tự động

Service `backup` (thư mục `backup/`) chạy cùng các service khác:

- Mỗi ngày lúc `BACKUP_AT` (mặc định 02:00, theo `TZ`, mặc định `Asia/Ho_Chi_Minh`) tạo một tệp
  `dacsan-YYYYmmdd-HHMMSS.tar.gz` trong volume `backups`, gồm:
  - `db.dump`: toàn bộ cơ sở dữ liệu (`pg_dump -Fc`);
  - `media/`: ảnh bìa, PDF, ảnh giao diện, tệp đính kèm;
  - `private/`: bản thảo tác giả gửi (không công khai).
- Giữ `BACKUP_KEEP` bản mới nhất (mặc định 14), bản cũ hơn tự xóa.
- Trạng thái lần chạy gần nhất ghi ở `status.json`; trang quản trị **Hệ thống › Sao lưu và bảo mật tệp** hiển thị và cảnh báo nếu hơn 30 giờ chưa có bản thành công.
- Nút **Sao lưu ngay** trong trang quản trị tạo một bản ngay (bắt đầu trong vòng 20 giây).

Dung lượng: mỗi bản chứa đủ media, nên tổng dung lượng ≈ `BACKUP_KEEP` × (DB + media + private). Giảm `BACKUP_KEEP` nếu ổ đĩa nhỏ.

Xem nhanh trên máy chủ:

```bash
docker compose -f docker-compose.server.yml logs --tail 20 backup
docker compose -f docker-compose.server.yml exec backup sh -c "cat /backups/status.json; ls -lh /backups"
```

## 2. Đưa bản sao lưu ra khỏi máy chủ (bắt buộc làm định kỳ)

Volume `backups` nằm **cùng máy** với dữ liệu: hỏng ổ đĩa hoặc mất máy chủ thì mất luôn bản sao lưu.
Lệnh `docker compose down -v` cũng **xóa cả volume `backups`** cùng DB và media.

- Cách đơn giản: trang quản trị › Sao lưu › **Tải về** (liên kết có hiệu lực 5 phút, mỗi lần tải được ghi nhật ký), lưu ở ổ đĩa/kho lưu trữ an toàn.
- Hoặc chép bằng lệnh trên máy chủ rồi chuyển đi (scp, rclone…):

```bash
docker run --rm -v dacsan_backups:/backups -v "$PWD":/out alpine sh -c "cp /backups/dacsan-*.tar.gz /out/"
```

Bản sao lưu chứa mật khẩu đã băm của người dùng và bản thảo không công khai: chỉ lưu ở nơi có kiểm soát truy cập.

## 3. Khôi phục

> ⚠️ Khôi phục **ghi đè** cơ sở dữ liệu và tệp hiện có. Kiểm tra kỹ đang chạy lệnh trên **máy nào** và **project nào**
> (`dacsan` trên server, `dacsan-dev` trên máy lập trình). Nên tạo thêm một bản sao lưu của hiện trạng trước khi khôi phục.

Ví dụ khôi phục tệp `dacsan-20261122-020000.tar.gz` trên server:

```bash
# 0. Giải nén ra thư mục tạm
mkdir -p restore && tar -xzf dacsan-20261122-020000.tar.gz -C restore

# 1. Dừng các service đang ghi dữ liệu (giữ db chạy)
docker compose -f docker-compose.server.yml stop backend frontend backup

# 2. Khôi phục cơ sở dữ liệu (XÓA và tạo lại các bảng có trong bản sao lưu)
docker compose -f docker-compose.server.yml exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < restore/db.dump

# 3. Khôi phục tệp (chép đè vào volume media và private)
docker run --rm -v dacsan_media:/data/media -v dacsan_private:/data/private -v "$PWD/restore":/restore alpine \
  sh -c "cp -a /restore/media/. /data/media/ && cp -a /restore/private/. /data/private/"

# 4. Chạy lại
docker compose -f docker-compose.server.yml up -d
```

Khi backend khởi động, `init_db()` tự chạy migration Alembic, nên khôi phục một bản sao lưu cũ hơn phiên bản code hiện tại vẫn được nâng cấp schema.

Nên **diễn tập khôi phục** định kỳ (ví dụ mỗi quý) trên một máy khác hoặc project khác để chắc bản sao lưu dùng được.

## 4. Quét mã độc tệp tải lên

Service `clamav` (image `clamav/clamav`) quét mọi tệp quản trị viên tải lên và bản thảo tác giả gửi, ngay sau khi lưu:

- Có mã độc: tệp bị xóa, người tải lên nhận thông báo lỗi, sự việc ghi vào **Nhật ký hoạt động** (thao tác *Chặn tệp có mã độc*).
- Máy quét đang khởi động/lỗi: mặc định **từ chối** tệp (`CLAMAV_FAIL_OPEN=false`). Đặt `true` nếu muốn vẫn nhận tệp (không được quét) khi máy quét lỗi.
- Cần khoảng 1–1,5GB RAM. Lần đầu chạy, `clamav` tải bộ nhận diện mất vài phút; sau đó tự cập nhật (freshclam). Bộ nhận diện lưu ở volume `clamdb`.
- Trên máy lập trình, `clamav` không tự chạy: `docker compose --profile scan up -d clamav` rồi đặt `CLAMAV_HOST=clamav` trong `.env` và khởi động lại backend.

Kiểm tra máy quét: trang quản trị › Sao lưu và bảo mật tệp (ô *Quét mã độc tệp tải lên*), hoặc

```bash
docker compose -f docker-compose.server.yml ps clamav     # healthy = sẵn sàng
docker compose -f docker-compose.server.yml logs --tail 20 clamav
```
