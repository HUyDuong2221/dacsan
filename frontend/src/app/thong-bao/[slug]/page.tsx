import Link from 'next/link';
import {ArrowLeft} from 'lucide-react';
import {serverApi, Notice} from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  try {return {title: (await serverApi<Notice>(`/notices/${encodeURIComponent(slug)}`)).title};} catch {return {title: 'Thông báo'};}
}

export default async function NoticePage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  let n: Notice;
  try {n = await serverApi<Notice>(`/notices/${encodeURIComponent(slug)}`);} catch {return <div className="container-width py-20">Không tìm thấy thông báo.</div>;}
  return <div className="container-width py-14"><div className="max-w-[820px] mx-auto">
    <nav className="text-sm text-slate-500 flex gap-2 mb-8"><Link href="/">Trang chủ</Link><span>/</span><Link className="text-brand" href="/thong-bao">Thông báo</Link></nav>
    <p className="eyebrow mb-4">{n.tag} · <time dateTime={n.notice_date}>{new Date(n.notice_date).toLocaleDateString('vi-VN')}</time></p>
    <h1 className="font-serif font-bold text-3xl sm:text-4xl leading-[1.2]">{n.title}</h1>
    {n.summary && <p className="text-lg text-slate-600 leading-8 mt-5">{n.summary}</p>}
    {n.body_html && <div className="prose-article mt-8" dangerouslySetInnerHTML={{__html: n.body_html}}/>}
    <div className="border-t mt-12 pt-6"><Link className="text-brand flex items-center gap-2 font-semibold" href="/thong-bao"><ArrowLeft size={17}/> Tất cả thông báo</Link></div>
  </div></div>;
}
