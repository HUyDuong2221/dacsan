'use client';
import { useEffect, useState } from 'react';
import ResourceManager, { ResourceDef, adm } from '@/components/ResourceManager';
import IssueToc from '@/components/IssueToc';
import SubmissionsManager from '@/components/SubmissionsManager';
import ImageSetting from '@/components/ImageSetting';
import './admin.css';

const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Nội dung', keys: ['issues', 'submissions', 'fields'] },
  { title: 'Truyền thông', keys: ['activities', 'activity-types', 'notices', 'documents'] },
  { title: 'Hệ thống', keys: ['appearance', 'users', 'settings', 'subscribers'] },
];
// Menu thả xuống: mục cha -> các mục con
const SUBMENUS: Record<string, string[]> = { appearance: ['logo'] };
const SUB_KEYS = Object.values(SUBMENUS).flat();
const ICONS: Record<string, string> = {
  issues: 'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z',
  submissions: 'M3 7l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  fields: 'M4 6h16M4 12h16M4 18h10',
  activities: 'M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  'activity-types': 'M4 7h16M4 12h16M4 17h16M2 7h.01M2 12h.01M2 17h.01',
  notices: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  documents: 'M7 3h7l4 4v14H7zM14 3v4h4',
  users: 'M3 19c0-3 2.7-5 6-5s6 2 6 5M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM16 14c2.5 0 5 1.5 5 4',
  appearance: 'M4 5h16v11H4zM4 16l5-5 4 4 3-3 4 4M9 21h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-1-1-2h-4l-1 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z',
  subscribers: 'M4 6h16v12H4zM4 7l8 6 8-6',
};

const ROLE_LABELS: Record<string, string> = { admin: 'Quản trị viên', editor: 'Biên tập viên', contributor: 'Cộng tác viên' };
const STAFF = ['admin', 'editor', 'contributor'];
const EDIT = ['admin', 'editor'];
const ADMIN = ['admin'];
// Vai trò được thấy từng thẻ (máy chủ vẫn kiểm tra quyền ở mọi API)
const TAB_ROLES: Record<string, string[]> = {
  issues: STAFF, submissions: EDIT, fields: EDIT, activities: EDIT, 'activity-types': EDIT, notices: EDIT, documents: EDIT,
  users: ADMIN, appearance: ADMIN, logo: ADMIN, settings: ADMIN, subscribers: ADMIN,
};

