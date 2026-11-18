import {serverApi,Issue,PageData} from '@/lib/api';
import {IssueCard} from '@/components/Cards';
import Link from 'next/link';
export const dynamic='force-dynamic';
export const metadata={title:'Kho đặc san'};
export default async function Issues({searchParams}:{searchParams:Promise<{page?:string;year?:string}>}){
 const p=await searchParams;const page=Math.max(1,parseInt(p.page||'1')||1);
 const year=p.year||'';
 let data:PageData<Issue>={items:[],total:0,page,limit:12};
 try{data=await serverApi<PageData<Issue>>(`/issues?page=${page}&limit=12${year?`&year=${encodeURIComponent(year)}`:''}`)}catch{}
 const totalPages=Math.ceil(data.total/data.limit);
 return <div className="container-width py-14"><p className="eyebrow mb-3">LƯU TRỮ ẤN PHẨM</p><h1 className="section-title">Kho đặc san</h1><p className="text-slate-600 mt-4 mb-11">Khám phá các số Đặc san Khoa học & Phát triển. Chọn bìa để xem mục lục và đọc PDF.</p>
 <div className="flex gap-3 mb-8"><Link href="/issues" className={`px-4 py-2 border text-sm ${!year?'bg-brand text-white':'bg-white'}`}>Tất cả</Link><Link href="/issues?year=2026" className={`px-4 py-2 border text-sm ${year==='2026'?'bg-brand text-white':'bg-white'}`}>2026</Link></div>
 {data.items.length?<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">{data.items.map(i=><IssueCard key={i.id} issue={i}/>)}</div>:<p className="bg-white border p-8 text-slate-500">Không có số đặc san phù hợp.</p>}
 {totalPages>1&&<nav className="flex gap-2 mt-10">{Array.from({length:totalPages},(_,i)=><Link key={i} href={`/issues?page=${i+1}${year?'&year='+year:''}`} className={`px-4 py-2 border ${page===i+1?'bg-brand text-white':'bg-white'}`}>{i+1}</Link>)}</nav>}</div>
}
