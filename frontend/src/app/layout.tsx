import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ChatWidget from '@/components/ChatWidget';
import { get } from '@/lib/api';

export const metadata: Metadata = {
  title: { default: 'Đặc san Khoa học & Phát triển thành phố Đà Nẵng', template: '%s · Đặc san KH&PT Đà Nẵng' },
  description: 'Đặc san Khoa học & Phát triển của Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng – đọc toàn văn trực tuyến.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let site: Record<string, string> = {};
  try {
    site = await get('/site');
  } catch {}
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&display=swap&subset=vietnamese"
        />
      </head>
      <body>
        <div className="topbar">
          <div className="wrap">
            <span>{(site.org_name || 'LIÊN HIỆP CÁC HỘI KHOA HỌC KỸ THUẬT ĐÀ NẴNG').toUpperCase()}</span>
            <span>ISSN {site.issn || '—'}</span>
          </div>
        </div>
        <Header />
        <main>{children}</main>
        <Footer site={site} />
        <ChatWidget />
      </body>
    </html>
  );
}
