'use client';
import {useCallback, useEffect, useState} from 'react';
import {Eye, EyeOff, Pencil, Plus, Trash2, Upload} from 'lucide-react';
import {DocItem, Notice, clientApi, mediaUrl} from '@/lib/api';
import ActivitiesManager from './ActivitiesManager';
import {Badge, Field, Perform, Submit} from './AdminUI';

const DOC_TYPES = ['QUY ĐỊNH', 'HƯỚNG DẪN', 'QUY TẮC', 'QUY TRÌNH', 'BIỂU MẪU'];
const NOTICE_TAGS = ['THÔNG BÁO', 'THƯ MỜI', 'HỘI THI', 'GIẢI THƯỞNG', 'TẬP HUẤN'];
type Props = {kind: 'documents' | 'notices' | 'activities'; role: string; busy: boolean; perform: Perform};

export default function ContentManager({kind, role, busy, perform}: Props) {
  if (kind === 'documents') return <Documents role={role} busy={busy} perform={perform}/>;
  if (kind === 'activities') return <ActivitiesManager role={role} busy={busy} perform={perform}/>;
  return <Notices role={role} busy={busy} perform={perform}/>;
}

type Inner = Omit<Props, 'kind'>;
const confirmDelete = (name: string) => window.confirm(`Xóa vĩnh viễn “${name}”? Thao tác này không thể hoàn tác.`);

