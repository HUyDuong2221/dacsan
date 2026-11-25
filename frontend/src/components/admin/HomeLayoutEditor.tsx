'use client';
import { useEffect, useState } from 'react';
import { adm } from './ResourceManager';
import { HOME_LAYOUT_KEY, blockInfo, parseHomeLayout, serializeHomeLayout, type HomeBlock } from '@/lib/homeLayout';

/** Sửa bố cục trang chủ (cấu hình "home_layout"): bật/tắt từng khối, đổi thứ tự, đổi tiêu đề, số mục hiển thị. */
export default function HomeLayoutEditor({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [row, setRow] = useState<any>(null);
  const [items, setItems] = useState<HomeBlock[]>(parseHomeLayout(null));
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function fail(e: any) {
    if (e.status === 401) return onAuthError();
    setErr(e.message || 'Có lỗi xảy ra'); setMsg('');
  }

  async function load() {
    try {
      const rows: any[] = await adm('/settings', token);
      const r = rows.find((x) => x.key === HOME_LAYOUT_KEY) || null;
      setRow(r);
      setItems(parseHomeLayout(r?.value));
    } catch (e) { fail(e); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i: number, patch: Partial<HomeBlock>) => { setItems(items.map((x, k) => (k === i ? { ...x, ...patch } : x))); setMsg(''); };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next); setMsg('');
  };

  async function save() {
    setMsg(''); setErr('');
    if (!items.some((x) => !x.hidden)) return setErr('Cần ít nhất một khối đang hiển thị');
    setBusy(true);
    try {
      const body = JSON.stringify({ key: HOME_LAYOUT_KEY, value: serializeHomeLayout(items) });
      if (row) await adm(`/settings/${row.id}`, token, { method: 'PUT', body });
      else await adm('/settings', token, { method: 'POST', body });
      setMsg('Đã lưu. Trang chủ cập nhật khi tải lại trang.');
      await load();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  async function reset() {
    if (!confirm('Trở về bố cục trang chủ mặc định?')) return;
    setBusy(true);
    try {
      if (row) await adm(`/settings/${row.id}`, token, { method: 'DELETE' });
      setMsg('Đã trở về bố cục mặc định.'); setErr('');
      await load();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  return (
    <div className="form" style={{ gridTemplateColumns: '1fr' }}>
      <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
        Các khối của trang chủ, theo thứ tự từ trên xuống. Bỏ đánh dấu <b>Hiển thị</b> để ẩn một khối (dữ liệu không mất), dùng nút ↑ ↓ để đổi thứ tự.
        Với khối có tiêu đề hoặc số mục, bạn sửa ngay tại dòng. Ví dụ muốn có danh sách bài viết ở trang chủ: đánh dấu <b>Hiển thị</b> cho khối <b>Bài viết</b>,
        đặt vị trí và số bài. Khối này lấy các bài đã <b>công bố</b> ở Nội dung › Bài viết (mới nhất trước) và tự ẩn khi chưa có bài nào.
        Banner (Giao diện › Banner trang chủ) đi theo khối đứng ngay sau nó.
      </p>
      <div className="tbl">
        <table className="t">
          <thead><tr><th style={{ width: 1 }}>#</th><th>Khối</th><th>Tiêu đề hiển thị</th><th>Số mục</th><th className="t-chk">Hiển thị</th><th className="t-actcell" /></tr></thead>
          <tbody>
            {items.map((x, i) => {
              const info = blockInfo(x.key);
              return (
                <tr key={x.key} className={x.hidden ? 'is-off' : undefined}>
                  <td className="mono">{i + 1}</td>
                  <td>
                    <b>{info.label}</b>
                    <div className="muted" style={{ fontSize: 13, fontWeight: 400 }}>{info.desc}</div>
                  </td>
                  <td>
                    {info.title
                      ? <input className="input" aria-label={`Tiêu đề khối ${info.label}`} value={x.title} maxLength={60} placeholder={info.title} onChange={(e) => set(i, { title: e.target.value })} />
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    {info.count
                      ? <input className="input" type="number" style={{ width: 90 }} aria-label={`${info.count.label} ở khối ${info.label}`} min={info.count.min} max={info.count.max}
                          value={x.count} onChange={(e) => set(i, { count: Math.min(info.count!.max, Math.max(info.count!.min, Number(e.target.value) || info.count!.def)) })} />
                      : <span className="muted">—</span>}
                  </td>
                  <td className="t-chk">
                    <input type="checkbox" checked={!x.hidden} aria-label={`Hiển thị khối ${info.label} trên trang chủ`} onChange={(e) => set(i, { hidden: !e.target.checked })} />
                  </td>
                  <td className="t-actcell">
                    <div className="t-act">
                      <button type="button" className="btn ghost sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Đưa khối ${info.label} lên`}>↑</button>
                      <button type="button" className="btn ghost sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Đưa khối ${info.label} xuống`}>↓</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={save}>Lưu bố cục</button>
        <button type="button" className="btn ghost" disabled={busy || !row} onClick={reset}>Dùng bố cục mặc định</button>
        <a className="btn ghost" href="/" target="_blank" rel="noreferrer">Xem trang chủ</a>
      </div>
    </div>
  );
}
