import { cookies } from 'next/headers';

// Chỉ dùng trong server component. Cookie do /xem-truoc đặt khi biên tập viên bấm "Xem trước" ở trang quản trị.
export const PREVIEW_COOKIE = 'dacsan_preview';

/** Chuỗi "?preview=<token>" để gửi kèm khi gọi API số/bài, hoặc "" nếu không ở chế độ xem trước. */
export function previewQS(): string {
  const t = cookies().get(PREVIEW_COOKIE)?.value;
  return t ? `?preview=${encodeURIComponent(t)}` : '';
}
