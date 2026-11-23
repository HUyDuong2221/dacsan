'use client';
import { useEffect, useState } from 'react';
import { adm } from './ResourceManager';
import { DEFAULT_MENU, MENU_KEY, MenuItem, parseMenu, validHref } from '@/lib/menu';

const BUILTIN: MenuItem[] = [
  ...DEFAULT_MENU,
  { href: '/gui-bai', label: 'Gửi bài' },
  { href: '/gui-bai/theo-doi', label: 'Tra cứu bài gửi' },
  { href: '/search', label: 'Tìm kiếm' },
];

/** Sửa menu điều hướng chính (cấu hình "nav_menu"): thêm, đổi tên, đổi thứ tự, xóa mục. */
export default function NavMenuEditor({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [row, setRow] = useState<any>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [pages, setPages] = useState<MenuItem[]>([]);
  const [pick, setPick] = useState('');
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
      const r = rows.find((x) => x.key === MENU_KEY) || null;
      setRow(r);
      setItems(parseMenu(r?.value));
    } catch (e) { fail(e); }
  }
  useEffect(() => {
    load();
    adm('/pages', token)
      .then((ps: any[]) => setPages(ps.filter((p) => p.published).map((p) => ({ href: `/trang/${p.slug}`, label: p.title }))))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i: number, patch: Partial<MenuItem>) => setItems(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const suggestions = [...pages, ...BUILTIN].filter((s) => !items.some((x) => x.href === s.href));

  function add() {
    const s = suggestions.find((x) => x.href === pick);
    setItems([...items, s ? { ...s } : { label: '', href: '/' }]);
    setPick(''); setMsg('');
  }

  const bad = items.map((x) => !x.label.trim() ? 'Thiếu tên mục' : !validHref(x.href.trim()) ? 'Liên kết phải bắt đầu bằng / hoặc http(s)://' : '');

  async function save() {
    setMsg(''); setErr('');
    if (!items.length) return setErr('Menu cần ít nhất một mục');
    if (!items.some((x) => !x.hidden)) return setErr('Cần ít nhất một mục đang hiển thị');
    if (bad.some(Boolean)) return setErr('Sửa các ô đang báo lỗi trước khi lưu');
    setBusy(true);
    try {
      const body = JSON.stringify({ key: MENU_KEY, value: JSON.stringify(items.map((x) => ({ label: x.label.trim(), href: x.href.trim(), ...(x.hidden ? { hidden: true } : {}) }))) });
      if (row) await adm(`/settings/${row.id}`, token, { method: 'PUT', body });
      else await adm('/settings', token, { method: 'POST', body });
      setMsg('Đã lưu. Menu mới hiện trên website khi tải lại trang.');
      await load();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  async function reset() {
    if (!confirm('Trở về menu mặc định?')) return;
    setBusy(true);
    try {
      if (row) await adm(`/settings/${row.id}`, token, { method: 'DELETE' });
      setMsg('Đã trở về menu mặc định.'); setErr('');
      await load();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  return (
    <div className="form" style={{ gridTemplateColumns: '1fr' }}>
      <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
        Các mục trên thanh điều hướng của mọi trang công khai, theo thứ tự từ trái sang phải. Liên kết trong site bắt đầu bằng <code>/</code>
        (ví dụ <code>/trang/gioi-thieu</code>); liên kết ra ngoài bắt đầu bằng <code>https://</code> và mở ở tab mới.
        Bỏ đánh dấu <b>Hiển thị</b> để tạm ẩn một mục khỏi website mà không phải xóa. Nên giữ khoảng 5–7 mục đang hiển thị để menu không bị xuống dòng.
      </p>
      <div className="tbl">
        <table className="t">
          <thead><tr><th style={{ width: 1 }}>#</th><th>Tên hiển thị</th><th>Liên kết</th><th className="t-chk">Hiển thị</th><th className="t-actcell" /></tr></thead>
          <tbody>
            {items.map((x, i) => (
              <tr key={i} className={x.hidden ? 'is-off' : undefined}>
                <td className="mono">{i + 1}</td>
                <td>
                  <input className="input" aria-label={`Tên mục ${i + 1}`} value={x.label} maxLength={40} onChange={(e) => set(i, { label: e.target.value })} />
                </td>
                <td>
                  <input className="input mono" aria-label={`Liên kết mục ${i + 1}`} value={x.href} maxLength={300} onChange={(e) => set(i, { href: e.target.value })}
                    aria-invalid={!!bad[i]} style={bad[i] ? { borderColor: 'var(--c-red)' } : undefined} />
                  {bad[i] && <small style={{ color: 'var(--c-red)' }}>{bad[i]}</small>}
                </td>
                <td className="t-chk">
                  <input type="checkbox" checked={!x.hidden} aria-label={`Hiển thị mục ${x.label || i + 1} trên website`}
                    onChange={(e) => set(i, { hidden: !e.target.checked })} />
                </td>
                <td className="t-actcell">
                  <div className="t-act">
                    <button type="button" className="btn ghost sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Đưa mục ${i + 1} lên`}>↑</button>
                    <button type="button" className="btn ghost sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Đưa mục ${i + 1} xuống`}>↓</button>
                    <button type="button" className="btn danger sm" onClick={() => setItems(items.filter((_, k) => k !== i))}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <select className="input" style={{ maxWidth: 320 }} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Chọn trang để thêm vào menu">
          <option value="">Mục tự nhập…</option>
          {pages.some((p) => suggestions.includes(p)) && (
            <optgroup label="Trang nội dung">
              {suggestions.filter((s) => pages.includes(s)).map((s) => <option key={s.href} value={s.href}>{s.label}</option>)}
            </optgroup>
          )}
          <optgroup label="Trang có sẵn">
            {suggestions.filter((s) => !pages.includes(s)).map((s) => <option key={s.href} value={s.href}>{s.label}</option>)}
          </optgroup>
        </select>
        <button type="button" className="btn ghost" onClick={add}>+ Thêm mục</button>
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={save}>Lưu menu</button>
        <button type="button" className="btn ghost" disabled={busy || !row} onClick={reset}>Dùng menu mặc định</button>
      </div>
    </div>
  );
}
