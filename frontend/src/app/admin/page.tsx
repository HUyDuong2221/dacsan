'use client';
import { useEffect, useState } from 'react';
import ResourceManager, { ResourceDef, adm } from '@/components/ResourceManager';

const STATUS = [{ value: 'draft', label: 'Nháp' }, { value: 'published', label: 'Đã xuất bản' }];

const RESOURCES: ResourceDef[] = [
  {
    key: 'articles', title: 'Bài viết',
    fields: [
      { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true },
      { key: 'author', label: 'Tác giả', list: true },
      { key: 'issue_id', label: 'Số phát hành', required: true, list: true, optionsFrom: { resource: 'issues', labelKey: 'label' } },
      { key: 'field_id', label: 'Chuyên mục', list: true, optionsFrom: { resource: 'fields', labelKey: 'name' } },
      { key: 'page_label', label: 'Trang in', hint: 'VD: tr. 13', list: true },
      { key: 'sort_order', label: 'Thứ tự trong số', type: 'number', list: true },
      { key: 'status', label: 'Trạng thái', type: 'select', options: STATUS, required: true, list: true },
      { key: 'is_front', label: 'Trang đầu số', type: 'bool' },
      { key: 'is_research', label: 'Nghiên cứu – Trao đổi', type: 'bool' },
      { key: 'featured', label: 'Hiện ở slide trang chủ', type: 'bool', list: true },
      { key: 'hero_excerpt', label: 'Đoạn trích cho slide', type: 'textarea' },
      { key: 'lead', label: 'Lời dẫn', type: 'textarea' },
      { key: 'body', label: 'Toàn văn', type: 'textarea', hint: 'Đề mục: dòng bắt đầu bằng "## ". Các đoạn cách nhau một dòng trống. Ảnh: ![chú thích](/media/anh.jpg). Để trống = chỉ có bản in.' },
    ],
  },
  {
    key: 'issues', title: 'Số phát hành',
    fields: [
      { key: 'number', label: 'Số', type: 'number', required: true, list: true },
      { key: 'label', label: 'Nhãn', required: true, list: true, hint: 'VD: Số 18 (8-2026)' },
      { key: 'year', label: 'Năm', type: 'number', list: true },
      { key: 'theme', label: 'Chủ đề', required: true, list: true, full: true },
      { key: 'summary', label: 'Giới thiệu', type: 'textarea' },
      { key: 'cover_url', label: 'Ảnh bìa', type: 'file' },
      { key: 'pdf_url', label: 'PDF cả số', type: 'file' },
      { key: 'page_count', label: 'Số trang', type: 'number' },
      { key: 'printed_articles', label: 'Số bài (số cũ chưa nhập bài)', type: 'number' },
      { key: 'published', label: 'Xuất bản', type: 'bool', list: true },
    ],
  },
  { key: 'fields', title: 'Chuyên mục', fields: [
    { key: 'name', label: 'Tên', required: true, list: true }, { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true }] },
  { key: 'activities', title: 'Hoạt động', fields: [
    { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true }, { key: 'kind', label: 'Loại', list: true },
    { key: 'event_date', label: 'Ngày', type: 'date', list: true }, { key: 'url', label: 'Liên kết' }, { key: 'published', label: 'Hiển thị', type: 'bool', list: true }] },
  { key: 'notices', title: 'Thông báo', fields: [
    { key: 'tag', label: 'Nhãn', list: true }, { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true },
    { key: 'notice_date', label: 'Ngày', type: 'date', list: true }, { key: 'content', label: 'Nội dung', type: 'textarea' }, { key: 'published', label: 'Hiển thị', type: 'bool', list: true }] },
  { key: 'documents', title: 'Tư liệu', fields: [
    { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true }, { key: 'doc_type', label: 'Loại', list: true },
    { key: 'file_url', label: 'Tệp', type: 'file' }, { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true }, { key: 'published', label: 'Hiển thị', type: 'bool', list: true }] },
  { key: 'settings', title: 'Cấu hình site', fields: [
    { key: 'key', label: 'Khóa', required: true, list: true, hint: 'org_name, issn, leaders, contact, license, copyright' },
    { key: 'value', label: 'Giá trị', type: 'textarea', list: true }] },
  { key: 'subscribers', title: 'Đăng ký email', readonly: true, fields: [{ key: 'email', label: 'Email', list: true }, { key: 'created_at', label: 'Ngày', list: true }] },
];

export default function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(RESOURCES[0].key);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    try { setToken(localStorage.getItem('dacsan_token')); } catch {}
    setReady(true);
  }, []);

  function logout() {
    try { localStorage.removeItem('dacsan_token'); } catch {}
    setToken(null);
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const d = await adm('/auth/login', '', { method: 'POST', body: JSON.stringify({ email, password: pw }) });
      try { localStorage.setItem('dacsan_token', d.token); } catch {}
      setToken(d.token);
      setPw('');
    } catch (e: any) { setErr(e.message); }
  }

  if (!ready) return null;
  if (!token)
    return (
      <div className="wrap page" style={{ maxWidth: 440 }}>
        <div className="kicker">Quản trị</div>
        <h1 className="serif" style={{ fontSize: 32, margin: '10px 0 22px' }}>Đăng nhập</h1>
        <form onSubmit={login} className="form" style={{ gridTemplateColumns: '1fr' }}>
          <label>Email<input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
          <label>Mật khẩu<input className="input" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
          {err && <div className="err">{err}</div>}
          <button className="btn">Đăng nhập</button>
        </form>
      </div>
    );

  const res = RESOURCES.find((r) => r.key === tab)!;
  return (
    <div className="wrap page">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 22 }}>
        <h1 className="serif" style={{ fontSize: 32 }}>Quản trị nội dung</h1>
        <button className="btn ghost" onClick={logout}>Đăng xuất</button>
      </div>
      <div className="tabs">
        {RESOURCES.map((r) => <button key={r.key} className={tab === r.key ? 'on' : ''} onClick={() => setTab(r.key)}>{r.title}</button>)}
      </div>
      <ResourceManager key={res.key} res={res} token={token} onAuthError={logout} />
    </div>
  );
}
