import Link from 'next/link';
import {MapPin} from 'lucide-react';
import {serverApi, ActivityList} from '@/lib/api';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Hoạt động của Liên hiệp Hội'};
const LIMIT = 12;

export default async function ActivitiesPage({searchParams}: {searchParams: Promise<{page?: string; kind?: string}>}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1') || 1);
  const kind = (sp.kind || '').slice(0, 100);
  let data: ActivityList = {items: [], total: 0, page, limit: LIMIT, kinds: []};
  let failed = false;
  try {data = await serverApi<ActivityList>(`/activities?page=${page}&limit=${LIMIT}${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`);} catch {failed = true;}
  const pages = Math.ceil(data.total / LIMIT);
  const q = kind ? `&kind=${encodeURIComponent(kind)}` : '';
  return <div className="container-width py-14 max-w-4xl">
    <p className="eyebrow mb-3">HOẠT ĐỘNG NỔI BẬT CỦA LHHĐN</p>
    <h1 className="section-title">Hoạt động</h1>
    <p className="text-slate-600 mt-4 mb-8">Hội thảo, giải thưởng, hợp tác và đào tạo của Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng.</p>
    {data.kinds.length > 0 && <div className="flex flex-wrap gap-3 mb-8" aria-label="Lọc theo loại hoạt động">
      <Link href="/hoat-dong" className={`px-4 py-2 border text-sm ${!kind ? 'bg-brand text-white' : 'bg-white'}`}>Tất cả</Link>
      {data.kinds.map(k => <Link key={k} href={`/hoat-dong?kind=${encodeURIComponent(k)}`} className={`px-4 py-2 border text-sm ${kind === k ? 'bg-brand text-white' : 'bg-white'}`}>{k}</Link>)}
    </div>}
    {data.items.length ? <ul className="bg-white border divide-y">{data.items.map(a =>
      <li key={a.id}><Link href={`/hoat-dong/${a.slug}`} className="block p-6 hover:bg-slate-50">
        <div className="flex flex-wrap items-center gap-3 text-sm"><time className="text-slate-500" dateTime={a.activity_date}>{new Date(a.activity_date).toLocaleDateString('vi-VN')}</time><span className="eyebrow text-xs">{a.kind}</span>{a.location && <span className="inline-flex items-center gap-1 text-slate-500"><MapPin size={14}/> {a.location}</span>}</div>
        <h2 className="font-serif font-bold text-xl mt-2">{a.title}</h2>
        {a.summary && <p className="text-slate-600 mt-2 leading-7">{a.summary}</p>}
      </Link></li>)}</ul> : <p className="bg-white border p-8 text-slate-500" role="status">{failed ? 'Chưa thể tải danh sách hoạt động. Vui lòng thử lại sau.' : 'Chưa có hoạt động nào được công bố.'}</p>}
    {pages > 1 && <nav className="flex gap-2 mt-8" aria-label="Phân trang">{Array.from({length: pages}, (_, i) => <Link key={i} href={`/hoat-dong?page=${i + 1}${q}`} className={`px-4 py-2 border ${page === i + 1 ? 'bg-brand text-white' : 'bg-white'}`}>{i + 1}</Link>)}</nav>}
  </div>;
}
