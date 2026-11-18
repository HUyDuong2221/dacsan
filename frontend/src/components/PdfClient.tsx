'use client';
import dynamic from 'next/dynamic';
const Reader=dynamic(()=>import('./PdfReader'),{ssr:false,loading:()=> <div className="p-20 bg-slate-100 text-center">Đang khởi tạo trình đọc PDF…</div>});
export default function PdfClient(props:{url:string;initialPage:number;issueTitle:string}){return <Reader {...props}/>}
