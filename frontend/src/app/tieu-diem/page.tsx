import type { Metadata } from 'next';
import Link from 'next/link';
import { fmtDate, get } from '@/lib/api';
import '@/components/listing.css';

export const metadata: Metadata = { title: 'Tiêu điểm' };

// Các số đặc san được tick "Tiêu điểm" trong trang quản trị (mới nhất trước).
export default async function Spotlight() {
  const items: any[] = await get('/featured').catch(() => []);
  return (
    <div className="wrap page lst">
      <header className="lst-head">
        <small>TIÊU ĐIỂM</small>
        <h1>Các số đặc san tiêu điểm</h1>
        <p>Những số đặc san được Ban Biên tập chọn giới thiệu nổi bật.</p>
      </header>
      {items.length === 0 ? (
        <p className="lst-empty">Chưa có số đặc san nào được đánh dấu tiêu điểm.</p>
      ) : (
        <div className="spot">
          {items.map((i, n) => (
            <Link key={i.slug} href={`/issues/${i.slug}`} className="spot-card" style={{ animationDelay: `${Math.min(n, 6) * 70}ms` }}>
              <span className="spot-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.cover_url ? <img src={i.cover_url} alt={`Bìa ${i.label}`} loading="lazy" /> : <em>{i.label}</em>}
              </span>
              <span className="spot-body">
                <small>{i.label.toUpperCase()}</small>
                <h2>{i.title || i.theme}</h2>
                {i.summary && <p>{i.summary}</p>}
                <span className="spot-meta">
                  {i.theme && i.title && <span className="chip">{i.theme}</span>}
                  {i.published_at && <span>Phát hành {fmtDate(i.published_at)}</span>}
                  <span>{i.article_count} bài{i.page_count ? ` · ${i.page_count} trang` : ''}</span>
                  <b>Xem mục lục →</b>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
