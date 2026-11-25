'use client';
import { adm } from './ResourceManager';

/** Nút "Gửi link đặt lại" ở dòng người dùng: gửi email đặt lại mật khẩu (hiệu lực 60 phút).
 *  Chưa cấu hình SMTP thì email nằm ở "Hộp thư đi", nên hiện kèm liên kết để chuyển tay. */
export default function UserResetButton({ user, token, onAuthError }: { user: any; token: string; onAuthError: () => void }) {
  if (user.pending || !user.is_active) return null;
  async function send() {
    if (!confirm(`Gửi liên kết đặt lại mật khẩu tới ${user.email}?`)) return;
    try {
      const d = await adm(`/users/${user.id}/reset-link`, token, { method: 'POST' });
      alert(`${d.message}.\n\nNếu email chưa tới (chưa cấu hình SMTP), gửi trực tiếp liên kết này (hiệu lực ${d.minutes} phút, dùng một lần):\n${d.link}`);
    } catch (e: any) {
      if (e.status === 401) onAuthError(); else alert(e.message || 'Không gửi được liên kết');
    }
  }
  return <button className="btn ghost sm" onClick={send} title="Gửi email đặt lại mật khẩu cho người dùng này">Gửi link đặt lại</button>;
}
