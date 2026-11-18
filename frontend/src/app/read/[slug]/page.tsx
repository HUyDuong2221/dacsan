import Link from 'next/link';
import {serverApi,Issue,mediaUrl} from '@/lib/api';
import PdfClient from '@/components/PdfClient';
export const dynamic='force-dynamic';
export default async function ReadIssue({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{page?:string}>}){
 const [{slug},sp]=await Promise.all([params,searchParams]);let issue:Issue;
 try{issue=await serverApi<Issue>(`/issues/${encodeURIComponent(slug)}`)}catch{return <div className="container-width py-20">Không tìm thấy đặc san.</div>}
 let requested=Math.max(1,Number(sp.page)||1);requested=Math.min(requested,issue.page_count);
 return <div className="container-width py-8"><div className="flex gap-3 items-center justify-between mb-5 flex-wrap"><div><p className="eyebrow">ĐỌC ĐẶC SAN</p><h1 className="font-serif text-2xl font-bold">{issue.title} ({issue.month}-{issue.year})</h1></div><Link href={`/issues/${issue.slug}`} className="text-brand font-semibold text-sm">← Về mục lục</Link></div>
 {issue.pdf_key?<PdfClient url={mediaUrl(issue.pdf_key)} initialPage={requested} issueTitle={issue.title}/>:<p>Chưa có file PDF cho số này.</p>}
 <p className="text-xs mt-3 text-slate-500">Nội dung và bố cục trong PDF được giữ nguyên như bản in gốc. Trang trong PDF có thể khác với số trang in đối với các số khác.</p></div>
}
