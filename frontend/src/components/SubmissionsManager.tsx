'use client';
import { useCallback, useEffect, useState } from 'react';
import { adm } from './ResourceManager';
import Portal from './Portal';

const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'Mới nhận', color: '#5a6b76' },
  reviewing: { label: 'Đang xét duyệt', color: '#0B4F9C' },
  revision: { label: 'Cần chỉnh sửa', color: '#b26a00' },
  accepted: { label: 'Đã nhận đăng', color: '#0e7a4b' },
  rejected: { label: 'Không phù hợp', color: '#c8372d' },
};

export default function SubmissionsManager({ token, role, onAuthError }: { token: string; role: string; onAuthError: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const fail = useCallback((e: any) => (e.status === 401 ? onAuthError() : setErr(e.message)), [onAuthError]);
  const load = useCallback(async () => {
    try { setRows(await adm(`/submissions${filter ? `?status=${filter}` : ''}`, token)); setErr(''); } catch (e) { fail(e); }
  }, [filter, token, fail]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setErr(''); setMsg('');
    try {
      await adm(`/submissions/${sel.id}`, token, {
        method: 'PUT', body: JSON.stringify({ status: sel.status, note_public: sel.note_public || '', note_internal: sel.note_internal || '' }),
      });
      setMsg('Đã lưu'); setSel(null); load();
    } catch (e) { fail(e); }
  }

  async function remove(s: any) {
    if (!confirm(`Xóa vĩnh viễn bài gửi “${s.title}” và bản thảo đính kèm?`)) return;
    try { await adm(`/submissions/${s.id}`, token, { method: 'DELETE' }); setSel(null); setMsg('Đã xóa'); load(); } catch (e) { fail(e); }
  }

  async function download(s: any) {
    const r = await fetch(`/api/v1/admin/submissions/${s.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return setErr('Không tải được bản thảo');
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url; a.download = s.file_name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <select className="input" style={{ maxWidth: 240 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="muted">{rows.length} bài gửi</span>
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      <div className="tbl">
        <table className="t">
          <thead><tr><th>Ngày gửi</th><th>Mã</th><th>Tác giả</th><th>Tiêu đề</th><th>Chuyên mục đề xuất</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{(s.created_at || '').slice(0, 10)}</td>
                <td className="mono">{s.code}</td>
                <td>{s.name}<div className="muted">{s.email}</div></td>
                <td>{s.title}</td>
                <td>{s.field_name}</td>
                <td><b style={{ color: STATUS[s.status]?.color }}>{s.status_label}</b></td>
                <td><button className="btn ghost sm" onClick={() => setSel({ ...s })}>Xử lý</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="muted">Chưa có bài gửi.</p>}
      </div>

      {sel && (
        <Portal>
          <div className="drawer-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="drawer-bg" onClick={() => setSel(null)} />
            <div className="modal-card adm-main" style={{ position: 'relative', background: 'var(--bg)', width: 'min(820px, 96vw)', maxHeight: '94vh', overflow: 'auto', padding: 24, boxShadow: '0 0 40px rgba(23,37,47,.25)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="kicker">Bài gửi · mã {sel.code}</div>
                <button className="btn ghost sm" onClick={() => setSel(null)}>✕ Đóng</button>
              </div>
              <h2 className="serif" style={{ fontSize: 24, margin: '8px 0 12px' }}>{sel.title}</h2>
              <p className="muted" style={{ lineHeight: 1.7 }}>
                <b>{sel.name}</b> · <a href={`mailto:${sel.email}`}>{sel.email}</a>{sel.phone && ` · ${sel.phone}`}<br />
                {sel.organization && <>Đơn vị: {sel.organization}<br /></>}
                Chuyên mục đề xuất: {sel.field_name || '—'} · Gửi lúc {(sel.created_at || '').replace('T', ' ').slice(0, 16)}
              </p>
              <div className="leadbox" style={{ maxWidth: 'none', padding: 16 }}>
                <div className="kicker" style={{ marginBottom: 8 }}>Tóm tắt</div>
                <p style={{ fontStyle: 'normal', fontFamily: 'var(--sans)', fontSize: 15, whiteSpace: 'pre-wrap' }}>{sel.abstract}</p>
              </div>
              <div className="row" style={{ margin: '0 0 16px' }}>
                <button className="btn" onClick={() => download(sel)}>Tải bản thảo ({sel.file_name})</button>
              </div>
              <div className="form" style={{ gridTemplateColumns: '1fr', padding: 16 }}>
                <label>Trạng thái
                  <select className="input" value={sel.status} onChange={(e) => setSel({ ...sel, status: e.target.value })}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </label>
                <label>Phản hồi gửi tác giả <small className="muted">(tác giả thấy khi tra cứu bằng mã; hệ thống chưa tự gửi email)</small>
                  <textarea className="input" rows={3} value={sel.note_public || ''} onChange={(e) => setSel({ ...sel, note_public: e.target.value })} />
                </label>
                <label>Ghi chú nội bộ <small className="muted">(chỉ ban biên tập thấy)</small>
                  <textarea className="input" rows={3} value={sel.note_internal || ''} onChange={(e) => setSel({ ...sel, note_internal: e.target.value })} />
                </label>
              </div>
              <div className="row">
                <button className="btn" onClick={save}>Lưu</button>
                <button className="btn ghost" onClick={() => setSel(null)}>Hủy</button>
                {role === 'admin' && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => remove(sel)}>Xóa bài gửi</button>}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
