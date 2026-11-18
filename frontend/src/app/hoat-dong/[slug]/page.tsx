import Link from 'next/link';
import {ArrowLeft, ExternalLink, MapPin} from 'lucide-react';
import {serverApi, Activity} from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  try {return {title: (await serverApi<Activity>(`/activities/${encodeURIComponent(slug)}`)).title};} catch {return {title: 'Hoạt động'};}
}

export default async function ActivityPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  let a: Activity;
  try {a = await serverApi<Activity>(`/activities/${encodeURIComponent(slug)}`);} catch {return <div className="container-width py-20">Không tìm thấy hoạt động.</div>;}
  return <div className="container-width py-14"><div className="max-w-[820px] mx-auto">
    <nav className="text-sm text-slate-500 flex gap-2 mb-8"><Link href="/">Trang chủ</Link><span>/</span><Link className="text-brand" href="/hoat-dong">Hoạt động</Link></nav>
    <p className="eyebrow mb-4">{a.kind} · <time dateTime={a.activity_date}>{new Date(a.activity_date).toLocaleDateString('vi-VN')}</time></p>
    <h1 className="font-serif font-bold text-3xl sm:text-4xl leading-[1.2]">{a.title}</h1>
    {a.location && <p className="flex items-center gap-2 text-slate-500 mt-4"><MapPin size={16}/> {a.location}</p>}
    {a.summary && <p className="text-lg text-slate-600 leading-8 mt-5">{a.summary}</p>}
    {a.body_html && <div className="prose-article mt-8" dangerouslySetInnerHTML={{__html: a.body_html}}/>}
    {a.external_url && <p className="mt-8"><a className="btn-outline" href={a.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> Xem nguồn</a></p>}
    <div className="border-t mt-12 pt-6"><Link className="text-brand flex items-center gap-2 font-semibold" href="/hoat-dong"><ArrowLeft size={17}/> Tất cả hoạt động</Link></div>
  </div></div>;
}
