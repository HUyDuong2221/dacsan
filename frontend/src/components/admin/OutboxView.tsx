'use client';
import { Fragment, useEffect, useState } from 'react';
import { adm } from './ResourceManager';

const STEP = 50;
const TONE: Record<string, string> = { pending: '#0B4F9C', sent: '#0e7a4b', failed: '#c8372d', unconfigured: '#b26a00' };

function fmtDT(iso?: string | null) {
  if (!iso) return '—';
  const t = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

/** Hệ thống › Hộp thư đi: trạng thái cấu hình SMTP, gửi thư thử, danh sách thư, xem nội dung, gửi lại. */
export default function OutboxView({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [cfg, setCfg] = useState<any>(null);
  const [data, setData] = useState<any>({ total: 0, items: [], counts: {}, statuses: [], kinds: [] });
  const [items, setItems] = useState<any[]>([]);
  const [f, setF] = useState({ status: '', kind: '', q: '' });
  const [open, setOpen] = useState<number | null>(null);
  const [body, setBody] = useState<Record<number, string>>({});
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  function fail(e: any) {
    if (e.status === 401) return onAuthError();
    setErr(e.message || 'Có lỗi xảy ra'); setMsg('');
  }

  async function load(flt = f, offset = 0) {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ limit: String(STEP), offset: String(offset) });
      Object.entries(flt).forEach(([k, v]) => v && qs.set(k, v));
      const d = await adm(`/outbox?${qs}`, token);
      setData(d);
      setItems(offset ? [...items, ...d.items] : d.items);
    } catch (e) { fail(e); }
    setBusy(false);
  }
  useEffect(() => {
    adm('/outbox/config', token).then(setCfg).catch(fail);
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // thư gửi nền: tải lại sau vài giây để thấy trạng thái mới
  const refreshSoon = () => setTimeout(() => load(f, 0), 2500);

  async function test(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await adm('/outbox/test', token, { method: 'POST', body: JSON.stringify({ to }) });
      setMsg(cfg?.configured ? `Đã gửi thư thử tới ${to}. Trạng thái cập nhật sau vài giây.` : 'Đã tạo thư thử ở Hộp thư đi (chưa gửi vì chưa cấu hình SMTP).');
      load(f, 0); refreshSoon();
    } catch (e) { fail(e); }
  }

  async function resend(r: any) {
    setErr(''); setMsg('');
    try {
      await adm(`/outbox/${r.id}/resend`, token, { method: 'POST' });
      setMsg(`Đang gửi lại thư tới ${r.to_email}…`);
      load(f, 0); refreshSoon();
    } catch (e) { fail(e); }
  }

  async function toggle(r: any) {
    if (open === r.id) return setOpen(null);
    setOpen(r.id);
    if (!body[r.id]) {
      try { const d = await adm(`/outbox/${r.id}`, token); setBody((b) => ({ ...b, [r.id]: d.body_text })); } catch (e) { fail(e); }
    }
  }

  const c = data.counts || {};

  return (
    <div>
      {cfg && (
        <div className={cfg.configured ? 'ok' : 'err'} role="status" style={{ display: 'block', lineHeight: 1.65, fontWeight: 400 }}>
          {cfg.configured ? (
            <><b>Đã cấu hình gửi email</b> qua {cfg.host}:{cfg.port} ({cfg.security}), địa chỉ gửi {cfg.from}. Link trong email trỏ về {cfg.site_url}.</>
          ) : (
            <><b>Chưa cấu hình gửi email.</b> Mọi thư (đặt lại mật khẩu, duyệt tài khoản, xác nhận đăng ký, thư báo số mới) vẫn được lưu ở đây nhưng chưa gửi đi.
              Quản trị máy chủ cần đặt <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code>, <code>SMTP_FROM</code>,{' '}
              <code>SMTP_SECURITY</code> và <code>SITE_URL</code> trong file <code>.env</code> rồi khởi động lại backend. Link trong email hiện trỏ về {cfg.site_url}.</>
          )}
        </div>
      )}

      <form className="form" onSubmit={test} style={{ gridTemplateColumns: '1fr auto', alignItems: 'end', padding: 16 }}>
        <label>Gửi thư thử tới
          <input className="input" type="email" required maxLength={255} value={to} onChange={(e) => setTo(e.target.value)} placeholder="email của bạn" />
        </label>
        <button className="btn">Gửi thư thử</button>
      </form>

      <div className="tbar">
        <select className="input" style={{ maxWidth: 220 }} value={f.status} aria-label="Lọc theo trạng thái"
          onChange={(e) => { const n = { ...f, status: e.target.value }; setF(n); load(n); }}>
          <option value="">Tất cả trạng thái</option>
          {data.statuses.map((s: any) => <option key={s.value} value={s.value}>{s.label} ({c[s.value] || 0})</option>)}
        </select>
        <select className="input" style={{ maxWidth: 240 }} value={f.kind} aria-label="Lọc theo loại thư"
          onChange={(e) => { const n = { ...f, kind: e.target.value }; setF(n); load(n); }}>
          <option value="">Tất cả loại thư</option>
          {data.kinds.map((k: any) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <form className="tbar-search" onSubmit={(e) => { e.preventDefault(); load(f); }}>
          <input className="input" type="search" aria-label="Tìm người nhận hoặc tiêu đề" placeholder="Người nhận, tiêu đề…" value={f.q}
            onChange={(e) => setF({ ...f, q: e.target.value })} />
        </form>
        <span className="tbar-count">{data.total} thư</span>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      {msg && <div className="ok" role="status">{msg}</div>}

      <div className="tbl">
        <table className="t">
          <thead><tr><th>Tạo lúc</th><th>Người nhận</th><th>Tiêu đề</th><th>Loại</th><th>Trạng thái</th><th className="t-actcell" /></tr></thead>
          <tbody>
            {items.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDT(r.created_at)}</td>
                  <td>{r.to_email}</td>
                  <td style={{ maxWidth: 360 }}>{r.subject}</td>
                  <td>{r.kind_label}</td>
                  <td>
                    <b style={{ color: TONE[r.status] }}>{r.status_label}</b>
                    {r.sent_at && <div className="muted">{fmtDT(r.sent_at)}</div>}
                    {r.error && <div className="muted" style={{ color: 'var(--c-red)', maxWidth: 260, overflowWrap: 'anywhere' }}>{r.error}</div>}
                  </td>
                  <td className="t-actcell">
                    <div className="t-act">
                      <button className="btn ghost sm" aria-expanded={open === r.id} onClick={() => toggle(r)}>{open === r.id ? 'Ẩn' : 'Xem'}</button>
                      {r.status !== 'sent' && cfg?.configured && <button className="btn ghost sm" onClick={() => resend(r)}>Gửi lại</button>}
                    </div>
                  </td>
                </tr>
                {open === r.id && (
                  <tr className="sub-review-row">
                    <td colSpan={6}>
                      <pre className="ob-body">{body[r.id] ?? 'Đang tải…'}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!items.length && !busy && <p className="muted" style={{ padding: 16 }}>Chưa có thư nào.</p>}
      </div>
      {items.length < data.total && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button className="btn ghost" disabled={busy} onClick={() => load(f, items.length)}>Xem thêm ({data.total - items.length} thư)</button>
        </div>
      )}
    </div>
  );
}
