'use client';
import { adm } from './ResourceManager';

/** Nút "Xem trước" ở dòng số đặc san: mở số (kể cả chưa công bố) trong tab mới, như người đọc sẽ thấy. Link hết hạn sau 2 giờ. */
export default function IssuePreviewButton({ issue, token, onAuthError }: { issue: any; token: string; onAuthError: () => void }) {
  async function open() {
    // mở tab trước khi chờ API để trình duyệt không chặn cửa sổ bật lên
    const w = window.open('about:blank', '_blank');
    try {
      const d = await adm(`/issues/${issue.id}/preview-link`, token, { method: 'POST' });
      if (w) { w.opener = null; w.location.href = d.url; } else window.location.href = d.url;
    } catch (e: any) {
      w?.close();
      if (e.status === 401) onAuthError(); else alert(e.message || 'Không tạo được liên kết xem trước');
    }
  }
  return (
    <button className="btn ghost sm" onClick={open} title={issue.published ? 'Mở trang số đặc san' : 'Xem số chưa công bố như người đọc sẽ thấy (liên kết có hiệu lực 2 giờ)'}>
      Xem trước
    </button>
  );
}
