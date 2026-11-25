'use client';
import { useEffect, useRef, useState } from 'react';
import { adm } from './ResourceManager';

type Up = { token: string; filename: string; page_count: number };
type Draft = { title: string; author: string; html: string; images: { url: string }[]; warnings: string[] };

const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 600 };

// Khung "Tạo nội dung từ PDF" trong form Thêm/Sửa bài viết: tải PDF lên, chọn từ trang – đến trang, lấy ảnh hay không,
// rồi đổ tiêu đề, tác giả và toàn văn vào form để biên tập viên đọc lại, sửa trong trình soạn thảo và bấm Lưu.
export default function PdfArticleImport({ token, edit, setEdit, remountEditor, onAuthError }: {
  token: string; edit: any; setEdit: (fn: (x: any) => any) => void; remountEditor: () => void; onAuthError: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState<Up | null>(null);
  const [uploading, setUploading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [images, setImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [thumbs, setThumbs] = useState<{ from?: string; to?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const editRef = useRef(edit);
  editRef.current = edit;
  const upRef = useRef<Up | null>(null);
  upRef.current = up;

  const fail = (e: any) => (e.status === 401 ? onAuthError() : setErr(e.message));

  // dọn tệp PDF tạm khi đóng form (nếu không dọn, máy chủ cũng tự xóa sau 24 giờ)
  useEffect(() => () => { if (upRef.current) adm(`/pdf-articles/${upRef.current.token}`, token, { method: 'DELETE' }).catch(() => {}); }, [token]);

  // ảnh thu nhỏ của trang bắt đầu / kết thúc, giúp chọn đúng dải trang
  useEffect(() => {
    if (!up) { setThumbs({}); return; }
    const urls: string[] = [];
    let alive = true;
    const t = setTimeout(async () => {
      const get = async (v: string) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > up.page_count) return undefined;
        try {
          const r = await fetch(`/api/v1/admin/pdf-articles/${up.token}/page/${n}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) return undefined;
          const u = URL.createObjectURL(await r.blob());
          urls.push(u);
          return u;
        } catch { return undefined; }
      };
      const next = { from: await get(from), to: to && to !== from ? await get(to) : undefined };
      if (alive) setThumbs(next);
    }, 400);
    return () => { alive = false; clearTimeout(t); urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [up, from, to, token]);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setErr(''); setOk(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const info: Up = await adm('/pdf-articles/upload', token, { method: 'POST', body: fd });
      if (up) adm(`/pdf-articles/${up.token}`, token, { method: 'DELETE' }).catch(() => {});
      setUp(info); setFrom(''); setTo('');
    } catch (e) { fail(e); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function dropFile() {
    if (up) adm(`/pdf-articles/${up.token}`, token, { method: 'DELETE' }).catch(() => {});
    setUp(null); setErr(''); setOk('');
  }

  async function apply() {
    if (!up) return;
    const a = Number(from), b = Number(to || from);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > up.page_count) {
      setErr(`Nhập trang bắt đầu và trang kết thúc hợp lệ (từ 1 đến ${up.page_count}, trang kết thúc không nhỏ hơn trang bắt đầu).`);
      return;
    }
    setBusy(true); setErr(''); setOk('');
    try {
      const d: Draft = await adm(`/pdf-articles/${up.token}/extract`, token, { method: 'POST', body: JSON.stringify({ page_from: a, page_to: b, images }) });
      const cur = String(editRef.current?.body || '').trim();
      if (cur && !window.confirm('Bài đang có nội dung. Thêm nội dung lấy từ PDF vào cuối bài?\n\nChọn Hủy để giữ nguyên bài hiện tại.')) { setBusy(false); return; }
      setEdit((x: any) => ({
        ...x,
        title: String(x.title || '').trim() ? x.title : d.title,
        author: String(x.author || '').trim() ? x.author : d.author,
        body: cur ? `${x.body}\n${d.html}` : d.html,
      }));
      remountEditor();
      setOk(`Đã đưa nội dung trang ${a}${b > a ? `–${b}` : ''} vào bài${d.images.length ? ` (kèm ${d.images.length} ảnh)` : ''}${d.warnings.length ? `. Lưu ý: ${d.warnings.join('; ')}` : ''}. Kiểm tra ở ô Toàn văn bên dưới rồi bấm Lưu. Có thể chọn dải trang khác để thêm tiếp vào cuối bài.`);
    } catch (e) { fail(e); }
    setBusy(false);
  }

  return (
    <div style={{ border: '1px dashed var(--c-line2)', borderRadius: 'var(--r-ctl)', padding: 14, background: '#F7F9FC' }}>
      <button type="button" className="btn ghost sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? '▾' : '▸'} Tạo nội dung từ PDF
      </button>
      {!open && <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>Đọc chữ và ảnh của một bài trong tệp PDF vào form này</span>}
      {open && (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Tải tệp PDF (cả số đặc san hoặc riêng một bài, tối đa 50MB, PDF có lớp chữ, không phải bản scan), chọn từ trang nào đến trang nào.
            Tệp chỉ dùng để xử lý, không công khai và tự xóa sau 24 giờ.
          </p>
          {err && <div className="err">{err}</div>}
          {ok && <div className="ok">{ok}</div>}
          {!up ? (
            <label style={lbl}>Chọn tệp PDF
              <input ref={fileRef} type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={(e) => pickFile(e.target.files?.[0])} />
              {uploading && <span className="muted" style={{ fontWeight: 400 }}>Đang tải lên…</span>}
            </label>
          ) : (
            <>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                <span><b>{up.filename}</b> · {up.page_count} trang</span>
                <button type="button" className="btn ghost sm" onClick={dropFile} disabled={busy}>Chọn tệp khác</button>
              </div>
              <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
                <label style={lbl}>Từ trang
                  <input className="input" type="number" min={1} max={up.page_count} style={{ width: 110 }} value={from} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label style={lbl}>Đến trang
                  <input className="input" type="number" min={1} max={up.page_count} style={{ width: 110 }} placeholder={from} value={to} onChange={(e) => setTo(e.target.value)} />
                </label>
                <label className="row" style={{ gap: 8, fontSize: 14, minHeight: 44 }}>
                  <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} />
                  Lấy cả ảnh trong bài
                </label>
                <button type="button" className="btn" disabled={busy || !from} onClick={apply}>{busy ? 'Đang đọc PDF…' : 'Đưa vào bài viết'}</button>
              </div>
              {(thumbs.from || thumbs.to) && (
                <div className="row" style={{ gap: 14, marginTop: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {thumbs.from && <figure style={{ margin: 0 }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={thumbs.from} alt={`Trang ${from}`} style={{ height: 200, border: '1px solid var(--c-line)' }} /><figcaption className="muted" style={{ fontSize: 12 }}>Trang {from} (bắt đầu)</figcaption></figure>}
                  {thumbs.to && <figure style={{ margin: 0 }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={thumbs.to} alt={`Trang ${to}`} style={{ height: 200, border: '1px solid var(--c-line)' }} /><figcaption className="muted" style={{ fontSize: 12 }}>Trang {to} (kết thúc)</figcaption></figure>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
