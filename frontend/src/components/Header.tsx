'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { href: '/', label: 'Trang chủ', match: (p: string) => p === '/' },
  { href: '/issues', label: 'Số đã phát hành', match: (p: string) => p.startsWith('/issues') || p.startsWith('/articles') },
  { href: '/research', label: 'Nghiên cứu – Trao đổi', match: (p: string) => p.startsWith('/research') },
  { href: '/docs', label: 'Tư liệu', match: (p: string) => p.startsWith('/docs') },
  { href: '/search', label: 'Tìm bài báo', match: (p: string) => p.startsWith('/search') },
];

export default function Header({ logoUrl }: { logoUrl?: string }) {
  const path = usePathname() || '/';
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="wrap">
        {logoUrl ? (
          <Link href="/" className="logo-custom" aria-label="Đặc san Khoa học & Phát triển thành phố Đà Nẵng">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Đặc san Khoa học & Phát triển thành phố Đà Nẵng" />
          </Link>
        ) : (
          <Link href="/" className="logo-box" aria-label="Đặc san Khoa học & Phát triển thành phố Đà Nẵng">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Đặc san Khoa học & Phát triển thành phố Đà Nẵng" />
          </Link>
        )}
        <button className="menu-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="bars"><span /><span /><span /></span>
          Menu
        </button>
        <nav className={`nav ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <div key={n.href} className={`it ${n.match(path) ? 'on' : ''}`}>
              <Link href={n.href}>{n.label}</Link>
              <i />
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
