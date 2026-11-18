import Link from 'next/link';
import {Pin} from 'lucide-react';
import {serverApi, Notice, PageData} from '@/lib/api';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Thông báo của tòa soạn'};
const LIMIT = 12;

export default async function NoticesPage({searchParams}: {searchParams: Promise<{page?: string}>}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1') || 1);
  let data: PageData<Notice> = {items: [], total: 0, page, limit: LIMIT};
  let failed = false;
  try {data = await serverApi<PageData<Notice>>(`/notices?page=${page}&limit=${LIMIT}`);} catch {failed = true;}
  const pages = Math.ceil(data.total / LIMIT);
  return <div className="container-width py-14 max-w-4xl">
    <p className="eyebrow mb-3">THÔNG BÁO CỦA TÒA SOẠN</p>
    <h1 className="section-title">Thông báo</h1>
    <p className="text-slate-600 mt-4 mb-8">Thư mời viết bài, hội thi, giải thưởng, tập huấn và các thông báo mới của Ban biên tập.</p>
    {data.items.length ? <ul className="bg-white border divide-y">{data.items.map(n =>
      <li key={n.id}><Link href={`/thong-bao/${n.slug}`} className="block p-6 hover:bg-slate-50">
        <div className="flex flex-wrap items-center gap-3 text-sm"><span className="eyebrow text-xs">{n.tag}</span><time className="text-slate-500" dateTime={n.notice_date}>{new Date(n.notice_date).toLocaleDateString('vi-VN')}</time>{n.is_pinned && <span className="inline-flex items-center gap-1 text-brand"><Pin size={14}/> Ghim</span>}</div>
        <h2 className="font-serif font-bold text-xl mt-2">{n.title}</h2>
        {n.summary && <p className="text-slate-600 mt-2 leading-7">{n.summary}</p>}
      </Link></li>)}</ul> : <p className="bg-white border p-8 text-slate-500" role="status">{failed ? 'Chưa thể tải thông báo. Vui lòng thử lại sau.' : 'Chưa có thông báo nào.'}</p>}
    {pages > 1 && <nav className="flex gap-2 mt-8" aria-label="Phân trang">{Array.from({length: pages}, (_, i) => <Link key={i} href={`/thong-bao?page=${i + 1}`} className={`px-4 py-2 border ${page === i + 1 ? 'bg-brand text-white' : 'bg-white'}`}>{i + 1}</Link>)}</nav>}
  </div>;
}
