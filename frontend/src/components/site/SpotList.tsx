'use client';
import { useState } from 'react';
import Link from 'next/link';
import { fmtDate } from '@/lib/api';

const STEP = 10;
const KIND_LABEL: Record<string, string> = { issue: 'Xem mục lục →', activity: 'Xem chi tiết →', page: 'Xem trang →', post: 'Đọc bài →' };

// Trang "Tiêu điểm": hiện 10 mục đầu (do quản trị chọn: số đặc san, hoạt động, trang nội dung, bài viết), bấm "Xem thêm" hiện thêm 10 mục.
export default function SpotList({ items }: { items: any[] }) {
  const [shown, setShown] = useState(STEP);
  return (
    <>
      <div className="spot">
        {items.slice(0, shown).map((i, n) => (
          <Link key={i.key} href={i.href} className="spot-card" style={{ animationDelay: `${Math.min(n % STEP, 6) * 70}ms` }}>
            <span className="spot-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.img ? <img src={i.img} alt="" loading="lazy" /> : <em>{i.label || i.kicker}</em>}
            </span>
            <span className="spot-body">
              <small>{String(i.kicker || '').toUpperCase()}</small>
              <h2>{i.title}</h2>
              {i.excerpt && <p>{i.excerpt}</p>}
              <span className="spot-meta">
                {i.date && <span>{fmtDate(i.date)}</span>}
                <b>{KIND_LABEL[i.kind] || 'Xem →'}</b>
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
