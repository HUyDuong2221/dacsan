import Link from 'next/link';
import {Search as SearchIcon,ArrowRight} from 'lucide-react';
import {serverApi,PageData,Article} from '@/lib/api';
import {ArticleCard} from '@/components/Cards';
export const dynamic='force-dynamic';
export const metadata={title:'Tra cứu bài viết'};
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const sp=await searchParams;const q=(sp.q||'').slice(0,200);const page=Math.max(1,Number(sp.page)||1);let data:PageData<Article>={items:[],page:1,total:0,limit:20};
 if(q){try{data=await serverApi<PageData<Article>>(`/search?q=${encodeURIComponent(q)}&page=${page}`)}catch{}}
 const max=Math.ceil(data.total/20);
 return <div className="container-width py-16 max-w-5xl"><p className="eyebrow mb-3">TRA CỨU TRI THỨC</p><h1 className="section-title">Tìm kiếm bài viết</h1><p className="text-slate-500 mt-3 mb-8">Tìm theo tiêu đề, tác giả hoặc nội dung đã trích xuất từ các số đặc san.</p><form className="flex gap-2" action="/search" method="get"><div className="relative flex-1"><SearchIcon className="absolute top-3.5 left-4 text-slate-400" size={20}/><input className="field pl-12 py-3.5" name="q" defaultValue={q} placeholder="Ví dụ: chuyển đổi số, Đà Nẵng, Lê Tùng Lâm…"/></div><button className="btn-primary">Tìm kiếm</button></form>
 {q?<div className="mt-10"><p className="text-sm font-semibold text-slate-600 mb-3">Tìm thấy {data.total} kết quả cho “{q}”</p><div className="bg-white border p-6 sm:p-8">{data.items.length?data.items.map(a=><ArticleCard key={a.id} article={a}/>):<p className="text-slate-500">Không tìm thấy kết quả. Hãy thử từ khóa khác.</p>}</div>{max>1&&<div className="flex flex-wrap mt-5 gap-2">{Array.from({length:Math.min(max,10)},(_,i)=><Link key={i} className={`px-3 py-2 border ${page===i+1?'bg-brand text-white':'bg-white'}`} href={`/search?q=${encodeURIComponent(q)}&page=${i+1}`}>{i+1}</Link>)}</div>}</div>:<div className="grid sm:grid-cols-3 gap-4 mt-12">{['Khoa học và công nghệ','Phát triển Đà Nẵng','Lịch sử và văn hóa'].map(x=><Link href={`/search?q=${encodeURIComponent(x)}`} key={x} className="border bg-white p-6 hover:shadow"><h3 className="font-serif font-bold text-lg">{x}</h3><span className="text-brand text-sm mt-3 flex gap-1">Khám phá <ArrowRight size={15}/></span></Link>)}</div>}
 </div>
}
