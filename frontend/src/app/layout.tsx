import type { Metadata, Viewport } from 'next';
import './globals.css';
import SiteNav from '@/components/site/SiteNav';
import Footer from '@/components/site/Footer';
import ChatWidget from '@/components/site/ChatWidget';
import { get } from '@/lib/api';

export const metadata: Metadata = {
  title: { default: 'Đặc san Khoa học & Phát triển thành phố Đà Nẵng', template: '%s · Đặc san KH&PT Đà Nẵng' },
  description: 'Đặc san Khoa học & Phát triển của Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng – đọc toàn văn trực tuyến.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#03368D' };

export const dynamic = 'force-dynamic';

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// Ngày theo giờ Việt Nam (máy chủ có thể chạy UTC).
function viDate() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [site, all, pages] = await Promise.all([
    get('/site').catch(() => ({} as Record<string, string>)),
    get('/issues').catch(() => ({ issues: [] as any[] })),
    get('/pages').catch(() => [] as { slug: string; title: string }[]),
  ]);
  // Dòng dưới logo: "Số 17 · Tháng 6/2026", lấy từ số và ngày đăng của số mới nhất trong DB.
  const latest = all.issues?.[0];
  const [y, m] = (latest?.published_at || '').slice(0, 10).split('-');
  const latestLabel: string | undefined = latest
    ? (y && m ? `Số ${latest.number} · Tháng ${Number(m)}/${y}` : latest.label)
    : undefined;
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,700;1,800&family=Noto+Serif:ital,wght@0,600;0,700;1,700&family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&display=swap&subset=vietnamese"
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
          <SiteNav site={site} dateStr={viDate()} latestLabel={latestLabel} />
          <main>{children}</main>
          <Footer site={site} pages={pages} />
        </div>
        <ChatWidget />
      </body>
    </html>
  );
}