function Documents({role, busy, perform}: Inner) {
  const [items, setItems] = useState<DocItem[]>([]);
  const [editing, setEditing] = useState<DocItem | null>(null);
  const [formKey, setFormKey] = useState(0);
  const isAdmin = role === 'admin';
  const load = useCallback(async () => {setItems(await clientApi<DocItem[]>('/admin/documents'));}, []);
  useEffect(() => {void load().catch(() => undefined);}, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const body = {title: String(f.get('title')).trim(), doc_type: String(f.get('doc_type')).trim(), description: String(f.get('description') || '').trim(), external_url: String(f.get('external_url') || '').trim()};
    const file = f.get('file');
    const ok = await perform(async () => {
      const saved = editing ? await clientApi<DocItem>(`/admin/documents/${editing.id}`, {method: 'PATCH', body: JSON.stringify(body)}) : await clientApi<DocItem>('/admin/documents', {method: 'POST', body: JSON.stringify(body)});
      if (file instanceof File && file.size) {
        const upload = new FormData();
        upload.append('file', file);
        await clientApi(`/admin/documents/${saved.id}/file`, {method: 'POST', body: upload});
      }
      await load();
    }, editing ? 'Đã lưu tài liệu.' : 'Đã tạo tài liệu (bản nháp).');
    if (ok) {setEditing(null); setFormKey(k => k + 1);}
  }
  const act = (d: DocItem, action: 'publish' | 'unpublish') => perform(async () => {await clientApi(`/admin/documents/${d.id}/${action}`, {method: 'POST'}); await load();}, action === 'publish' ? 'Đã xuất bản tài liệu.' : 'Đã thu hồi tài liệu.');
  const remove = (d: DocItem) => {if (confirmDelete(d.title)) void perform(async () => {await clientApi(`/admin/documents/${d.id}`, {method: 'DELETE'}); await load();}, 'Đã xóa tài liệu.');};

  return <div className="admin-two-columns create">
    <section className="admin-panel"><p className="admin-kicker">{editing ? 'SỬA TÀI LIỆU' : 'TÀI LIỆU MỚI'}</p><h2>{editing ? editing.title : 'Thêm tài liệu'}</h2>
      <form key={`${editing?.id ?? 'new'}-${formKey}`} onSubmit={save}><fieldset disabled={busy}>
        <Field label="Tiêu đề *"><input name="title" required minLength={2} maxLength={500} defaultValue={editing?.title}/></Field>
        <Field label="Loại *"><input name="doc_type" list="doc-types" required maxLength={60} defaultValue={editing?.doc_type ?? DOC_TYPES[0]}/></Field>
        <datalist id="doc-types">{DOC_TYPES.map(t => <option key={t} value={t}/>)}</datalist>
        <Field label="Mô tả"><textarea name="description" rows={3} defaultValue={editing?.description}/></Field>
        <Field label="Tệp đính kèm" hint={editing?.file_name ? `Hiện có: ${editing.file_name}. Chọn tệp mới để thay thế.` : 'PDF, Word hoặc Excel, tối đa 20 MB.'}><input type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx"/></Field>
        <Field label="Hoặc liên kết ngoài" hint="Bắt đầu bằng http:// hoặc https://. Cần có tệp hoặc liên kết trước khi xuất bản."><input name="external_url" type="url" maxLength={1000} defaultValue={editing?.external_url}/></Field>
        <div className="admin-form-footer"><Submit busy={busy}>{editing ? <><Pencil size={16}/> Lưu thay đổi</> : <><Plus size={16}/> Tạo bản nháp</>}</Submit>{editing && <button type="button" className="admin-secondary" onClick={() => {setEditing(null); setFormKey(k => k + 1);}}>Hủy sửa</button>}</div>
      </fieldset></form></section>
    <section className="admin-panel"><div className="admin-panel-title"><div><h2>Danh sách tài liệu</h2><p>{items.length} tài liệu</p></div></div>
      {items.length ? items.map(d => <article className="admin-job" key={d.id}><strong>{d.title}</strong><div><Badge status={d.status || 'draft'}/><span>{d.doc_type}</span></div>
        <p>{d.file_key ? <a className="admin-text-button" href={mediaUrl(d.file_key)} target="_blank" rel="noopener noreferrer"><Upload size={14}/> {d.file_name || 'Tệp đính kèm'}</a> : d.external_url || 'Chưa có tệp hoặc liên kết'}</p>
        <div className="admin-actions"><button className="admin-secondary" disabled={busy} onClick={() => setEditing(d)}><Pencil size={15}/> Sửa</button>
          {isAdmin && (d.status === 'published' ? <button className="admin-secondary" disabled={busy} onClick={() => act(d, 'unpublish')}><EyeOff size={15}/> Thu hồi</button> : <button className="admin-primary" disabled={busy} onClick={() => act(d, 'publish')}><Eye size={15}/> Xuất bản</button>)}
          {isAdmin && <button className="admin-danger" disabled={busy} onClick={() => remove(d)}><Trash2 size={15}/> Xóa</button>}</div></article>) : <p className="admin-muted">Chưa có tài liệu nào.</p>}
      {!isAdmin && <p className="admin-muted">Chỉ quản trị viên có quyền xuất bản, thu hồi và xóa.</p>}
    </section></div>;
}