const RESOURCES: ResourceDef[] = [
  {
    key: 'issues', title: 'Số đặc san', addLabel: 'Thêm số đặc san mới', editLabel: 'Sửa số đặc san', hideId: true,
    fields: [
      { key: 'number', label: 'Số đặc san', listLabel: 'Số', type: 'number', required: true, list: true, hint: 'Số thứ tự, ví dụ 18. Nhãn hiển thị (VD: Số 18 (8-2026)) tự tạo từ Số đặc san và Ngày đăng.' },
      { key: 'published_at', label: 'Ngày đăng', type: 'date', required: true },
      { key: 'title', label: 'Tên số đặc san', list: true, full: true, hint: 'Hiển thị làm tiêu đề ở khối Tiêu điểm trang chủ. Để trống thì dùng Chủ đề.' },
      { key: 'theme', label: 'Chủ đề (chuyên mục)', listLabel: 'Chuyên mục', required: true, list: true, full: true, optionsFrom: { resource: 'fields', labelKey: 'name', valueKey: 'name' } },
      { key: 'summary', label: 'Giới thiệu', type: 'textarea', def: 'Toàn văn đọc trực tiếp trên web, không cần tải PDF. Mục lục giữ đúng thứ tự chuyên mục của bản in, kèm số trang để đối chiếu.' },
      { key: 'cover_url', label: 'Ảnh bìa', type: 'file' },
      { key: 'pdf_url', label: 'File PDF', type: 'file' },
      { key: 'page_count', label: 'Số trang', type: 'number', hint: 'Để trống thì tự đếm từ file PDF khi lưu.' },
      { key: 'published', label: 'Công bố trên website', listLabel: 'Công bố', type: 'bool', list: true, hint: 'Chưa tick thì số và mục lục của số chưa hiện ra ngoài.' },
      { key: 'featured', label: 'Tiêu điểm', type: 'bool', list: true, hint: 'Tick để đưa số này lên khối Tiêu điểm ở trang chủ (hiện 10 số tiêu điểm mới nhất).' },
    ],
  },
  { key: 'submissions', title: 'Bài gửi', fields: [] },
  { key: 'fields', title: 'Chuyên mục', fields: [
    { key: 'name', label: 'Tên', required: true, list: true }, { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true }] },
  { key: 'activities', title: 'Hoạt động', fields: [
    { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true }, { key: 'kind', label: 'Loại hoạt động', list: true, optionsFrom: { resource: 'activity-types', labelKey: 'name', valueKey: 'name' }, hint: 'Quản lý danh sách ở mục “Loại hoạt động”.' },
    { key: 'event_date', label: 'Ngày', type: 'date', list: true }, { key: 'url', label: 'Liên kết' },
    { key: 'content', label: 'Nội dung', type: 'richtext', hint: 'Dùng nút “Nhập từ Word” để đưa nội dung file .docx vào ô này.' },
    { key: 'attachment_url', label: 'Tệp đính kèm (Word, PDF, Excel)', type: 'file', hint: 'Tải .doc, .docx, .pdf, .xls, .xlsx để người đọc tải về.' },
    { key: 'published', label: 'Hiển thị', type: 'bool', list: true }] },
  { key: 'activity-types', title: 'Loại hoạt động', addLabel: 'Thêm loại hoạt động', editLabel: 'Sửa loại hoạt động', fields: [
    { key: 'name', label: 'Tên loại', required: true, list: true }, { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true }] },
  { key: 'notices', title: 'Thông báo', fields: [
    { key: 'tag', label: 'Nhãn', list: true }, { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true },
    { key: 'notice_date', label: 'Ngày', type: 'date', list: true }, { key: 'content', label: 'Nội dung', type: 'textarea' }, { key: 'published', label: 'Hiển thị', type: 'bool', list: true }] },
  { key: 'documents', title: 'Tư liệu', fields: [
    { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true }, { key: 'doc_type', label: 'Loại', list: true },
    { key: 'file_url', label: 'Tệp', type: 'file' }, { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true }, { key: 'published', label: 'Hiển thị', type: 'bool', list: true }] },
  { key: 'appearance', title: 'Giao diện', fields: [] },
  { key: 'logo', title: 'Logo', fields: [] },
  { key: 'users', title: 'Người dùng', addLabel: 'Thêm người dùng', editLabel: 'Sửa người dùng', fields: [
    { key: 'email', label: 'Email đăng nhập', required: true, list: true },
    { key: 'full_name', label: 'Họ tên', list: true },
    { key: 'role', label: 'Vai trò', type: 'select', required: true, list: true, def: 'contributor',
      options: [{ value: 'contributor', label: 'Cộng tác viên' }, { value: 'editor', label: 'Biên tập viên' }, { value: 'admin', label: 'Quản trị viên' }] },
    { key: 'is_active', label: 'Đang hoạt động', type: 'bool', list: true, def: true, hint: 'Bỏ tick để khóa tài khoản (có hiệu lực ngay).' },
    { key: 'password', label: 'Mật khẩu', type: 'password', hint: 'Tối thiểu 8 ký tự. Khi sửa: để trống = giữ nguyên mật khẩu.' },
  ] },
  { key: 'settings', title: 'Cấu hình site', fields: [
    { key: 'key', label: 'Khóa', required: true, list: true, hint: 'org_name, issn, contact, license, copyright, publisher, editors' },
    { key: 'value', label: 'Giá trị', type: 'textarea', list: true }] },
  { key: 'subscribers', title: 'Đăng ký email', readonly: true, fields: [{ key: 'email', label: 'Email', list: true }, { key: 'created_at', label: 'Ngày', list: true }] },
];

