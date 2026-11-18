export type Issue = {id:string;number:number;month:number;year:number;slug:string;title:string;theme:string;description:string;cover_key:string|null;pdf_key:string|null;page_count:number;status:string;editorial?:string;imprint?:string;sections?:Section[]};
export type Section = {id:string;name:string;slug:string;sort_order:number;articles:Article[]};
export type Article = {id:string;slug:string;title:string;author_display:string;content_type:string;summary:string;issue_id:string;issue_slug:string;issue_title:string;section_id:string|null;section_name:string;print_page_start:number;print_page_end:number;pdf_page_start:number;pdf_page_end:number;full_text_verified:boolean;sort_order:number;status:string;body_html?:string;pdf_key?:string;raw_extracted_text?:string};
export type HomeData = {latest_issue:Issue|null;recent_issues:Issue[];featured_articles:Article[]};
export type PageData<T> = {items:T[];total:number;page:number;limit:number};
export type ImportJob = {id:string;filename:string;status:string;progress:number;message:string;issue_id:string|null};
export const MEDIA = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || 'http://localhost:8000/media';
export const mediaUrl = (key:string|null|undefined) => key ? `${MEDIA}/${key}` : '';
const SERVER = process.env.SERVER_API_BASE_URL || 'http://localhost:8000/api/v1';
const CLIENT = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';
export async function serverApi<T>(path:string):Promise<T>{
  const r = await fetch(`${SERVER}${path}`, {cache:'no-store'});
  if (!r.ok) throw new Error(`API ${r.status}: ${path}`);
  return r.json() as Promise<T>;
}
function csrf(){
  if(typeof document === 'undefined') return '';
  return decodeURIComponent(document.cookie.split('; ').find(s=>s.startsWith('dacsan_csrf='))?.split('=')[1] || '');
}
export async function clientApi<T>(path:string,opts:RequestInit={}):Promise<T>{
  const headers = new Headers(opts.headers);
  if(opts.body && !(opts.body instanceof FormData)) headers.set('Content-Type','application/json');
  if(opts.method && !['GET','HEAD','OPTIONS'].includes(opts.method.toUpperCase())) headers.set('X-CSRF-Token',csrf());
  const r=await fetch(`${CLIENT}${path}`,{...opts,credentials:'include',headers});
  if(!r.ok){let error:string=`HTTP ${r.status}`;try{let j=await r.json();error=typeof j.detail==='string'?j.detail:JSON.stringify(j.detail)}catch{}throw new Error(error)}
  return r.json() as Promise<T>;
}