function Notices({role, busy, perform}: Inner) {
  const [items, setItems] = useState<Notice[]>([]);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [formKey, setFormKey] = useState(0);
  const isAdmin = role === 'admin';
  const load = useCallback(async () => {setItems(await clientApi<Notice[]>('/admin/notices'));}, []);
  useEffect(() => {void load().catch(() => undefined);}, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const body = {title: String(f.get('title')).trim(), tag: String(f.get('tag')).trim(), summary: String(f.get('summary') || '').trim(), body_html: String(f.get('body_html') || ''), notice_date: String(f.get('notice_date')), is_pinned: f.get('is_pinned') === 'on'};
    const ok = await perform(async () => {
      if (editing) await clientApi(`/admin/notices/${editing.id}`, {method: 'PATCH', body: JSON.stringify(body)});
      else await clientApi('/admin/notices', {method: 'POST', body: JSON.stringify(body)});
      await load();
    }, editing ? 'Đã lưu thông báo.' : 'Đã tạo thông báo (bản nháp).');
    if (ok) {setEditing(null); setFormKey(k => k + 1);}
  }
  const act = (n: Notice, action: 'publish' | 'unpublish') => perform(async () => {await clientApi(`/admin/notices/${n.id}/${action}`, {method: 'POST'}); await load();}, action === 'publish' ? 'Đã xuất bản thông báo.' : 'Đã thu hồi thông báo.');
  const remove = (n: Notice) => {if (confirmDelete(n.title)) void perform(async () => {await clientApi(`/admin/notices/${n.id}`, {method: 'DELETE'}); await load();}, 'Đã xóa thông báo.');};

  return <div className="admin-two-columns create">
    <section className="admin-panel"><p className="admin-kicker">{editing ? 'SỬA THÔNG BÁO' : 'THÔNG BÁO MỚI'}</p><h2>{editing ? editing.title : 'Soạn thông báo'}</h2>
      <form key={`${editing?.id ?? 'new'}-${formKey}`} onSubmit={save}><fieldset disabled={busy}>
        <Field label="Tiêu đề *"><input name="title" required minLength={2} maxLength={600} defaultValue={editing?.title}/></Field>
        <div className="admin-form-grid"><Field label="Nhãn *"><input name="tag" list="notice-tags" required maxLength={60} defaultValue={editing?.tag ?? NOTICE_TAGS[0]}/></Field>
          <Field label="Ngày *"><input name="notice_date" type="date" required defaultValue={editing?.notice_date ?? new Date().toISOString().slice(0, 10)}/></Field></div>
        <datalist id="notice-tags">{NOTICE_TAGS.map(t => <option key={t} value={t}/>)}</datalist>
        <Field label="Tóm tắt" hint="Hiển thị ở danh sách thông báo."><textarea name="summary" rows={2} defaultValue={editing?.summary}/></Field>
        <Field label="Nội dung (HTML)" hint="Chỉ giữ các thẻ an toàn (đoạn văn, tiêu đề, danh sách, liên kết, bảng, ảnh)."><textarea name="body_html" rows={8} defaultValue={editing?.body_html}/></Field>
        <label className="admin-field"><span><input type="checkbox" name="is_pinned" defaultChecked={editing?.is_pinned}/> Ghim lên đầu danh sách</span></label>
        <div className="admin-form-footer"><Submit busy={busy}>{editing ? <><Pencil size={16}/> Lưu thay đổi</> : <><Plus size={16}/> Tạo bản nháp</>}</Submit>{editing && <button type="button" className="admin-secondary" onClick={() => {setEditing(null); setFormKey(k => k + 1);}}>Hủy sửa</button>}</div>
      </fieldset></form></section>
    <section className="admin-panel"><div className="admin-panel-title"><div><h2>Danh sách thông báo</h2><p>{items.length} thông báo</p></div></div>
      {items.length ? items.map(n => <article className="admin-job" key={n.id}><strong>{n.title}</strong><div><Badge status={n.status || 'draft'}/><span>{n.tag} · {new Date(n.notice_date).toLocaleDateString('vi-VN')}{n.is_pinned ? ' · Ghim' : ''}</span></div>
        <div className="admin-actions"><button className="admin-secondary" disabled={busy} onClick={() => setEditing(n)}><Pencil size={15}/> Sửa</button>
          {isAdmin && (n.status === 'published' ? <button className="admin-secondary" disabled={busy} onClick={() => act(n, 'unpublish')}><EyeOff size={15}/> Thu hồi</button> : <button className="admin-primary" disabled={busy} onClick={() => act(n, 'publish')}><Eye size={15}/> Xuất bản</button>)}
          {isAdmin && <button className="admin-danger" disabled={busy} onClick={() => remove(n)}><Trash2 size={15}/> Xóa</button>}</div></article>) : <p className="admin-muted">Chưa có thông báo nào.</p>}
      {!isAdmin && <p className="admin-muted">Chỉ quản trị viên có quyền xuất bản, thu hồi và xóa.</p>}
    </section></div>;
}
