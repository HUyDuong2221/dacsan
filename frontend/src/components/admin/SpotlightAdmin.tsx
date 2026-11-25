'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adm } from './ResourceManager';

type Kind = 'issue' | 'activity' | 'page' | 'post';
type Src = { id: number; title: string; img: string | null; live: boolean };
type Row = { id: number; issue_id: number | null; activity_id: number | null; page_id: number | null; post_id: number | null; title: string; excerpt: string; image_url: string | null; sort_order: number; published: boolean };
type Draft = { id?: number; kind: Kind; refId: string; title: string; excerpt: string; image_url: string; published: boolean };

const KINDS: { key: Kind; label: string }[] = [
  { key: 'issue', label: 'Số đặc san' },
  { key: 'activity', label: 'Hoạt động' },
  { key: 'page', label: 'Trang nội dung' },
  { key: 'post', label: 'Bài viết' },
];
const KEY_OF: Record<Kind, 'issue_id' | 'activity_id' | 'page_id' | 'post_id'> = { issue: 'issue_id', activity: 'activity_id', page: 'page_id', post: 'post_id' };
const HOME_LIMIT = 10;

const firstImg = (html?: string | null) => (html && /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1]) || null;
const kindOf = (r: Row): Kind => (r.issue_id ? 'issue' : r.activity_id ? 'activity' : r.page_id ? 'page' : 'post');
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

