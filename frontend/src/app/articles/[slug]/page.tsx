import Link from 'next/link';
import {ArrowLeft,BookOpen,FileWarning,MoveUpRight} from 'lucide-react';
import {serverApi,Article} from '@/lib/api';
import ArticleTools from '@/components/ArticleTools';
export const dynamic='force-dynamic';
export default async function ArticlePage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;let a:Article;
 try{a=await serverApi<Article>(`/articles/${encodeURIComponent(slug)}`)}catch{return <div className="container-width py-20">Không tìm thấy bài viết.</div>}
 const citeIssue=a.issue_title;
 return <div className="container-width py-14"><nav className="text-sm text-slate-500 flex gap-2 flex-wrap mb-10"><Link href="/">Trang chủ</Link><span>/</span><Link className="text-brand" href={`/issues/${a.issue_slug}`}>{a.issue_title}</Link><span>/</span><span>Bài viết</span></nav><div className="max-w-[880px] mx-auto"><p className="eyebrow mb-5">{a.section_name}</p><h1 className="font-serif font-bold text-4xl sm:text-5xl tracking-tight leading-[1.17]">{a.title}</h1><div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 mt-7 pb-7 border-b"><span className="font-semibold text-ink">{a.author_display}</span><span>Trang {a.print_page_start}–{a.print_page_end}</span><span>{a.issue_title}</span></div>
 {a.full_text_verified&&a.body_html?<ArticleTools title={a.title} author={a.author_display} issue={citeIssue}><div dangerouslySetInnerHTML={{__html:a.body_html}}/></ArticleTools>:<div className="bg-[#f1f5fb] p-7 sm:p-10 rounded-sm border-l-4 border-brand my-9"><FileWarning size={33} className="text-brand mb-4"/><h2 className="font-serif text-2xl font-bold">Nội dung toàn văn đang được hiệu đính</h2><p className="text-slate-600 mt-3 leading-7">Thông tin mục lục được trích xuất từ bản in. Nội dung bài chưa được kiểm tra đầy đủ thứ tự cột, dấu tiếng Việt và hình ảnh, vì vậy chưa công bố toàn văn HTML. Bạn có thể đọc nguyên bản trong PDF.</p><Link href={`/read/${a.issue_slug}?page=${a.pdf_page_start}`} className="btn-primary mt-6"><BookOpen size={17}/> Đọc từ trang {a.pdf_page_start} của PDF</Link></div>}
 <div className="flex flex-wrap justify-between items-center gap-4 border-t mt-12 pt-6"><Link className="text-brand flex items-center gap-2 font-semibold" href={`/issues/${a.issue_slug}`}><ArrowLeft size={17}/> Về mục lục đặc san</Link><Link className="btn-outline" href={`/read/${a.issue_slug}?page=${a.pdf_page_start}`}><MoveUpRight size={18}/> Xem trang PDF gốc</Link></div></div></div>
}
