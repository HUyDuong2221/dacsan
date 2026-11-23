// Báo một lượt xem trang / đọc PDF / tải PDF cho thống kê (backend: POST /api/v1/public/track).
// Mỗi phiên trình duyệt chỉ báo một lần cho cùng một mục; máy chủ còn chống lặp theo IP và bỏ qua bot.
export type TrackKind = 'view' | 'read' | 'download';

export function track(kind: TrackKind, issue: string, article?: string) {
  if (typeof window === 'undefined' || !issue) return;
  try {
    const key = `dacsan_t:${kind}:${issue}:${article || ''}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // chế độ riêng tư / chặn lưu trữ: vẫn gửi, máy chủ tự chống lặp
  }
  const body = JSON.stringify({ kind, issue, article: article || null });
  const url = '/api/v1/public/track';
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
  } catch {}
  fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}
