import type {ReactNode} from 'react';
import {Check, Circle, LoaderCircle} from 'lucide-react';

export function Field({label, hint, children}: {label: string; hint?: string; children: ReactNode}) {
 return <label className="admin-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function Submit({busy, children}: {busy: boolean; children: ReactNode}) {
 return <button className="admin-primary" disabled={busy} type="submit">{busy && <LoaderCircle size={16} className="animate-spin"/>}{busy ? 'Đang xử lý…' : children}</button>;
}
export function Badge({status}: {status: string}) {
 const labels: Record<string,string> = {draft:'Bản nháp', published:'Đã xuất bản', uploaded:'Đang chờ', processing:'Đang phân tích', needs_review:'Chờ kiểm tra', failed:'Thất bại'};
 return <span className={`admin-badge ${status}`}>{labels[status] || status}</span>;
}
export function CheckItem({done, children}: {done: boolean; children: ReactNode}) {
 return <li className={done ? 'complete' : ''}>{done ? <Check size={18}/> : <Circle size={18}/>}<span>{children}</span></li>;
}
export type Perform = (work: () => Promise<void>, message: string) => Promise<boolean>;
export const fileLimit = 60 * 1024 * 1024;
export function validatePdf(form: FormData) {
 const file = form.get('file');
 if (!(file instanceof File) || !file.size) throw new Error('Vui lòng chọn file PDF.');
 if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Chỉ hỗ trợ file PDF.');
 if (file.size > fileLimit) throw new Error('File PDF không được vượt quá 60 MB.');
}
