'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import './site-nav.css';

const NAV = [
  { href: '/', label: 'Trang chủ', match: (p: string) => p === '/' },
  { href: '/tieu-diem', label: 'Tiêu điểm', match: (p: string) => p.startsWith('/tieu-diem') },
  { href: '/issues', label: 'Đặc san', match: (p: string) => p.startsWith('/issues') || p.startsWith('/articles') },
  { href: '/research', label: 'Nghiên cứu – Trao đổi', match: (p: string) => p.startsWith('/research') },
  { href: '/tin-hoat-dong', label: 'Tin hoạt động', match: (p: string) => p.startsWith('/tin-hoat-dong') },
  { href: '/docs', label: 'Tư liệu', match: (p: string) => p.startsWith('/docs') },
];

const ALT = 'Đặc san Khoa học & Phát triển thành phố Đà Nẵng';

// Header dùng chung cho mọi trang công khai (trang admin tự ẩn qua admin.css).
export default function SiteNav({ site, dateStr, latestLabel }: { site: Record<string, string>; dateStr: string; latestLabel?: string }) {
  const path = usePathname() || '/';
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [path]);
  const logo = site.logo_url || '/logo.jpg';

  return (
    <>
      <div className="v7h v7-util">
        <div className="v7-w">
          <span className="nw">{dateStr}</span>
          <span className="v7-util-r">
            {site.issn && <span className="nw">ISSN {site.issn}</span>}
            <a href="https://lhh.danang.gov.vn" target="_blank" rel="noopener noreferrer" className="nw">lhh.danang.gov.vn ↗</a>
          </span>
        </div>
      </div>

      <header className="v7h v7-mast">
        <div className="v7-w">
          <Link href="/" className="v7-logo" aria-label={ALT}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt={ALT} />
          </Link>
          <div className="v7-mast-meta">
            {latestLabel && <><span className="nw">{latestLabel}</span><i className="hs">◆</i></>}
            <span className="hs nw v7-mm-org">Cơ quan của Liên hiệp các Hội KH&amp;KT TP. Đà Nẵng</span>
            <i className="hs">◆</i>
            <span className="hs nw v7-mm-freq">Phát hành hai tháng một kỳ</span>
          </div>
        </div>
      </header>

      <nav className="v7h v7-nav" aria-label="Điều hướng chính">
        <div className="v7-w">
          <button className="v7-ibtn v7-menu-btn" onClick={() => setMenu(!menu)} aria-label="Mở menu" aria-expanded={menu}>
            <span className="v7-bars"><span /><span /><span /></span>
          </button>
          <div className="v7-links">
            {NAV.map((m) => (
              <Link key={m.href} href={m.href} className={m.match(path) ? 'on' : ''} aria-current={m.match(path) ? 'page' : undefined}>{m.label}</Link>
            ))}
          </div>
          <div className="v7-nav-r">
            <Link href="/search" className="v7-ibtn" aria-label="Tìm kiếm">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#03368D" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            </Link>
            <Link href="/gui-bai" className="v7-cta">Gửi bài</Link>
          </div>
        </div>
        {menu && (
          <div className="v7-drawer">
            <div className="v7-w">
              {NAV.map((m) => (
                <Link key={m.href} href={m.href} className={m.match(path) ? 'on' : ''} onClick={() => setMenu(false)}>
                  {m.label}<span style={{ color: '#03368D' }} aria-hidden="true">→</span>
                </Link>
              ))}
              {/* Điện thoại: nút "Gửi bài" và link LHH bị ẩn khỏi thanh trên nên đưa vào menu */}
              <a href="https://lhh.danang.gov.vn" target="_blank" rel="noopener noreferrer" className="v7-drawer-x">
                lhh.danang.gov.vn<span style={{ color: '#03368D' }} aria-hidden="true">↗</span>
              </a>
              <Link href="/gui-bai" className="v7-drawer-cta" onClick={() => setMenu(false)}>Gửi bài cho Đặc san</Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
