'use client';
import { useEffect, useState } from 'react';
import ResourceManager, { ResourceDef, adm } from '@/components/admin/ResourceManager';
import { ADMIN, EDIT, GROUPS, ICONS, RESOURCES, ROLE_LABELS, SUB_KEYS, SUBMENUS, TAB_ROLES } from '@/components/admin/resources';
import IssueToc from '@/components/admin/IssueToc';
import SubmissionsManager from '@/components/admin/SubmissionsManager';
import ImageSetting from '@/components/admin/ImageSetting';
import AuditLogView from '@/components/admin/AuditLogView';
import NavMenuEditor from '@/components/admin/NavMenuEditor';
import HomeLayoutEditor from '@/components/admin/HomeLayoutEditor';
import BannerAdmin from '@/components/admin/BannerAdmin';
import StatsView from '@/components/admin/StatsView';
import PdfArticleImport from '@/components/admin/PdfArticleImport';
import OutboxView from '@/components/admin/OutboxView';
import BackupView from '@/components/admin/BackupView';
import AuthScreen from '@/components/admin/AuthScreen';
import IssuePreviewButton from '@/components/admin/IssuePreviewButton';
import './admin.css';

export default function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('issues');
  const [menuOpen, setMenuOpen] = useState<Record<string, boolean>>({});
  const [me, setMe] = useState<{ email: string; full_name: string; role: string } | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [q, setQ] = useState('');
  const [newSubs, setNewSubs] = useState(0); // số bài gửi "Mới nhận", hiện cạnh mục Bài gửi
  const [pendingUsers, setPendingUsers] = useState(0); // tài khoản tự đăng ký chờ duyệt, cạnh mục Người dùng

  useEffect(() => {
    try { setToken(localStorage.getItem('dacsan_token')); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!token) { setMe(null); return; }
    adm('/auth/me', token).then(setMe).catch(() => logout());
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đếm bài gửi mới (chỉ quản trị viên, biên tập viên được xem bài gửi); tải lại khi đổi mục
  // để số giảm ngay sau khi xử lý bài trong mục Bài gửi.
  useEffect(() => {
    if (!token || !me || !EDIT.includes(me.role)) return;
    adm('/submissions/count?status=new', token).then((d) => setNewSubs(d.count || 0)).catch(() => {});
  }, [token, me, tab]);

  useEffect(() => {
    if (!token || me?.role !== 'admin') return;
    adm('/users', token).then((us: any[]) => setPendingUsers(us.filter((u) => u.pending).length)).catch(() => {});
  }, [token, me, tab]);

  function logout() {
    try { localStorage.removeItem('dacsan_token'); } catch {}
    setToken(null);
  }


  if (!ready) return null;
  if (!token)
    return (
      <AuthScreen onLogin={(t) => { try { localStorage.setItem('dacsan_token', t); } catch {} setToken(t); }} />
    );

  if (!me) return <div className="wrap page"><p className="muted">Đang tải…</p></div>;

  const role = me.role;
  const tabs = RESOURCES.filter((r) => (TAB_ROLES[r.key] || ADMIN).includes(role));
  const cur = tabs.find((r) => r.key === tab) || tabs[0];
  // cộng tác viên chỉ xem danh sách số, vào "Mục lục" để nhập; không thêm/sửa/xóa số
  const res: ResourceDef = cur.key === 'issues' && role === 'contributor' ? { ...cur, readonly: true, noDelete: true } : cur;

  // Nhóm và mục cha của mục đang mở (cho thanh đường dẫn)
  const parentKey = Object.keys(SUBMENUS).find((k) => SUBMENUS[k].includes(cur.key));
  const parent = parentKey ? RESOURCES.find((r) => r.key === parentKey) : undefined;
  const group = GROUPS.find((g) => g.keys.includes(parentKey || cur.key));
  // Lọc menu theo ô "Tìm mục quản trị" (không phân biệt dấu, hoa/thường)
  const needle = fold(q.trim());
  const match = (r: ResourceDef) => !needle || fold(r.title).includes(needle);
  const subsOf = (key: string) => (SUBMENUS[key] || []).map((k) => tabs.find((t) => t.key === k)).filter(Boolean) as ResourceDef[];
  const who = me.full_name || me.email;

  return (
    <div className="wrap page adm-root adm-app">
      <div className="adm-shell">
        <aside className="adm-side" aria-label="Menu quản trị">
          <a href="/" className="adm-logo" aria-label="Về trang chủ">
            <small>ĐẶC SAN</small>
            <b>Khoa học &amp; Phát triển</b>
            <i>THÀNH PHỐ ĐÀ NẴNG</i>
          </a>
          <label className="adm-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <input type="search" aria-label="Tìm mục quản trị" placeholder="Tìm mục quản trị…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <nav className="adm-nav" aria-label="Các nhóm quản trị">
            {GROUPS.map((g) => {
              const items = tabs
                .filter((r) => g.keys.includes(r.key) && !SUB_KEYS.includes(r.key))
                .filter((r) => match(r) || subsOf(r.key).some(match));
              if (!items.length) return null;
              return (
                <div className="adm-grp" key={g.title}>
                  <h4>{g.title}</h4>
                  {items.map((r) => {
                    const subs = subsOf(r.key);
                    const cnt = r.key === 'submissions' ? newSubs : r.key === 'users' ? pendingUsers : 0;
                    const cntText = r.key === 'users' ? 'tài khoản chờ duyệt' : 'bài gửi mới nhận';
                    if (!subs.length)
                      return (
                        <button key={r.key} type="button" className={'adm-item' + (cur.key === r.key ? ' on' : '')} aria-current={cur.key === r.key ? 'page' : undefined} onClick={() => setTab(r.key)}
                          aria-label={cnt ? `${r.title}, ${cnt} ${cntText}` : undefined}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[r.key]} /></svg><span className="lbl">{r.title}</span>
                          {cnt > 0 && <span className="cnt warn" aria-hidden="true" title={`${cnt} ${cntText}`}>{cnt > 99 ? '99+' : cnt}</span>}
                        </button>
                      );
                    const active = subs.some((x) => x.key === cur.key);
                    const open = needle ? true : menuOpen[r.key] ?? active;
                    return (
                      <div key={r.key} className="adm-drop">
                        <button type="button" className={'adm-item adm-parent' + (active ? ' in' : '')} aria-expanded={open} aria-controls={`adm-sub-${r.key}`}
                          onClick={() => { setMenuOpen({ ...menuOpen, [r.key]: !open }); if (!active && !open) setTab(subs[0].key); }}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[r.key]} /></svg><span className="lbl">{r.title}</span>
                          <svg className="adm-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                        {open && (
                          <div className="adm-sub" id={`adm-sub-${r.key}`}>
                            {subs.map((x) => (
                              <button key={x.key} type="button" className={'adm-subitem' + (cur.key === x.key ? ' on' : '')} aria-current={cur.key === x.key ? 'page' : undefined} onClick={() => setTab(x.key)}>{x.title}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {needle && !tabs.some(match) && <p className="adm-nomatch">Không có mục nào khớp.</p>}
          </nav>
          <div className="adm-acts">
            <div className="adm-user">
              <span className="adm-avatar" aria-hidden="true">{initials(who)}</span>
              <div><b>{who}</b><span>{ROLE_LABELS[role] || role}</span></div>
            </div>
            <div className="adm-row2">
              <button type="button" className="adm-gbtn" aria-expanded={pwOpen} onClick={() => setPwOpen(!pwOpen)}>Đổi mật khẩu</button>
              <button type="button" className="adm-gbtn" onClick={logout}>Đăng xuất</button>
            </div>
          </div>
        </aside>
        <main className="adm-main">
          <nav className="adm-crumb" aria-label="Đường dẫn">
            <span>Quản trị</span>
            {group && <><span aria-hidden="true">›</span><span>{group.title}</span></>}
            {parent && <><span aria-hidden="true">›</span><span>{parent.title}</span></>}
            <span aria-hidden="true">›</span><b aria-current="page">{cur.title}</b>
          </nav>
          <div className="adm-head" key={cur.key}><h1 className="serif">{cur.title}</h1></div>
          {pwOpen && <ChangePassword token={token} onDone={() => setPwOpen(false)} onAuthError={logout} />}
          <div className="adm-body" key={'b-' + cur.key}>
            {cur.key === 'users' && (
              <p className="muted" style={{ marginTop: 0, lineHeight: 1.7 }}>
                <b>Quản trị viên</b>: toàn quyền, gồm quản lý người dùng, cấu hình site, danh sách đăng ký email. ·{' '}
                <b>Biên tập viên</b>: quản lý số đặc san, mục lục, chuyên mục, hoạt động, bài viết và xử lý bài gửi; được công bố và xóa. ·{' '}
                <b>Cộng tác viên</b>: chỉ nhập/sửa mục lục và toàn văn của số <b>chưa công bố</b>; không công bố, không xóa, không xem bài gửi.
              </p>
            )}
            {cur.key === 'logo' ? (
              <ImageSetting token={token} onAuthError={logout} settingKey="logo_url" kind="logo"
                label="Logo đặc san"
                hint="Nên dùng ảnh PNG/WebP nền trong suốt, dạng ngang (ví dụ 600×160px). Logo hiện ở đầu trang chủ và các trang. Để trống để dùng logo chữ mặc định."
                doneText="Đã lưu. Logo mới sẽ hiện trên website." resetLabel="Dùng logo mặc định" />
            ) : cur.key === 'banner' ? (
              <BannerAdmin token={token} onAuthError={logout} />
            ) : cur.key === 'menu' ? (
              <NavMenuEditor token={token} onAuthError={logout} />
            ) : cur.key === 'home' ? (
              <HomeLayoutEditor token={token} onAuthError={logout} />
            ) : cur.key === 'backups' ? (
              <BackupView token={token} onAuthError={logout} />
            ) : cur.key === 'outbox' ? (
              <OutboxView token={token} onAuthError={logout} />
            ) : cur.key === 'stats' ? (
              <StatsView token={token} onAuthError={logout} />
            ) : cur.key === 'audit' ? (
              <AuditLogView token={token} onAuthError={logout} />
            ) : cur.key === 'submissions' ? (
              <SubmissionsManager token={token} role={role} onAuthError={logout} />
            ) : (
              <ResourceManager
                key={cur.key} res={res} token={token} onAuthError={logout}
                rowExtra={cur.key === 'issues' ? (row) => (
                  <>
                    <IssueToc issue={row} token={token} role={role} onAuthError={logout} />
                    <IssuePreviewButton issue={row} token={token} onAuthError={logout} />
                  </>
                ) : cur.key === 'posts' ? (row) => (
                  row.published ? <a className="btn ghost sm" href={`/bai-viet/${row.slug}`} target="_blank" rel="noreferrer">Xem bài</a> : null
                ) : undefined}
                formExtra={cur.key === 'posts' ? (edit, setEdit, remountEditor) => (
                  <PdfArticleImport token={token} edit={edit} setEdit={setEdit} remountEditor={remountEditor} onAuthError={logout} />
                ) : undefined}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Bỏ dấu tiếng Việt + chữ thường, để gõ "giao dien" cũng ra "Giao diện".
function fold(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

// Chữ viết tắt cho ô avatar: chữ đầu của hai từ cuối trong họ tên, hoặc 2 ký tự đầu của email.
function initials(name: string) {
  const w = name.includes('@') ? [name] : name.trim().split(/\s+/);
  const t = w.length >= 2 ? w[w.length - 2][0] + w[w.length - 1][0] : w[0].slice(0, 2);
  return t.toUpperCase();
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
