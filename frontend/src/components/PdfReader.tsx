'use client';
import {useState} from 'react';
import {Document,Page,pdfjs} from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {ChevronLeft,ChevronRight,Download,Maximize2,Minus,Plus} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).toString();

export default function PdfReader({url,initialPage,issueTitle}:{url:string;initialPage:number;issueTitle:string}){
 const [page,setPage]=useState(Math.max(1,initialPage));const [pages,setPages]=useState(0);const [scale,setScale]=useState(1);
 const clamp=(n:number)=>Math.min(Math.max(n,1),pages||999);
 return <section className="rounded border border-slate-300 bg-[#e4e6eb] overflow-hidden"><div className="flex items-center justify-between flex-wrap gap-2 bg-ink text-white p-3"><div className="text-xs sm:text-sm font-semibold truncate max-w-[260px]">{issueTitle}</div><div className="flex gap-2 items-center"><button aria-label="Trang trước" disabled={page===1} onClick={()=>setPage(p=>clamp(p-1))} className="p-1 disabled:opacity-40"><ChevronLeft size={18}/></button><input aria-label="Trang PDF" className="w-14 bg-white text-ink rounded-sm text-center text-sm py-1" type="number" min={1} max={pages||999} value={page} onChange={e=>setPage(clamp(Number(e.target.value)||1))}/><span className="text-xs text-slate-300">/ {pages||'…'}</span><button aria-label="Trang tiếp" disabled={page===pages} onClick={()=>setPage(p=>clamp(p+1))} className="p-1 disabled:opacity-40"><ChevronRight size={18}/></button><span className="w-px h-6 bg-white/20 mx-2"/><button aria-label="Thu nhỏ" onClick={()=>setScale(s=>Math.max(.55,s-.15))}><Minus size={16}/></button><span className="text-xs">{Math.round(scale*100)}%</span><button aria-label="Phóng to" onClick={()=>setScale(s=>Math.min(2,s+.15))}><Plus size={16}/></button><a href={url} target="_blank" rel="noopener noreferrer" className="ml-3" title="Mở PDF" aria-label="Mở PDF trong tab mới"><Maximize2 size={17}/></a><a href={url} download title="Tải PDF" aria-label="Tải PDF"><Download size={17}/></a></div></div>
 <div className="overflow-x-auto min-h-[600px] flex justify-center py-6 px-4"><Document file={url} onLoadSuccess={({numPages})=>{setPages(numPages);setPage(p=>Math.min(p,numPages))}} loading={<p className="p-6">Đang mở PDF…</p>} error={<p className="p-6 text-red-700">Không thể tải PDF. Vui lòng mở bản gốc bằng nút phía trên.</p>}><Page pageNumber={page} scale={scale} width={Math.round(550)} renderTextLayer renderAnnotationLayer className="shadow-xl bg-white"/></Document></div>
 </section>
}
