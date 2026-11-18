'use client';
import { useState } from 'react';
import { adm } from './ResourceManager';
import Portal from './Portal';

type Item = { field: string; author: string; title: string; page: number; on: boolean };

export default function TocImport({ issue, token, onAuthError, onDone }: { issue: any; token: string; onAuthError: () => void; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [source, setSource] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [replace, setReplace] = useState(false);

  const fail = (e: any) => (e.status === 401 ? onAuthError() : setErr(e.message));

  async function start() {
    setOpen(true); setBusy(true); setErr(''); setDone(''); setItems([]); setReplace(false);
    try {
      const d = await adm(`/issues/${issue.id}/toc/preview`, token, { method: 'POST' });
      setSource(d.source);
      setItems(d.items.map((i: any) => ({ ...i, on: true })));
    } catch (e) { fail(e); }
    setBusy(false);
  }

  async function create() {
    const chosen = items.filter((i) => i.on && i.title.trim()).map(({ on, ...rest }) => ({ ...rest, page: Number(rest.page) }));
    setBusy(true); setErr('');
    try {
      const d = await adm(`/issues/${issue.id}/toc/import`, token, { method: 'POST', body: JSON.stringify({ items: chosen, replace }) });
      setDone(`Đã thêm ${d.created} dòng vào mục lục${d.skipped ? `, bỏ qua ${d.skipped} dòng đã có` : ''}. Bạn có thể chỉnh từng dòng hoặc nhập toàn văn ở danh sách mục lục.`);
      setItems([]);
      onDone?.();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  const set = (k: number, patch: Partial<Item>) => setItems((a) => a.map((x, i) => (i === k ? { ...x, ...patch } : x)));
  const count = items.filter((i) => i.on).length;

  return (
    <>
      <button className="btn ghost sm" onClick={start} title={issue.pdf_url ? '' : 'Cần tải file PDF lên trước'}>Tạo mục lục từ PDF</button>
      {open && (
        <Portal>
        <div className="drawer-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="drawer-bg" onClick={() => !busy && setOpen(false)} />
          <div style={{ position: 'relative', background: 'var(--bg)', width: 'min(1100px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 40px rgba(23,37,47,.25)' }}>
            <div className="row" style={{ justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div className="kicker">Tạo mục lục từ PDF</div>
                <div className="serif" style={{ fontSize: 20, fontWeight: 700 }}>{issue.label}</div>
              </div>
              <button className="btn ghost sm" onClick={() => setOpen(false)}>✕ Đóng</button>
            </div>
            <div style={{ padding: 22, overflow: 'auto' }}>
              {busy && !items.length && <p className="muted">Đang đọc PDF…</p>}
              {err && <div className="err">{err}</div>}
              {done && <div className="ok">{done}</div>}
              {items.length > 0 && (
                <>
                  <p className="muted" style={{ marginTop: 0 }}>
                    Nguồn: {source === 'outline' ? 'bookmark của PDF' : 'trang mục lục dạng chữ'}. Đây chỉ là đề xuất tự động, hãy kiểm tra và sửa trước khi tạo.
                    Chuyên mục chưa có sẽ được tạo mới. Mục lục chỉ hiện ra ngoài khi số đặc san được công bố.
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="t">
                      <thead><tr><th /><th>Chuyên mục</th><th>Tác giả</th><th>Tiêu đề</th><th>Trang</th></tr></thead>
                      <tbody>
                        {items.map((it, k) => (
                          <tr key={k} style={{ opacity: it.on ? 1 : 0.45 }}>
                            <td><input type="checkbox" checked={it.on} onChange={(e) => set(k, { on: e.target.checked })} /></td>
                            <td><input className="input" style={{ minWidth: 150, padding: 6 }} value={it.field} onChange={(e) => set(k, { field: e.target.value })} /></td>
                            <td><input className="input" style={{ minWidth: 130, padding: 6 }} value={it.author} onChange={(e) => set(k, { author: e.target.value })} /></td>
                            <td><input className="input" style={{ minWidth: 300, padding: 6 }} value={it.title} onChange={(e) => set(k, { title: e.target.value })} /></td>
                            <td><input className="input" type="number" min={0} title="0 = chưa rõ trang" style={{ width: 70, padding: 6 }} value={it.page} onChange={(e) => set(k, { page: Number(e.target.value) })} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className="row" style={{ marginTop: 14, gap: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                    Xóa mục lục hiện có của số này rồi tạo lại (dùng khi mục lục đã nhập sai; toàn văn đã nhập cho các dòng cũ cũng bị xóa)
                  </label>
                  <div className="row" style={{ marginTop: 16 }}>
                    <button className="btn" disabled={busy || !count} onClick={create}>Thêm {count} dòng vào mục lục</button>
                    <button className="btn ghost" onClick={() => setOpen(false)}>Hủy</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
