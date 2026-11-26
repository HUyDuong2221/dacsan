'use client';
import { useCallback, useEffect, useState } from 'react';
import { adm } from './ResourceManager';

const STEP = 50;
const TONE: Record<string, string> = {
  create: '#0e7a4b', update: '#0B4F9C', delete: '#c8372d', login: '#5a6b76', login_failed: '#b26a00',
};
type Filters = { entity: string; action: string; user: string; q: string; date_from: string; date_to: string };
const EMPTY: Filters = { entity: '', action: '', user: '', q: '', date_from: '', date_to: '' };

function fmtDT(iso?: string | null) {
  if (!iso) return '—';
  const t = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
}

/** Nhật ký hoạt động (chỉ quản trị viên): ai làm gì, lúc nào, trên đối tượng nào. */
export default function AuditLogView({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [opts, setOpts] = useState<{ entities: any[]; actions: any[]; users: string[] }>({ entities: [], actions: [], users: [] });
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = useCallback((e: any) => (e.status === 401 ? onAuthError() : setErr(e.message)), [onAuthError]);

  const fetchPage = useCallback(async (flt: Filters, offset: number) => {
    const qs = new URLSearchParams({ limit: String(STEP), offset: String(offset) });
    Object.entries(flt).forEach(([k, v]) => v && qs.set(k, v));
    return adm(`/audit-logs?${qs}`, token);
  }, [token]);

  const load = useCallback(async (flt: Filters) => {
    setBusy(true); setErr('');
    try {
      const d = await fetchPage(flt, 0);
      setItems(d.items); setTotal(d.total);
    } catch (e) { fail(e); }
    setBusy(false);
  }, [fetchPage, fail]);

  // chỉ tải một lần khi mở mục (onAuthError của trang cha đổi mỗi lần render)
  useEffect(() => {
    adm('/audit-logs/options', token).then(setOpts).catch(fail);
    load(EMPTY);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function more() {
    setBusy(true);
    try {
      const d = await fetchPage(applied, items.length);
      setItems([...items, ...d.items]); setTotal(d.total);
    } catch (e) { fail(e); }
    setBusy(false);
  }

  function apply(e?: React.FormEvent) {
    e?.preventDefault();
    setApplied(f); load(f);
  }
  function clear() { setF(EMPTY); setApplied(EMPTY); load(EMPTY); }

  const filtered = Object.values(applied).some(Boolean);

  return (
    <div>
      <form className="form" onSubmit={apply} style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', padding: 18 }}>
        <label>Đối tượng
          <select className="input" value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value })}>
            <option value="">Tất cả</option>
            {opts.entities.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
        <label>Thao tác
          <select className="input" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}>
            <option value="">Tất cả</option>
            {opts.actions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
        <label>Người thực hiện
          <select className="input" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })}>
            <option value="">Tất cả</option>
            {opts.users.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label>Từ ngày<input className="input" type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} /></label>
        <label>Đến ngày<input className="input" type="date" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} /></label>
        <label>Từ khóa<input className="input" type="search" value={f.q} maxLength={100} placeholder="Tên đối tượng, email…" onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
        <div className="full row">
          <button className="btn" disabled={busy}>Lọc</button>
          {filtered && <button type="button" className="btn ghost" onClick={clear}>Xóa bộ lọc</button>}
          <span className="muted" style={{ marginLeft: 'auto' }}>{total} dòng nhật ký</span>
        </div>
      </form>
      {err && <div className="err">{err}</div>}
      <div className="tbl">
        <table className="t">
          <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Chi tiết</th><th>IP</th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDT(a.created_at)}</td>
                <td>{a.user_email || <span className="muted">—</span>}</td>
                <td><b style={{ color: TONE[a.action] || 'var(--a-ink)' }}>{a.action_label}</b></td>
                <td>{a.entity_label}{a.entity_id && <span className="muted"> #{a.entity_id}</span>}</td>
                <td style={{ maxWidth: 420, overflowWrap: 'anywhere' }}>{a.summary || <span className="muted mono">{a.method} {a.path}</span>}</td>
                <td className="mono">{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && !busy && <p className="muted" style={{ padding: 16 }}>{filtered ? 'Không có dòng nào khớp bộ lọc.' : 'Chưa có hoạt động nào được ghi.'}</p>}
      </div>
      {items.length < total && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button className="btn ghost" disabled={busy} onClick={more}>Xem thêm ({total - items.length} dòng)</button>
        </div>
      )}
    </div>
  );
}
