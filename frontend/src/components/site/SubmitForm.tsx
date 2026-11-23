'use client';
import Link from 'next/link';
import { useState } from 'react';

const MAX_MB = 20;

export default function SubmitForm({ fields }: { fields: string[] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [abstractLen, setAbstractLen] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('file') as File;
    if (!file || !file.size) return setErr('Vui lòng chọn tệp bản thảo.');
    if (file.size > MAX_MB * 1024 * 1024) return setErr(`Bản thảo vượt quá ${MAX_MB}MB.`);
    fd.set('consent', fd.get('consent') ? 'true' : '');
    setBusy(true);
    try {
      const r = await fetch('/api/v1/public/submissions', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(typeof d.detail === 'string' ? d.detail : 'Không gửi được bài, vui lòng kiểm tra lại các ô đã nhập.');
      } else {
        setEmail(String(fd.get('email')));
        setCode(d.code);
        form.reset();
      }
    } catch {
      setErr('Không kết nối được máy chủ. Vui lòng thử lại.');
    }
    setBusy(false);
  }

  if (code)
    return (
      <div className="box tint" style={{ maxWidth: 640 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>Đã nhận bản thảo</div>
        <h3>Cảm ơn bạn đã gửi bài cho Đặc san</h3>
        <p>Hãy lưu lại <b>mã tra cứu</b> dưới đây. Bạn dùng mã này cùng email <b>{email}</b> để xem tình trạng xử lý bài.</p>
        <div className="mono" style={{ fontSize: 28, letterSpacing: '.18em', background: '#fff', border: '1px dashed var(--blue)', padding: '14px 18px', display: 'inline-block', marginBottom: 18 }}>{code}</div>
        <div className="row">
          <Link href="/gui-bai/theo-doi" className="btn">Tra cứu tình trạng bài</Link>
          <button className="btn ghost" onClick={() => setCode('')}>Gửi bài khác</button>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} className="form" style={{ maxWidth: 820 }}>
      <label>Họ và tên tác giả *<input className="input" name="name" required maxLength={200} autoComplete="name" /></label>
      <label>Email *<input className="input" name="email" type="email" required maxLength={255} autoComplete="email" /></label>
      <label>Đơn vị công tác<input className="input" name="organization" maxLength={300} autoComplete="organization" /></label>
      <label>Điện thoại<input className="input" name="phone" maxLength={40} autoComplete="tel" /></label>
      <label className="full">Chuyên mục đề xuất
        <input className="input" name="field_name" list="gb-fields" maxLength={200} placeholder="Chọn gợi ý hoặc tự nhập" />
        <datalist id="gb-fields">{fields.map((f) => <option key={f} value={f} />)}</datalist>
      </label>
      <label className="full">Tiêu đề bài viết *<input className="input" name="title" required minLength={5} maxLength={600} /></label>
      <label className="full">Tóm tắt nội dung * <small className="muted">({abstractLen}/5000, tối thiểu 30 ký tự)</small>
        <textarea className="input" name="abstract" required minLength={30} maxLength={5000} rows={6} onChange={(e) => setAbstractLen(e.target.value.length)} />
      </label>
      <label className="full">Tệp bản thảo * <small className="muted">(Word .doc/.docx, PDF hoặc .odt, tối đa {MAX_MB}MB)</small>
        <input className="input" name="file" type="file" required accept=".doc,.docx,.pdf,.odt" />
      </label>
      {/* ô bẫy cho bot: người thật không thấy */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="full" style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <input type="checkbox" name="consent" required style={{ width: 20, height: 20, marginTop: 2 }} />
        <span>Tôi cam kết bài viết là sản phẩm của tác giả, không vi phạm bản quyền và chưa đăng ở nơi khác. Tôi đã đọc <Link href="/docs">thể lệ gửi bài</Link>.</span>
      </label>
      {err && <div className="err full">{err}</div>}
      <div className="full row">
        <button className="btn" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi bài'}</button>
        <Link href="/gui-bai/theo-doi" className="btn ghost">Tra cứu bài đã gửi</Link>
      </div>
    </form>
  );
}
