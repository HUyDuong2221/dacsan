'use client';
import { useEffect, useState } from 'react';
import { adm } from '@/components/admin/ResourceManager';
import '../admin.css';

// Mở từ link trong email "Đặt lại mật khẩu": /admin/dat-lai-mat-khau?token=...
export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    if (!t) return; // (React dev chạy effect 2 lần: lần sau URL đã bỏ token, giữ token đã đọc)
    setToken(t);
    // bỏ token khỏi thanh địa chỉ / lịch sử trình duyệt
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (pw !== pw2) return setErr('Hai lần nhập mật khẩu không khớp');
    setBusy(true);
    try {
      const d = await adm('/auth/reset-password', '', { method: 'POST', body: JSON.stringify({ token, password: pw }) });
      setMsg(d.message);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="wrap page adm-root" style={{ maxWidth: 480 }}>
      <div className="kicker">Quản trị</div>
      <h1 className="serif" style={{ fontSize: 32, margin: '10px 0 22px' }}>Đặt mật khẩu mới</h1>
      {msg ? (
        <div className="form" style={{ gridTemplateColumns: '1fr' }}>
          <div className="ok" role="status" style={{ margin: 0 }}>{msg}</div>
          <a className="btn" href="/admin">Đăng nhập</a>
        </div>
      ) : (
        <form onSubmit={submit} className="form" style={{ gridTemplateColumns: '1fr' }}>
          <label>Mật khẩu mới <small className="muted">Tối thiểu 8 ký tự</small>
            <input className="input" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </label>
          <label>Nhập lại mật khẩu mới
            <input className="input" type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </label>
          {!token && <div className="err">Thiếu mã đặt lại mật khẩu. Hãy mở đúng liên kết trong email, hoặc yêu cầu lại ở trang đăng nhập.</div>}
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn" disabled={busy || !token}>{busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</button>
          <a className="adm-link" href="/admin" style={{ fontSize: 14 }}>← Về đăng nhập</a>
        </form>
      )}
    </div>
  );
}
