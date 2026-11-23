'use client';
import { useState } from 'react';
import Link from 'next/link';
import { fmtDate } from '@/lib/api';

const STEP = 10;

// Trang "Tiêu điểm": hiện 10 số tiêu điểm mới nhất, bấm "Xem thêm" hiện thêm 10 số.
export default function SpotList({ items }: { items: any[] }) {
  const [shown, setShown] = useState(STEP);
  return (
    <>
      <div className="spot">
        {items.slice(0, shown).map((i, n) => (
          <Link key={i.slug} href={`/issues/${i.slug}`} className="spot-card" style={{ animationDelay: `${Math.min(n % STEP, 6) * 70}ms` }}>
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
      {items.length > shown && (
        <button type="button" className="lst-more" onClick={() => setShown(shown + STEP)}>
          Xem thêm <span aria-hidden="true">↓</span>
        </button>
      )}
    </>
  );
}
