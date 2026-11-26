// Hai dòng chữ động của đầu trang; layout.tsx và khung xem trước logo trong admin dùng chung.
const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// Ngày theo giờ Việt Nam (máy chủ có thể chạy UTC).
export function viDate() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

// Dòng dưới logo: "Số 17 · Tháng 6/2026", lấy từ số và ngày đăng của số mới nhất.
export function latestIssueLabel(latest?: { number?: number; label?: string; published_at?: string | null }): string | undefined {
  if (!latest) return undefined;
  const [y, m] = (latest.published_at || '').slice(0, 10).split('-');
  return y && m ? `Số ${latest.number} · Tháng ${Number(m)}/${y}` : latest.label;
}
