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
        <div className="shell">
          <div className="sci-bg" aria-hidden="true">
            <svg viewBox="0 0 520 520" style={{ top: -120, right: -140, width: 620, height: 620, opacity: 0.5 }}>
              <g fill="none" stroke="#1F4BB8" strokeOpacity="0.16" strokeWidth="1">
                <circle cx="260" cy="260" r="120" /><circle cx="260" cy="260" r="186" /><circle cx="260" cy="260" r="252" />
              </g>
              <g style={{ transformOrigin: '260px 260px', animation: 'dcOrbit 64s linear infinite' }}>
                <circle cx="260" cy="74" r="5" fill="#1F4BB8" fillOpacity="0.5" />
              </g>
              <g style={{ transformOrigin: '260px 260px', animation: 'dcOrbitRev 96s linear infinite' }}>
                <circle cx="260" cy="8" r="4" fill="#C8372D" fillOpacity="0.45" />
              </g>
            </svg>
            <div className="blob" />
          </div>
          <div className="topbar">
            <div className="wrap">
              <span>{(site.org_name || 'LIÊN HIỆP CÁC HỘI KHOA HỌC KỸ THUẬT ĐÀ NẴNG').toUpperCase()}</span>
              <span className="r"><span>ISSN {site.issn || '—'}</span><span>VI / EN</span></span>
            </div>
          </div>
          <Header />
          <main>{children}</main>
          <Footer site={site} />
        </div>
        <ChatWidget />
      </body>
    </html>
  );
}