/** Mục "Tiêu điểm": cùng khung với các mục khác (thanh lọc, form thẻ, bảng); nút ↑ ↓ Sửa Xóa nằm ở cột cuối như Menu điều hướng. */
export default function SpotlightAdmin({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [src, setSrc] = useState<Record<Kind, Src[]>>({ issue: [], activity: [], page: [], post: [] });
  const [edit, setEdit] = useState<Draft | null>(null);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  function fail(e: any) { if (e?.status === 401) onAuthError(); else setErr(e?.message || 'Có lỗi xảy ra'); }

  async function load() {
    try {
      const [sp, is, ac, pg, po] = await Promise.all(['/spotlights', '/issues', '/activities', '/pages', '/posts'].map((p) => adm(p, token)));
      setRows(sp);
      setSrc({
        issue: is.map((i: any) => ({ id: i.id, title: `${i.label}${i.title || i.theme ? ' · ' + (i.title || i.theme) : ''}`, img: i.cover_url, live: !!i.published })),
        activity: ac.map((a: any) => ({ id: a.id, title: a.title, img: firstImg(a.content), live: !!a.published })),
        page: pg.map((p: any) => ({ id: p.id, title: p.title, img: firstImg(p.content), live: !!p.published })),
        post: po.map((p: any) => ({ id: p.id, title: p.title, img: firstImg(p.body), live: !!p.published })),
      });
    } catch (e) { fail(e); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (edit) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [edit?.id, !!edit]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => {
    const m: Record<Kind, Map<number, Src>> = { issue: new Map(), activity: new Map(), page: new Map(), post: new Map() };
    (Object.keys(src) as Kind[]).forEach((k) => src[k].forEach((s) => m[k].set(s.id, s)));
    return m;
  }, [src]);

  const items = useMemo(() => {
    let rank = 0;
    return rows.map((r) => {
      const kind = kindOf(r);
      const s = byId[kind].get(r[KEY_OF[kind]] as number);
      const shown = r.published && !!s && s.live;
      return { r, kind, s, shown, pos: shown ? ++rank : 0, title: r.title || s?.title || '(nội dung đã bị xóa)', img: r.image_url || s?.img || null };
    });
  }, [rows, byId]);
  const live = items.filter((x) => x.shown).length;
  const needle = norm(filter.trim());
  const visible = items.filter((x) => !needle || norm(x.title).includes(needle) || norm(KINDS.find((k) => k.key === x.kind)!.label).includes(needle));

  async function move(r: Row, d: -1 | 1) {
    const i = rows.findIndex((x) => x.id === r.id);
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    try {
      await Promise.all(next.map((x, n) => (x.sort_order === n ? null : adm(`/spotlights/${x.id}`, token, { method: 'PUT', body: JSON.stringify({ sort_order: n }) }))));
    } catch (e) { fail(e); }
    await load();
  }
  async function toggle(r: Row) {
    setRows(rows.map((x) => (x.id === r.id ? { ...x, published: !r.published } : x)));
    try { await adm(`/spotlights/${r.id}`, token, { method: 'PUT', body: JSON.stringify({ published: !r.published }) }); }
    catch (e) { fail(e); load(); }
  }
  async function remove(r: Row, title: string) {
    if (!confirm(`Gỡ “${title}” khỏi Tiêu điểm? Nội dung gốc không bị xóa.`)) return;
    try { await adm(`/spotlights/${r.id}`, token, { method: 'DELETE' }); await load(); } catch (e) { fail(e); }
  }

  const blank = (): Draft => ({ kind: 'issue', refId: '', title: '', excerpt: '', image_url: '', published: true });
  function openEdit(r: Row) {
    const kind = kindOf(r);
    setErr(''); setMsg('');
    setEdit({ id: r.id, kind, refId: String(r[KEY_OF[kind]]), title: r.title || '', excerpt: r.excerpt || '', image_url: r.image_url || '', published: r.published });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    if (!edit.refId) { setErr('Hãy chọn nội dung cần đưa lên Tiêu điểm'); return; }
    setErr(''); setMsg('');
    const body: any = { issue_id: null, activity_id: null, page_id: null, post_id: null, [KEY_OF[edit.kind]]: Number(edit.refId),
      title: edit.title, excerpt: edit.excerpt, image_url: edit.image_url, published: edit.published };
    try {
      await adm(edit.id ? `/spotlights/${edit.id}` : '/spotlights', token, { method: edit.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setEdit(null);
      setMsg('Đã lưu');
      await load();
    } catch (e) { fail(e); }
  }
  async function upload(file: File) {
    if (!edit) return;
    const fd = new FormData();
    fd.append('file', file);
    try { const d = await adm('/upload', token, { method: 'POST', body: fd }); setEdit((x) => (x ? { ...x, image_url: d.url } : x)); } catch (e) { fail(e); }
  }

  const chosen = edit && edit.refId ? byId[edit.kind].get(Number(edit.refId)) : undefined;
  const kindLabel = (k: Kind) => KINDS.find((x) => x.key === k)!.label;

  return (
    <div>
      <div className="tbar">
        <div className="tbar-search">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input className="input" type="search" aria-label="Lọc nhanh" placeholder="Lọc nhanh…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {filter && <button type="button" className="tbar-clear" aria-label="Xóa bộ lọc" onClick={() => setFilter('')}>×</button>}
        </div>
        <button className="btn" onClick={() => { setErr(''); setMsg(''); setEdit(blank()); }}>+ Thêm vào Tiêu điểm</button>
        <span className="tbar-count" aria-live="polite">{visible.length}/{rows.length} mục</span>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      {msg && <div className="ok" role="status">{msg}</div>}

      {edit && (
        <form className="form" onSubmit={save} ref={formRef} style={{ scrollMarginTop: 80 }}>
          <h3 className="full serif" style={{ fontSize: 20 }}>{edit.id ? 'Sửa mục Tiêu điểm' : 'Thêm vào Tiêu điểm'}</h3>
          <label>
            <span>Loại nội dung *</span>
            <select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Kind, refId: '' })}>
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </label>
          <label>
            <span>{kindLabel(edit.kind)} *</span>
            <select className="input" required value={edit.refId} onChange={(e) => setEdit({ ...edit, refId: e.target.value })}>
              <option value="">— chọn {kindLabel(edit.kind).toLowerCase()} —</option>
              {src[edit.kind].map((s) => <option key={s.id} value={s.id}>{s.title}{s.live ? '' : ' (chưa công bố)'}</option>)}
            </select>
            {chosen && !chosen.live && <small className="muted">Nội dung này chưa công bố nên mục Tiêu điểm sẽ chưa hiện cho đến khi công bố.</small>}
          </label>
          <label className="full">
            <span>Tiêu đề hiển thị</span>
            <input className="input" maxLength={600} value={edit.title} placeholder={chosen?.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <small className="muted">Để trống thì lấy tiêu đề của nội dung gốc.</small>
          </label>
          <label className="full">
            <span>Mô tả ngắn</span>
            <textarea className="input" rows={4} maxLength={1000} value={edit.excerpt} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} />
            <small className="muted">Để trống thì lấy đoạn đầu của nội dung gốc.</small>
          </label>
          <label className="full">
            <span>Ảnh</span>
            <div className="rm-img">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} placeholder="/media/… hoặc dán liên kết ảnh" />
                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Tải ảnh: Ảnh" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {(edit.image_url || chosen?.img) ? <img src={edit.image_url || chosen?.img || ''} alt="Xem trước ảnh" /> : <span className="muted">Chưa chọn ảnh</span>}
            </div>
            <small className="muted">Để trống thì lấy bìa số đặc san hoặc ảnh đầu tiên trong nội dung.</small>
          </label>
          <label>
            <span>Hiển thị</span>
            <input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} style={{ width: 20, height: 20 }} />
          </label>
          <div className="full row">
            <button className="btn">Lưu</button>
            <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="tbl">
        <table className="t">
          <thead>
            <tr><th style={{ width: 1 }}>STT</th><th>Ảnh</th><th>Loại</th><th>Tiêu đề</th><th className="t-chk">Hiển thị</th><th className="t-actcell" /></tr>
          </thead>
          <tbody>
            {visible.map((x) => (
              <tr key={x.r.id} className={!x.r.published ? 'is-off' : undefined}>
                <td className="mono">{rows.findIndex((y) => y.id === x.r.id) + 1}</td>
                <td>{/* eslint-disable-next-line @next/next/no-img-element */}{x.img ? <img className="t-thumb" src={x.img} alt="" loading="lazy" /> : ''}</td>
                <td><span className="pill">{kindLabel(x.kind)}</span></td>
                <td>
                  {x.title}
                  <small className="muted" style={{ display: 'block' }}>
                    {!x.s ? 'Nội dung đã xóa'
                      : !x.s.live ? 'Chưa công bố'
                      : !x.r.published ? 'Đang ẩn'
                      : x.pos <= HOME_LIMIT ? `Hiện ở trang chủ (#${x.pos})` : 'Chỉ hiện ở trang Tiêu điểm'}
                  </small>
                </td>
                <td className="t-chk"><input type="checkbox" checked={x.r.published} aria-label={`Hiển thị: ${x.title}`} onChange={() => toggle(x.r)} /></td>
                <td className="t-actcell">
                  <div className="t-act">
                    <button type="button" className="btn ghost sm" onClick={() => move(x.r, -1)} disabled={!!needle || rows[0]?.id === x.r.id} aria-label={`Đưa “${x.title}” lên`}>↑</button>
                    <button type="button" className="btn ghost sm" onClick={() => move(x.r, 1)} disabled={!!needle || rows[rows.length - 1]?.id === x.r.id} aria-label={`Đưa “${x.title}” xuống`}>↓</button>
                    <button className="btn ghost sm" onClick={() => openEdit(x.r)}>Sửa</button>
                    <button className="btn danger sm" onClick={() => remove(x.r, x.title)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="t-empty">
                <b>{rows.length ? 'Không có mục khớp bộ lọc' : 'Chưa có mục nào'}</b>
                {rows.length ? 'Thử từ khóa khác hoặc xóa bộ lọc.' : 'Bấm “Thêm vào Tiêu điểm” để tạo mục đầu tiên.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && <p className="muted" style={{ marginTop: 10 }}>{live} mục đang hiển thị. Mục mới thêm luôn lên đầu; trang chủ lấy {HOME_LIMIT} mục đầu, trang Tiêu điểm hiện tất cả. Dùng nút ↑ ↓ để đổi thứ tự.</p>}
    </div>
  );
}
