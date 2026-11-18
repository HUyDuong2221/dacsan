'use client';
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowRight, BookOpen, Bell, FilePlus2, Activity as ActivityIcon, FileText, LayoutDashboard, LogOut, RefreshCw, Search, UploadCloud} from 'lucide-react';
import {Issue, ImportJob, clientApi, mediaUrl} from '@/lib/api';
import {Badge, Field, Perform, Submit, validatePdf} from './admin/AdminUI';
import IssueWorkspace from './admin/IssueWorkspace';
import ContentManager from './admin/ContentManager';

type User = {id:string; email:string; role:string};
type Stats = {issues:number; articles:number; unverified:number; published_issues:number};
type View = 'dashboard' | 'issues' | 'create' | 'imports' | 'documents' | 'notices' | 'activities';

export default function AdminConsole() {
 const [user,setUser] = useState<User|null>(null);
 const [loading,setLoading] = useState(true);
 const [view,setView] = useState<View>('dashboard');
 const [issues,setIssues] = useState<Issue[]>([]);
 const [jobs,setJobs] = useState<ImportJob[]>([]);
 const [stats,setStats] = useState<Stats|null>(null);
 const [detail,setDetail] = useState<Issue|null>(null);
 const [workspaceVersion,setWorkspaceVersion] = useState(0);
 const [busy,setBusy] = useState(false);
 const [dirty,setDirty] = useState(false);
 const [error,setError] = useState('');
 const [message,setMessage] = useState('');
 const [query,setQuery] = useState('');
 const [status,setStatus] = useState('all');
 const [year,setYear] = useState('all');
 const reload = useCallback(async () => {
  try {
   const [s,i,j] = await Promise.all([clientApi<Stats>('/admin/dashboard'),clientApi<Issue[]>('/admin/issues'),clientApi<ImportJob[]>('/admin/import-jobs')]);
   setStats(s);setIssues(i);setJobs(j);
  } catch(e) {setError((e as Error).message);}
 },[]);
 useEffect(() => {clientApi<User>('/auth/me').then(u=>{setUser(u);void reload();}).catch(()=>setUser(null)).finally(()=>setLoading(false));},[reload]);
 useEffect(() => {
  if (!dirty) return;
  const warn = (event:BeforeUnloadEvent) => {event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);
  return () => window.removeEventListener('beforeunload',warn);
 },[dirty]);
 const processing = jobs.some(job => ['uploaded','processing'].includes(job.status));
 useEffect(() => {
  if (!user || !processing) return;
  const timer = window.setInterval(()=>{void reload();},5000);
  return () => window.clearInterval(timer);
 },[user,processing,reload]);
 const canLeave = () => !dirty || window.confirm('Bạn có thay đổi chưa lưu. Rời màn hình và bỏ các thay đổi này?');
 function navigate(next:View) {if(busy || !canLeave())return;setView(next);setDetail(null);setDirty(false);setError('');setMessage('');}
 const perform:Perform = async (work,success) => {
  setBusy(true);setError('');setMessage('');
  try {await work();setMessage(success);setDirty(false);return true;}
  catch(e) {setError((e as Error).message);return false;}
  finally {setBusy(false);}
 };
 async function openIssue(id:string) {
  if(busy || !canLeave())return;
  await perform(async()=>{const issue=await clientApi<Issue>(`/admin/issues/${id}`);setDetail(issue);setView('issues');},'');
 }
 async function refreshDetail() {
  if(detail) setDetail(await clientApi<Issue>(`/admin/issues/${detail.id}`));
  await reload();
 }
 async function signIn(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();const f=new FormData(event.currentTarget);
  await perform(async()=>{setUser(await clientApi<User>('/auth/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})}));await reload();},'');
 }
 async function signOut() {
  if(!canLeave())return;
  await perform(async()=>{await clientApi('/auth/logout',{method:'POST'});setUser(null);setDetail(null);setIssues([]);setJobs([]);setStats(null);setView('dashboard');},'');
 }
 async function create(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();const f=new FormData(event.currentTarget);
  await perform(async()=>{
   const created=await clientApi<Issue>('/admin/issues',{method:'POST',body:JSON.stringify({number:Number(f.get('number')),month:Number(f.get('month')),year:Number(f.get('year')),title:String(f.get('title')).trim(),theme:String(f.get('theme')).trim()})});
   setDetail({...created,sections:[]});setView('issues');await reload();
  },'Đã tạo bản nháp. Tiếp theo, tải PDF gốc để tạo ảnh bìa và kiểm tra số trang.');
 }
 async function importPdf(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();const form=event.currentTarget;const data=new FormData(form);
  if(await perform(async()=>{validatePdf(data);await clientApi('/admin/issues/import-pdf',{method:'POST',body:data});await reload();},'Đã gửi file để phân tích. Tiến trình sẽ tự cập nhật.'))form.reset();
 }
 const filtered=issues.filter(issue=>(status==='all'||issue.status===status)&&(year==='all'||String(issue.year)===year)&&`${issue.number} ${issue.title} ${issue.theme}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
 const drafts=issues.filter(issue=>issue.status==='draft');
 const years=Array.from(new Set(issues.map(issue=>issue.year))).sort((a,b)=>b-a);
 if(loading)return <div className="admin-loading">Đang mở không gian biên tập…</div>;
 if(!user)return <div className="admin-login"><div className="admin-login-intro"><BookOpen size={40}/><p className="admin-kicker">KHÔNG GIAN BIÊN TẬP</p><h1>Quản lý đặc san.<br/>Kết nối tri thức.</h1><p>Tạo số phát hành, biên tập bài viết và xuất bản nội dung từ một nơi.</p></div><div className="admin-login-form"><h2>Đăng nhập quản trị</h2><p>Dành cho quản trị viên và ban biên tập.</p><form onSubmit={signIn}><Field label="Email"><input type="email" name="email" required autoComplete="username"/></Field><Field label="Mật khẩu"><input type="password" name="password" required autoComplete="current-password"/></Field><Submit busy={busy}>Đăng nhập</Submit></form>{error&&<div className="admin-alert error" role="alert">{error}</div>}<Link href="/">← Về trang chủ</Link></div></div>;
 return <div className="admin-shell">
  <aside className="admin-sidebar"><div className="admin-brand"><BookOpen size={25}/><div><strong>Tòa soạn điện tử</strong><span>KHOA HỌC & PHÁT TRIỂN</span></div></div><p className="admin-nav-label">QUẢN LÝ NỘI DUNG</p><nav aria-label="Điều hướng quản trị">{([
   ['dashboard','Tổng quan',LayoutDashboard],['issues','Đặc san',BookOpen],['create','Tạo đặc san mới',FilePlus2],['imports','Nhập PDF tự động',UploadCloud],['documents','Tư liệu',FileText],['notices','Thông báo',Bell],['activities','Hoạt động',ActivityIcon]
  ] as const).map(([key,label,Icon])=><button key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} disabled={busy} onClick={()=>navigate(key)}><Icon size={19}/>{label}{key==='issues'&&<span>{issues.length}</span>}</button>)}</nav><div className="admin-sidebar-help"><strong>Quy trình biên tập</strong><p>Tạo bản nháp → Đính kèm PDF → Hoàn thiện mục lục → Kiểm tra và xuất bản.</p><span>Chỉ quản trị viên có quyền xuất bản và thu hồi.</span></div><div className="admin-account"><strong>{user.role==='admin'?'Quản trị viên':'Biên tập viên'}</strong><span>{user.email}</span><button onClick={signOut} disabled={busy}><LogOut size={16}/> Đăng xuất</button></div></aside>
  <div className="admin-main"><header className="admin-topbar"><div><p className="admin-kicker">BAN BIÊN TẬP / {detail?'CHI TIẾT ĐẶC SAN':view==='dashboard'?'TỔNG QUAN':view==='create'?'TẠO MỚI':view==='imports'?'SỐ HÓA':view==='documents'?'TƯ LIỆU':view==='notices'?'THÔNG BÁO':view==='activities'?'HOẠT ĐỘNG':'KHO ĐẶC SAN'}</p><h1>{detail?`Đặc san số ${detail.number}`:view==='dashboard'?'Tổng quan biên tập':view==='create'?'Tạo đặc san mới':view==='imports'?'Nhập PDF tự động':view==='documents'?'Tư liệu – Văn bản':view==='notices'?'Thông báo tòa soạn':view==='activities'?'Hoạt động Liên hiệp Hội':'Quản lý đặc san'}</h1></div><div className="admin-actions"><button className="admin-secondary" disabled={busy||view==='create'} onClick={async()=>{if(!canLeave())return;await perform(async()=>{if(detail){await refreshDetail();setWorkspaceVersion(value=>value+1);}else{await reload();}},'Đã cập nhật dữ liệu.');}}><RefreshCw size={16}/> Làm mới</button>{view!=='create'&&<button className="admin-primary" disabled={busy} onClick={()=>navigate('create')}><FilePlus2 size={17}/> Tạo đặc san</button>}</div></header>
   {error&&<div className="admin-alert error" role="alert">{error}</div>}{message&&<div className="admin-alert success" role="status">{message}</div>}
   {view==='dashboard'&&<><div className="admin-stats">{[['Số đặc san',stats?.issues],['Bản nháp',stats?stats.issues-stats.published_issues:undefined],['Đã xuất bản',stats?.published_issues],['Bài chưa hiệu đính',stats?.unverified]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value??'—'}</strong></div>)}</div><div className="admin-welcome"><div><p className="admin-kicker">BẮT ĐẦU MỘT SỐ PHÁT HÀNH</p><h2>Từ bản thảo đến số đặc san hoàn chỉnh</h2><p>Tạo bản nháp trước, bổ sung PDF và mục lục sau. Mỗi bước đều được lưu để bạn tiếp tục bất cứ lúc nào.</p><button className="admin-primary" onClick={()=>navigate('create')}>Tạo đặc san mới <ArrowRight size={17}/></button></div><ol>{['Thông tin số phát hành','PDF gốc và ảnh bìa','Chuyên mục và bài viết','Kiểm tra & xuất bản'].map((label,index)=><li key={label}><span>0{index+1}</span>{label}</li>)}</ol></div><div className="admin-two-columns"><section className="admin-panel"><div className="admin-panel-title"><h2>Tiếp tục biên tập</h2><button onClick={()=>{setStatus('draft');navigate('issues');}}>Xem bản nháp →</button></div>{drafts.length?drafts.slice(0,5).map(issue=><button className="admin-list-row" key={issue.id} disabled={busy} onClick={()=>openIssue(issue.id)}><BookOpen size={23}/><span><strong>Số {issue.number} · {issue.month}/{issue.year}</strong><small>{issue.theme||issue.title}</small></span><ArrowRight size={17}/></button>):<div className="admin-empty">Chưa có bản nháp. Tạo số mới để bắt đầu.</div>}</section><section className="admin-panel"><h2>Việc cần theo dõi</h2><ul className="admin-notes"><li><strong>{stats?.articles??0} bài viết</strong><span>Đang được quản lý trong kho đặc san.</span></li><li><strong>{stats?.unverified??0} bài chưa hiệu đính</strong><span>Bài chưa xác nhận chỉ hiển thị liên kết đọc PDF khi xuất bản.</span></li><li><strong>{jobs.filter(j=>j.status==='failed').length} tác vụ nhập thất bại</strong><button onClick={()=>navigate('imports')}>Xem lịch sử và thông báo xử lý →</button></li></ul></section></div></>}
   {view==='issues'&&!detail&&<section className="admin-panel"><div className="admin-panel-title"><div><h2>Danh sách số phát hành</h2><p>{filtered.length} / {issues.length} số đặc san</p></div></div><div className="admin-filters"><label className="admin-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm số, tên hoặc chủ đề…" aria-label="Tìm đặc san"/></label><select aria-label="Lọc trạng thái" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="published">Đã xuất bản</option></select><select aria-label="Lọc năm" value={year} onChange={e=>setYear(e.target.value)}><option value="all">Tất cả năm</option>{years.map(y=><option key={y}>{y}</option>)}</select></div><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Đặc san</th><th>Kỳ phát hành</th><th>Tài liệu</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{filtered.map(issue=><tr key={issue.id}><td><div className="admin-issue-name"><div className="admin-mini-cover">{issue.cover_key?<img alt="" src={mediaUrl(issue.cover_key)}/>:<BookOpen size={22}/>}</div><div><strong>{issue.title}</strong><small>{issue.theme||`Số ${issue.number}`}</small></div></div></td><td>{issue.month}/{issue.year}</td><td>{issue.pdf_key?`${issue.page_count} trang PDF`:<span className="admin-warning-text">Chưa có PDF</span>}</td><td><Badge status={issue.status}/></td><td><button className="admin-text-button" disabled={busy} onClick={()=>openIssue(issue.id)}>Biên tập →</button></td></tr>)}</tbody></table></div>{!filtered.length&&<div className="admin-empty">{issues.length?'Không có số phù hợp bộ lọc.':'Chưa có đặc san. Chọn “Tạo đặc san” để bắt đầu.'}</div>}</section>}
   {view==='create'&&<><div className="admin-alert info">Bạn đang tạo bản nháp. Số đặc san chỉ xuất hiện trên website sau khi quản trị viên xuất bản.</div><div className="admin-two-columns create"><section className="admin-panel"><p className="admin-kicker">BƯỚC 1 / THÔNG TIN PHÁT HÀNH</p><h2>Khai báo số đặc san</h2><p className="admin-description">Mỗi số phát hành là duy nhất trong một năm. Các trường có dấu * là bắt buộc.</p><form onSubmit={create} onChange={()=>setDirty(true)}><fieldset disabled={busy}><div className="admin-form-grid three"><Field label="Số phát hành *"><input name="number" type="number" min={1} max={9999} required placeholder="Ví dụ: 19"/></Field><Field label="Tháng *"><select name="month" defaultValue={new Date().getMonth()+1}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>Tháng {i+1}</option>)}</select></Field><Field label="Năm *"><input name="year" type="number" min={1900} max={2200} defaultValue={new Date().getFullYear()} required/></Field></div><Field label="Tên số đặc san *"><input name="title" minLength={2} maxLength={500} required defaultValue="Đặc san Khoa học & Phát triển"/></Field><Field label="Chủ đề" hint="Chủ đề hoặc nội dung trọng tâm của số phát hành."><input name="theme" maxLength={600} placeholder="Nhập chủ đề của số đặc san"/></Field><div className="admin-form-footer"><Submit busy={busy}>Tạo bản nháp & tiếp tục <ArrowRight size={17}/></Submit><button type="button" className="admin-secondary" onClick={()=>navigate('issues')}>Hủy</button></div></fieldset></form></section><aside className="admin-panel admin-guide"><h2>Sau khi tạo bản nháp</h2><ol><li><strong>Đính kèm PDF</strong><p>Chọn PDF tối đa 60 MB. Hệ thống lấy trang đầu làm ảnh bìa và đếm số trang.</p></li><li><strong>Hoàn thiện mục lục</strong><p>Thêm chuyên mục, bài viết, tác giả và khoảng trang in / PDF.</p></li><li><strong>Kiểm tra xuất bản</strong><p>Đối chiếu tài liệu gốc; quản trị viên xem danh sách kiểm tra trước khi công bố.</p></li></ol><div className="admin-guide-alternative"><strong>Đã có PDF với mục lục nhận diện được?</strong><p>Dùng nhập tự động để tạo số và trích xuất mục lục. Kết quả vẫn cần kiểm tra.</p><button className="admin-text-button" onClick={()=>navigate('imports')}>Chuyển sang nhập PDF →</button></div></aside></div></>}
   {view==='imports'&&<div className="admin-two-columns create"><section className="admin-panel"><p className="admin-kicker">SỐ HÓA TỪ TÀI LIỆU GỐC</p><h2>Tạo số từ PDF</h2><p className="admin-description">Hệ thống nhận diện số, kỳ phát hành và mục lục từ PDF. Không dùng thao tác này để đính kèm PDF vào bản nháp đã tạo.</p><div className="admin-alert info">Phù hợp PDF có văn bản và cấu trúc giống mẫu số 18. PDF scan hoặc bố cục khác có thể không nhận diện được; khi đó hãy tạo số thủ công.</div><form onSubmit={importPdf}><fieldset disabled={busy}><Field label="File PDF *" hint="Tối đa 60 MB. Không cần tạo số trước khi nhập tự động."><input type="file" name="file" accept="application/pdf,.pdf" required/></Field><Submit busy={busy}><UploadCloud size={18}/> Tải lên & phân tích</Submit></fieldset></form></section><section className="admin-panel"><div className="admin-panel-title"><h2>Lịch sử nhập PDF</h2>{processing&&<span className="admin-muted">Tự cập nhật 5 giây</span>}</div>{jobs.length?jobs.map(job=><article className="admin-job" key={job.id}><strong>{job.filename}</strong><div><Badge status={job.status}/><span>{job.progress}%</span></div><progress value={job.progress} max={100} aria-label={`Tiến trình ${job.filename}`}/><p>{job.message}</p>{job.issue_id&&<button className="admin-text-button" disabled={busy} onClick={()=>openIssue(job.issue_id!)}>Mở số để kiểm tra →</button>}{job.status==='failed'&&<p className="admin-muted">Kiểm tra thông báo trên, rồi chọn file để nhập lại hoặc tạo số thủ công.</p>}</article>):<div className="admin-empty">Chưa có tác vụ nhập PDF.</div>}</section></div>}
   {(view==='documents'||view==='notices'||view==='activities')&&<ContentManager key={view} kind={view} role={user.role} busy={busy} perform={perform}/>}
   {view==='issues'&&detail&&<IssueWorkspace key={`${detail.id}-${workspaceVersion}`} issue={detail} role={user.role} busy={busy} dirty={dirty} onDirty={setDirty} perform={perform} refresh={refreshDetail} onBack={()=>navigate('issues')}/>}
  </div>
 </div>;
}

