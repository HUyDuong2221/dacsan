#!/bin/sh
# Sao lưu định kỳ Đặc san: DB (pg_dump -Fc) + media + private
#   -> /backups/dacsan-YYYYmmdd-HHMMSS.tar.gz (gồm db.dump, media/, private/)
# Chạy hằng ngày lúc BACKUP_AT (giờ theo TZ), giữ BACKUP_KEEP bản mới nhất.
# Trang quản trị (Hệ thống > Sao lưu) ghi tệp /backups/.request để yêu cầu sao lưu ngay.
# Trạng thái lần chạy gần nhất: /backups/status.json. Hướng dẫn khôi phục: docs/SAO-LUU.md
set -u
OUT=/backups
KEEP=${BACKUP_KEEP:-14}
AT=${BACKUP_AT:-02:00}
export PGPASSWORD="${POSTGRES_PASSWORD:-}"
mkdir -p "$OUT"

status() { # ok(true|false) file size message
  msg=$(printf '%s' "$4" | tr -d '"\\' | tr '\n\r\t' '   ' | cut -c1-400)
  printf '{"time":"%s","ok":%s,"file":"%s","size":%s,"message":"%s"}\n' \
    "$(date +%Y-%m-%dT%H:%M:%S%z)" "$1" "$2" "$3" "$msg" > "$OUT/.status.tmp" && mv "$OUT/.status.tmp" "$OUT/status.json"
}

run() {
  ts=$(date +%Y%m%d-%H%M%S)
  name="dacsan-$ts.tar.gz"
  work="$OUT/.work-$ts"
  mkdir -p "$work"
  echo "[backup] bắt đầu $name"
  if ! pg_dump -h "${PGHOST:-db}" -U "${POSTGRES_USER:-dacsan}" -d "${POSTGRES_DB:-dacsan}" -Fc -f "$work/db.dump" 2>"$work/err"; then
    status false "" 0 "pg_dump lỗi: $(cat "$work/err")"
    rm -rf "$work"
    return 1
  fi
  if ! tar -czf "$OUT/.$name" -C "$work" db.dump -C /data media private 2>"$work/err"; then
    status false "" 0 "Nén tệp lỗi: $(cat "$work/err")"
    rm -rf "$work" "$OUT/.$name"
    return 1
  fi
  mv "$OUT/.$name" "$OUT/$name"   # tên cuối chỉ xuất hiện khi tệp đã hoàn chỉnh
  rm -rf "$work"
  size=$(wc -c < "$OUT/$name" | tr -d ' ')
  ls -1 "$OUT"/dacsan-*.tar.gz 2>/dev/null | sort -r | tail -n +$((KEEP + 1)) | while read -r f; do rm -f "$f"; done
  status true "$name" "$size" "Sao lưu thành công"
  echo "[backup] xong $name ($size byte)"
}

rm -rf "$OUT"/.work-* "$OUT"/.dacsan-*.tar.gz 2>/dev/null   # dọn lần chạy dở (container bị dừng giữa chừng)
echo "[backup] chạy hằng ngày lúc $AT (${TZ:-UTC}), giữ $KEEP bản"
while true; do
  if [ -f "$OUT/.request" ]; then
    rm -f "$OUT/.request"
    run || true
  fi
  today=$(date +%F)
  if [ "$(date +%H:%M)" = "$AT" ] && [ "$(cat "$OUT/.last-day" 2>/dev/null)" != "$today" ]; then
    echo "$today" > "$OUT/.last-day"
    run || true
  fi
  sleep 20
done
