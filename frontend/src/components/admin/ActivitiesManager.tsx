'use client';
import {useCallback, useEffect, useState} from 'react';
import {Eye, EyeOff, Pencil, Plus, Trash2} from 'lucide-react';
import {Activity, clientApi} from '@/lib/api';
import {Badge, Field, Perform, Submit} from './AdminUI';

const ACTIVITY_KINDS = ['Hội thảo', 'Giải thưởng khoa học', 'Hợp tác', 'Đào tạo – tập huấn', 'Hội thi'];
type Props = {role: string; busy: boolean; perform: Perform};

export default function ActivitiesManager({role, busy, perform}: Props) {
  const [items, setItems] = useState<Activity[]>([]);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [formKey, setFormKey] = useState(0);
  const isAdmin = role === 'admin';
  const load = useCallback(async () => {setItems(await clientApi<Activity[]>('/admin/activities'));}, []);
  useEffect(() => {void load().catch(() => undefined);}, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const body = {title: String(f.get('title')).trim(), kind: String(f.get('kind')).trim(), activity_date: String(f.get('activity_date')), location: String(f.get('location') || '').trim(), summary: String(f.get('summary') || '').trim(), body_html: String(f.get('body_html') || ''), external_url: String(f.get('external_url') || '').trim()};
    const ok = await perform(async () => {
      if (editing) await clientApi(`/admin/activities/${editing.id}`, {method: 'PATCH', body: JSON.stringify(body)});
      else await clientApi('/admin/activities', {method: 'POST', body: JSON.stringify(body)});
      await load();
    }, editing ? 'Đã lưu hoạt động.' : 'Đã tạo hoạt động (bản nháp).');
    if (ok) {setEditing(null); setFormKey(k => k + 1);}
  }
  const act = (a: Activity, action: 'publish' | 'unpublish') => perform(async () => {await clientApi(`/admin/activities/${a.id}/${action}`, {method: 'POST'}); await load();}, action === 'publish' ? 'Đã xuất bản hoạt động.' : 'Đã thu hồi hoạt động.');
  const remove = (a: Activity) => {
    if (window.confirm(`Xóa vĩnh viễn “${a.title}”? Thao tác này không thể hoàn tác.`)) void perform(async () => {await clientApi(`/admin/activities/${a.id}`, {method: 'DELETE'}); await load();}, 'Đã xóa hoạt động.');
  };

  return <div className="admin-two-columns create">
    <section className="admin-panel"><p className="admin-kicker">{editing ? 'SỬA HOẠT ĐỘNG' : 'HOẠT ĐỘNG MỚI'}</p><h2>{editing ? editing.title : 'Thêm hoạt động'}</h2>
      <form key={`${editing?.id ?? 'new'}-${formKey}`} onSubmit={save}><fieldset disabled={busy}>
        <Field label="Tiêu đề *"><input name="title" required minLength={2} maxLength={600} defaultValue={editing?.title}/></Field>
        <div className="admin-form-grid"><Field label="Loại *"><input name="kind" list="activity-kinds" required maxLength={100} defaultValue={editing?.kind ?? ACTIVITY_KINDS[0]}/></Field>
          <Field label="Ngày *"><input name="activity_date" type="date" required defaultValue={editing?.activity_date ?? new Date().toISOString().slice(0, 10)}/></Field></div>
        <datalist id="activity-kinds">{ACTIVITY_KINDS.map(t => <option key={t} value={t}/>)}</datalist>
        <Field label="Địa điểm"><input name="location" maxLength={300} defaultValue={editing?.location}/></Field>
        <Field label="Tóm tắt" hint="Hiển thị ở danh sách và trang chủ."><textarea name="summary" rows={2} defaultValue={editing?.summary}/></Field>
        <Field label="Nội dung (HTML)" hint="Chỉ giữ các thẻ an toàn."><textarea name="body_html" rows={7} defaultValue={editing?.body_html}/></Field>
        <Field label="Liên kết nguồn" hint="Bắt đầu bằng http:// hoặc https://. Cần có tóm tắt, nội dung hoặc liên kết trước khi xuất bản."><input name="external_url" type="url" maxLength={1000} defaultValue={editing?.external_url}/></Field>
        <div className="admin-form-footer"><Submit busy={busy}>{editing ? <><Pencil size={16}/> Lưu thay đổi</> : <><Plus size={16}/> Tạo bản nháp</>}</Submit>{editing && <button type="button" className="admin-secondary" onClick={() => {setEditing(null); setFormKey(k => k + 1);}}>Hủy sửa</button>}</div>
      </fieldset></form></section>
    <section className="admin-panel"><div className="admin-panel-title"><div><h2>Danh sách hoạt động</h2><p>{items.length} hoạt động</p></div></div>
      {items.length ? items.map(a => <article className="admin-job" key={a.id}><strong>{a.title}</strong><div><Badge status={a.status || 'draft'}/><span>{a.kind} · {new Date(a.activity_date).toLocaleDateString('vi-VN')}</span></div>
        <div className="admin-actions"><button className="admin-secondary" disabled={busy} onClick={() => setEditing(a)}><Pencil size={15}/> Sửa</button>
          {isAdmin && (a.status === 'published' ? <button className="admin-secondary" disabled={busy} onClick={() => act(a, 'unpublish')}><EyeOff size={15}/> Thu hồi</button> : <button className="admin-primary" disabled={busy} onClick={() => act(a, 'publish')}><Eye size={15}/> Xuất bản</button>)}
          {isAdmin && <button className="admin-danger" disabled={busy} onClick={() => remove(a)}><Trash2 size={15}/> Xóa</button>}</div></article>) : <p className="admin-muted">Chưa có hoạt động nào.</p>}
      {!isAdmin && <p className="admin-muted">Chỉ quản trị viên có quyền xuất bản, thu hồi và xóa.</p>}
    </section></div>;
}
