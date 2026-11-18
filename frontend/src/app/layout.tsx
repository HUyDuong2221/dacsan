import type {Metadata} from 'next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
export const metadata:Metadata={title:{default:'Đặc san Khoa học & Phát triển — Đà Nẵng',template:'%s | Khoa học & Phát triển'},description:'Kho lưu trữ và tra cứu Đặc san Khoa học & Phát triển thành phố Đà Nẵng'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body><SiteHeader/><main className="min-h-[65vh]">{children}</main><SiteFooter/></body></html>}
