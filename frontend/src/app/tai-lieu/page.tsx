import Link from 'next/link';
import {Download, ExternalLink, FileText} from 'lucide-react';
import {serverApi, mediaUrl, DocumentList} from '@/lib/api';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Tư liệu – Văn bản pháp quy'};

export default async function DocumentsPage({searchParams}: {searchParams: Promise<{type?: string}>}) {
  const sp = await searchParams;
  const type = (sp.type || '').slice(0, 60);
  let data: DocumentList = {items: [], types: []};
  let failed = false;
  try {data = await serverApi<DocumentList>(`/documents${type ? `?doc_type=${encodeURIComponent(type)}` : ''}`);} catch {failed = true;}
  return <div className="container-width py-14 max-w-5xl">
    <p className="eyebrow mb-3">TƯ LIỆU – VĂN BẢN PHÁP QUY</p>
    <h1 className="section-title">Quy định xuất bản, hướng dẫn gửi bài và đạo đức công bố</h1>
    <p className="text-slate-600 mt-4 mb-8">Các văn bản, biểu mẫu và hướng dẫn dành cho tác giả, phản biện và bạn đọc của Đặc san.</p>
    {data.types.length > 0 && <div className="flex flex-wrap gap-3 mb-8" aria-label="Lọc theo loại">
      <Link href="/tai-lieu" className={`px-4 py-2 border text-sm ${!type ? 'bg-brand text-white' : 'bg-white'}`}>Tất cả</Link>
      {data.types.map(t => <Link key={t} href={`/tai-lieu?type=${encodeURIComponent(t)}`} className={`px-4 py-2 border text-sm ${type === t ? 'bg-brand text-white' : 'bg-white'}`}>{t}</Link>)}
    </div>}
    {data.items.length ? <ul className="bg-white border divide-y">{data.items.map(d => {
      const href = d.file_key ? mediaUrl(d.file_key) : d.external_url;
      return <li key={d.id} className="p-6 flex flex-wrap gap-4 items-start justify-between">
        <div className="flex gap-4 min-w-0 flex-1"><FileText className="text-brand shrink-0 mt-1" size={24}/><div className="min-w-0">
          <span className="eyebrow text-xs">{d.doc_type}</span>
          <h2 className="font-serif font-bold text-xl mt-1">{d.title}</h2>
          {d.description && <p className="text-slate-600 mt-2 leading-7">{d.description}</p>}
          <p className="text-slate-400 text-sm mt-2">Cập nhật {d.updated_at ? new Date(d.updated_at).toLocaleDateString('vi-VN') : ''}</p>
        </div></div>
        {href && <a className="btn-outline" href={href} target="_blank" rel="noopener noreferrer">{d.file_key ? <><Download size={17}/> Tải về</> : <><ExternalLink size={17}/> Mở liên kết</>}</a>}
      </li>;
    })}</ul> : <p className="bg-white border p-8 text-slate-500" role="status">{failed ? 'Chưa thể tải danh sách tài liệu. Vui lòng thử lại sau.' : 'Chưa có tài liệu nào được công bố.'}</p>}
  </div>;
}
