'use client';
import { useEffect, useState } from 'react';
import ResourceManager, { adm, ResourceDef } from './ResourceManager';
import { BANNER_POSITIONS, BannerLayout, BannerPosition, DEFAULT_LAYOUT, LAYOUT_KEY, LIMITS, normLayout, parseLayouts } from '@/lib/banners';

const BANNER_RES: ResourceDef = {
  key: 'banners', title: 'Banner', addLabel: 'Thêm banner', editLabel: 'Sửa banner', hideId: true,
  fields: [
    { key: 'image_url', label: 'Ảnh', type: 'image', uploadKind: 'banner', required: true, list: true, full: true,
      hint: 'Ảnh ngang khổ rộng, JPG/WebP. Nên cùng tỉ lệ với khung của vị trí (ví dụ khung 1200×320 → ảnh 2400×640) để không bị cắt.' },
    { key: 'position', label: 'Vị trí', type: 'select', required: true, list: true, options: BANNER_POSITIONS.map((p) => ({ ...p })),
      hint: 'Các banner cùng vị trí tự chạy thành slider.' },
    { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true, hint: 'Thứ tự trong slider của vị trí đó: nhỏ hiện trước.' },
    { key: 'link', label: 'Liên kết khi bấm', list: true, hint: 'Tùy chọn. Ví dụ /issues/so-18-11-2026 hoặc https://… (mở tab mới).' },
    { key: 'alt', label: 'Mô tả ảnh', hint: 'Cho người dùng trình đọc màn hình: ghi lại chữ trên banner, ví dụ “Hội thảo KH&CN 2026, 12/12”.' },
    { key: 'published', label: 'Hiển thị', type: 'bool', list: true, def: true },
  ],
};

