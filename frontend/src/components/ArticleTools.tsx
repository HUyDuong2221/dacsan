'use client';
import {useState} from 'react';
import {Copy,Check,Minus,Plus} from 'lucide-react';
export default function ArticleTools({title,author,issue,children}:{title:string;author:string;issue:string;children:React.ReactNode}){
 const [fontSize,setFontSize]=useState(18);const [copied,setCopied]=useState(false);
 async function copy(){const cite=`${author}. ${title}. Đặc san Khoa học & Phát triển thành phố Đà Nẵng, ${issue}. ${window.location.href}`;await navigator.clipboard.writeText(cite);setCopied(true);setTimeout(()=>setCopied(false),2000)}
 return <><div className="py-3 border-y flex flex-wrap gap-3 items-center justify-between my-8"><div className="flex items-center gap-3 text-sm"><span className="text-slate-500">Cỡ chữ</span><button className="rounded border p-1.5" aria-label="Thu nhỏ chữ" onClick={()=>setFontSize(s=>Math.max(15,s-1))}><Minus size={17}/></button><span>{fontSize}px</span><button className="rounded border p-1.5" aria-label="Phóng to chữ" onClick={()=>setFontSize(s=>Math.min(26,s+1))}><Plus size={17}/></button></div><button onClick={copy} className="inline-flex items-center gap-2 text-brand font-semibold text-sm">{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Đã sao chép':'Sao chép trích dẫn'}</button></div><div className="prose-article" style={{fontSize}}>{children}</div></>
}