export default function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('issues');
  const [menuOpen, setMenuOpen] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [me, setMe] = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    try { setToken(localStorage.getItem('dacsan_token')); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!token) { setMe(null); return; }
    adm('/auth/me', token).then(setMe).catch(() => logout());
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="wrap page adm-root" style={{ maxWidth: 440 }}>
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

  if (!me) return <div className="wrap page"><p className="muted">Đang tải…</p></div>;

  const role = me.role;
  const tabs = RESOURCES.filter((r) => (TAB_ROLES[r.key] || ADMIN).includes(role));
  const cur = tabs.find((r) => r.key === tab) || tabs[0];
  // cộng tác viên chỉ xem danh sách số, vào "Mục lục" để nhập; không thêm/sửa/xóa số
  const res: ResourceDef = cur.key === 'issues' && role === 'contributor' ? { ...cur, readonly: true, noDelete: true } : cur;

  return (
    <div className="wrap page adm-root">
      <div className="adm-shell">
        <aside className="adm-side">
          <a href="/" className="adm-logo" aria-label="Về trang chủ">
            <small>ĐẶC SAN</small>
            <b>Khoa học &amp; Phát triển</b>
            <i>THÀNH PHỐ ĐÀ NẴNG</i>
          </a>
          <nav className="adm-nav" aria-label="Menu quản trị">
            {GROUPS.map((g) => {
              const items = tabs.filter((r) => g.keys.includes(r.key) && !SUB_KEYS.includes(r.key));
              if (!items.length) return null;
              return (
                <div className="adm-grp" key={g.title}>
                  <h4>{g.title}</h4>
                  {items.map((r) => {
                    const subs = (SUBMENUS[r.key] || []).map((k) => tabs.find((t) => t.key === k)).filter(Boolean) as ResourceDef[];
                    if (!subs.length)
                      return (
                        <button key={r.key} className={'adm-item' + (cur.key === r.key ? ' on' : '')} aria-current={cur.key === r.key ? 'page' : undefined} onClick={() => setTab(r.key)}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[r.key]} /></svg>{r.title}
                        </button>
                      );
                    const active = subs.some((x) => x.key === cur.key);
                    const open = menuOpen[r.key] ?? active;
                    return (
                      <div key={r.key} className="adm-drop">
                        <button className={'adm-item adm-parent' + (active ? ' on' : '')} aria-expanded={open}
                          onClick={() => { setMenuOpen({ ...menuOpen, [r.key]: !open }); if (!active && !open) setTab(subs[0].key); }}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[r.key]} /></svg>{r.title}
                          <svg className="adm-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                        {open && (
                          <div className="adm-sub">
                            {subs.map((x) => (
                              <button key={x.key} className={'adm-subitem' + (cur.key === x.key ? ' on' : '')} aria-current={cur.key === x.key ? 'page' : undefined} onClick={() => setTab(x.key)}>{x.title}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div className="adm-acts">
            <div className="adm-user"><b>{me.full_name || me.email}</b><span>{ROLE_LABELS[role] || role}</span></div>
            <button className="btn ghost" onClick={() => setPwOpen(!pwOpen)}>Đổi mật khẩu</button>
            <button className="btn ghost" onClick={logout}>Đăng xuất</button>
          </div>
        </aside>
        <div className="adm-main">
          <div className="adm-head"><h1 className="serif">{cur.title}</h1></div>
          {pwOpen && <ChangePassword token={token} onDone={() => setPwOpen(false)} onAuthError={logout} />}
      {cur.key === 'users' && (
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.7 }}>
          <b>Quản trị viên</b>: toàn quyền, gồm quản lý người dùng, cấu hình site, danh sách đăng ký email. ·{' '}
          <b>Biên tập viên</b>: quản lý số đặc san, mục lục, chuyên mục, hoạt động, thông báo, tư liệu và xử lý bài gửi; được công bố và xóa. ·{' '}
          <b>Cộng tác viên</b>: chỉ nhập/sửa mục lục và toàn văn của số <b>chưa công bố</b>; không công bố, không xóa, không xem bài gửi.
        </p>
      )}
      {cur.key === 'logo' ? (
        <ImageSetting token={token} onAuthError={logout} settingKey="logo_url" kind="logo"
          label="Logo đặc san"
          hint="Nên dùng ảnh PNG/WebP nền trong suốt, dạng ngang (ví dụ 600×160px). Logo hiện ở đầu trang chủ và các trang. Để trống để dùng logo chữ mặc định."
          doneText="Đã lưu. Logo mới sẽ hiện trên website." resetLabel="Dùng logo mặc định" />
      ) : cur.key === 'submissions' ? (
        <SubmissionsManager token={token} role={role} onAuthError={logout} />
      ) : (
        <ResourceManager
          key={cur.key} res={res} token={token} onAuthError={logout}
          rowExtra={cur.key === 'issues' ? (row) => <IssueToc issue={row} token={token} role={role} onAuthError={logout} /> : undefined}
        />
      )}
        </div>
      </div>
    </div>
  );
}

function ChangePassword({ token, onDone, onAuthError }: { token: string; onDone: () => void; onAuthError: () => void }) {
  const [oldP, setOld] = useState('');
  const [newP, setNew] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await adm('/auth/change-password', token, { method: 'POST', body: JSON.stringify({ old_password: oldP, new_password: newP }) });
      setMsg('Đã đổi mật khẩu'); setOld(''); setNew('');
      setTimeout(onDone, 1200);
    } catch (e: any) { e.status === 401 ? onAuthError() : setErr(e.message); }
  }
  return (
    <form className="form" style={{ maxWidth: 520 }} onSubmit={submit}>
      <label className="full">Mật khẩu hiện tại<input className="input" type="password" required value={oldP} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></label>
      <label className="full">Mật khẩu mới (tối thiểu 8 ký tự)<input className="input" type="password" required minLength={8} value={newP} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" /></label>
      {err && <div className="err full">{err}</div>}
      {msg && <div className="ok full">{msg}</div>}
      <div className="full row"><button className="btn">Đổi mật khẩu</button><button type="button" className="btn ghost" onClick={onDone}>Hủy</button></div>
    </form>
  );
}
