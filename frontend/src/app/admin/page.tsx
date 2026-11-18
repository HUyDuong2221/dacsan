'use client';
import { useEffect, useState } from 'react';
import ResourceManager, { ResourceDef, adm } from '@/components/ResourceManager';
import IssueToc from '@/components/IssueToc';

const RESOURCES: ResourceDef[] = [
  {
    key: 'issues', title: 'Số đặc san', addLabel: 'Thêm số đặc san mới', editLabel: 'Sửa số đặc san',
    fields: [
      { key: 'number', label: 'Số đặc san', type: 'number', required: true, list: true, hint: 'Số thứ tự, ví dụ 18. Nhãn hiển thị (VD: Số 18 (8-2026)) tự tạo từ Số đặc san và Ngày đăng.' },
      { key: 'published_at', label: 'Ngày đăng', type: 'date', required: true, list: true },
      { key: 'theme', label: 'Chủ đề', required: true, list: true, full: true },
      { key: 'summary', label: 'Giới thiệu', type: 'textarea' },
      { key: 'cover_url', label: 'Ảnh bìa', type: 'file' },
      { key: 'pdf_url', label: 'File PDF', type: 'file' },
      { key: 'page_count', label: 'Số trang', type: 'number' },
      { key: 'printed_articles', label: 'Số bài (cho số cũ chưa nhập mục lục)', type: 'number' },
      { key: 'published', label: 'Công bố trên website', type: 'bool', list: true, hint: 'Chưa tick thì số và mục lục của số chưa hiện ra ngoài.' },
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
      <ResourceManager
        key={res.key} res={res} token={token} onAuthError={logout}
        rowExtra={res.key === 'issues' ? (row) => <IssueToc issue={row} token={token} onAuthError={logout} /> : undefined}
      />
    </div>
  );
}
