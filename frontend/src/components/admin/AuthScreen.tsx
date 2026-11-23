'use client';
import { useState } from 'react';
import { adm } from './ResourceManager';

type Mode = 'login' | 'forgot' | 'register';
const TITLE: Record<Mode, string> = { login: 'Đăng nhập', forgot: 'Quên mật khẩu', register: 'Đăng ký tài khoản' };

/** Màn hình chưa đăng nhập của trang quản trị: đăng nhập, quên mật khẩu (gửi email), tự đăng ký (chờ duyệt). */
export default function AuthScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [trap, setTrap] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function go(m: Mode) { setMode(m); setErr(''); setMsg(''); setPw(''); setPw2(''); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (mode === 'register' && pw !== pw2) return setErr('Hai lần nhập mật khẩu không khớp');
    setBusy(true);
    try {
      if (mode === 'login') {
        const d = await adm('/auth/login', '', { method: 'POST', body: JSON.stringify({ email, password: pw }) });
        setPw('');
        onLogin(d.token);
      } else if (mode === 'forgot') {
        const d = await adm('/auth/forgot-password', '', { method: 'POST', body: JSON.stringify({ email }) });
        setMsg(d.message);
      } else {
        const d = await adm('/auth/register', '', { method: 'POST', body: JSON.stringify({ email, full_name: name, password: pw, note, website: trap }) });
        setMsg(d.message); setPw(''); setPw2('');
      }
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  const done = !!msg && mode !== 'login';

  return (
    <div className="wrap page adm-root" style={{ maxWidth: 480 }}>
      <div className="kicker">Quản trị</div>
      <h1 className="serif" style={{ fontSize: 32, margin: '10px 0 22px' }}>{TITLE[mode]}</h1>
      {done ? (
        <div className="form" style={{ gridTemplateColumns: '1fr' }}>
          <div className="ok" role="status" style={{ margin: 0 }}>{msg}</div>
          <button type="button" className="btn" onClick={() => go('login')}>Về trang đăng nhập</button>
        </div>
      ) : (
        <form onSubmit={submit} className="form" style={{ gridTemplateColumns: '1fr' }}>
          {mode === 'forgot' && <p className="muted" style={{ margin: 0 }}>Nhập email đăng nhập. Nếu email có tài khoản đang hoạt động, hệ thống gửi liên kết đặt mật khẩu mới (hiệu lực 60 phút).</p>}
          {mode === 'register' && (
            <>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>Dành cho cộng tác viên nhập mục lục, toàn văn. Tài khoản dùng được sau khi quản trị viên duyệt; bạn sẽ nhận email khi được duyệt.</p>
              <label>Họ và tên<input className="input" required minLength={2} maxLength={200} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            </>
          )}
          <label>Email<input className="input" type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={mode === 'register' ? 'email' : 'username'} /></label>
          {mode !== 'forgot' && (
            <label>Mật khẩu{mode === 'register' && <small className="muted">Tối thiểu 8 ký tự</small>}
              <input className="input" type="password" required minLength={mode === 'register' ? 8 : undefined} value={pw} onChange={(e) => setPw(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            </label>
          )}
          {mode === 'register' && (
            <>
              <label>Nhập lại mật khẩu<input className="input" type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></label>
              <label>Đơn vị công tác, lý do đăng ký <small className="muted">(tùy chọn, gửi kèm cho quản trị viên)</small>
                <textarea className="input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              {/* ô bẫy cho bot: người thật không thấy */}
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
            </>
          )}
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Đang gửi…' : mode === 'login' ? 'Đăng nhập' : mode === 'forgot' ? 'Gửi liên kết đặt lại' : 'Gửi đăng ký'}</button>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
            {mode === 'login' ? (
              <>
                <button type="button" className="adm-link" onClick={() => go('forgot')}>Quên mật khẩu?</button>
                <button type="button" className="adm-link" onClick={() => go('register')}>Đăng ký tài khoản</button>
              </>
            ) : (
              <button type="button" className="adm-link" onClick={() => go('login')}>← Về đăng nhập</button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