/** Giao diện › Banner trang chủ: kích thước theo vị trí + danh sách banner. */
export default function BannerAdmin({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [row, setRow] = useState<any>(null);
  const [lay, setLay] = useState<Record<BannerPosition, BannerLayout>>(parseLayouts(null));
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function fail(e: any) {
    if (e.status === 401) return onAuthError();
    setErr(e.message || 'Có lỗi xảy ra'); setMsg('');
  }

  async function load() {
    try {
      const rows = await adm('/settings', token);
      const r = rows.find((x: any) => x.key === LAYOUT_KEY) || null;
      setRow(r);
      setLay(parseLayouts(r?.value));
    } catch (e) { fail(e); }
  }
  // số banner đang hiển thị ở mỗi vị trí; gọi lại khi danh sách banner đổi (không đụng phần kích thước đang sửa)
  async function loadCounts() {
    try {
      const banners = await adm('/banners', token);
      const c: Record<string, number> = {};
      banners.filter((b: any) => b.published).forEach((b: any) => { c[b.position] = (c[b.position] || 0) + 1; });
      setCounts(c);
    } catch (e) { fail(e); }
  }
  useEffect(() => { load(); loadCounts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (pos: BannerPosition, patch: Partial<BannerLayout>) => setLay({ ...lay, [pos]: { ...lay[pos], ...patch } });

  async function save() {
    setMsg(''); setErr('');
    setBusy(true);
    try {
      const clean = Object.fromEntries(BANNER_POSITIONS.map((p) => [p.value, normLayout(lay[p.value])]));
      setLay(clean as Record<BannerPosition, BannerLayout>);
      const body = JSON.stringify({ key: LAYOUT_KEY, value: JSON.stringify(clean) });
      if (row) await adm(`/settings/${row.id}`, token, { method: 'PUT', body });
      else await adm('/settings', token, { method: 'POST', body });
      setMsg('Đã lưu cấu hình vị trí. Tải lại trang chủ để xem.');
      await load();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  const num = (pos: BannerPosition, key: 'h' | 'hm' | 'interval', label: string) => (
    <input className="input" type="number" min={LIMITS[key][0]} max={LIMITS[key][1]} value={lay[pos][key]} aria-label={label}
      onChange={(e) => set(pos, { [key]: e.target.value === '' ? ('' as any) : Number(e.target.value) })} />
  );

  return (
    <div>
      <div className="form" style={{ gridTemplateColumns: '1fr' }}>
        <h3 className="serif">Cấu hình theo vị trí</h3>
        <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
          Mỗi vị trí trên trang chủ có một khung banner; các banner cùng vị trí chạy thành slider trong khung đó.
          Bỏ đánh dấu <b>Hiển thị</b> để tạm ẩn cả vị trí (mọi banner ở đó không hiện, nhưng vẫn giữ nguyên trong danh sách).
          Chiều cao tính bằng px ({LIMITS.h[0]}–{LIMITS.h[1]} trên máy tính, {LIMITS.hm[0]}–{LIMITS.hm[1]} trên điện thoại).
          <b> Theo khung nội dung</b>: rộng bằng phần nội dung, bo góc. <b>Tràn màn hình</b>: rộng hết cửa sổ.
          <b> Cắt cho vừa khung</b>: ảnh phủ kín khung, có thể bị cắt mép. <b>Hiện đủ ảnh</b>: không cắt, có thể có viền trống.
        </p>
        <div className="tbl bl-tbl">
          <table className="t">
            <thead>
              <tr><th>Vị trí</th><th>Banner</th><th className="t-chk">Hiển thị</th><th>Cao (máy tính)</th><th>Cao (điện thoại)</th><th>Độ rộng</th><th>Ảnh</th><th>Chuyển sau (giây)</th></tr>
            </thead>
            <tbody>
              {BANNER_POSITIONS.map((p) => (
                <tr key={p.value} className={lay[p.value].hidden ? 'is-off' : undefined}>
                  <td>{p.label}</td>
                  <td><span className={`bl-cnt${counts[p.value] ? ' on' : ''}`} title="Số banner đang hiển thị">{counts[p.value] || 0}</span></td>
                  <td className="t-chk">
                    <input type="checkbox" checked={!lay[p.value].hidden} aria-label={`Hiển thị banner ở vị trí: ${p.label}`}
                      onChange={(e) => set(p.value, { hidden: !e.target.checked })} />
                  </td>
                  <td>{num(p.value, 'h', `Chiều cao trên máy tính: ${p.label}`)}</td>
                  <td>{num(p.value, 'hm', `Chiều cao trên điện thoại: ${p.label}`)}</td>
                  <td>
                    <select className="input" value={lay[p.value].width} aria-label={`Độ rộng: ${p.label}`} onChange={(e) => set(p.value, { width: e.target.value as BannerLayout['width'] })}>
                      <option value="content">Theo khung nội dung</option>
                      <option value="full">Tràn màn hình</option>
                    </select>
                  </td>
                  <td>
                    <select className="input" value={lay[p.value].fit} aria-label={`Cách hiện ảnh: ${p.label}`} onChange={(e) => set(p.value, { fit: e.target.value as BannerLayout['fit'] })}>
                      <option value="cover">Cắt cho vừa khung</option>
                      <option value="contain">Hiện đủ ảnh</option>
                    </select>
                  </td>
                  <td>{num(p.value, 'interval', `Thời gian chuyển: ${p.label}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err && <div className="err">{err}</div>}
        {msg && <div className="ok">{msg}</div>}
        <div className="row">
          <button type="button" className="btn" disabled={busy} onClick={save}>Lưu cấu hình vị trí</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => setLay(parseLayouts(null))}
            title={`Mặc định: cao ${DEFAULT_LAYOUT.h}px / ${DEFAULT_LAYOUT.hm}px, theo khung nội dung, cắt cho vừa khung, ${DEFAULT_LAYOUT.interval} giây, hiện tất cả vị trí`}>
            Đặt lại mặc định
          </button>
          <a className="btn ghost" href="/" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto' }}>Xem trang chủ ↗</a>
        </div>
      </div>

      <h3 className="serif" style={{ color: 'var(--c-navy)', fontSize: 22, margin: '8px 0 14px' }}>Danh sách banner</h3>
      <ResourceManager res={BANNER_RES} token={token} onAuthError={onAuthError} defaults={{ position: 'top' }} onChanged={loadCounts} />
    </div>
  );
}
