'use client';
import {useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Menu, X} from 'lucide-react';
export default function SiteHeader() {
 const [open,setOpen] = useState(false);
 const pathname = usePathname();
 const nav = [['/','Trang chủ'],['/issues','Đặc san'],['/#trong-so-nay','Nghiên cứu – Trao đổi'],['/tai-lieu','Tư liệu'],['/thong-bao','Thông báo'],['/hoat-dong','Hoạt động']];
 return <header className={`masthead ${pathname === '/' ? 'masthead-home' : ''}`}>
  <div className="masthead-strip"><div className="home-container"><span>LIÊN HIỆP CÁC HỘI KHOA HỌC VÀ KỸ THUẬT ĐÀ NẴNG</span><span>ĐẶC SAN ĐIỆN TỬ</span></div></div>
  <div className="home-container masthead-main"><Link className="masthead-logo" href="/" onClick={() => setOpen(false)}><img src="/images/dacsan-logo.jpg" alt="Đặc san Khoa học & Phát triển thành phố Đà Nẵng" width={354} height={118}/></Link>
   <button className="masthead-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="main-navigation" aria-label={open ? 'Đóng menu' : 'Mở menu'}>{open ? <X size={20}/> : <Menu size={20}/>} Menu</button>
   <nav id="main-navigation" className={`masthead-nav ${open ? 'is-open' : ''}`} aria-label="Điều hướng chính">{nav.map(([href,label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={(href === '/' ? pathname === '/' : href === '/issues' && (pathname.startsWith('/issues') || pathname.startsWith('/articles') || pathname.startsWith('/read'))) || (href !== '/' && href !== '/issues' && pathname.startsWith(href)) ? 'active' : ''} aria-current={(href === '/' && pathname === '/') || (href === '/issues' && pathname.startsWith('/issues')) ? 'page' : undefined}>{label}</Link>)}<Link href="/search" className="masthead-search" onClick={() => setOpen(false)}>Tìm bài báo</Link></nav>
  </div>
 </header>;
}
