'use client';
import { useState } from 'react';
import Link from 'next/link';

const STEP = 10;

// Trang "Tin hoạt động": hiện 10 tin mới nhất, bấm "Xem thêm" hiện thêm 10 tin.
// Mục có nội dung -> trang chi tiết trên site; chỉ có liên kết -> mở trang ngoài.
export default function NewsList({ items }: { items: any[] }) {
  const [shown, setShown] = useState(STEP);
  return (
    <>
      <div className="news">
        {items.slice(0, shown).map((a, n) => {
          const [y, m, d] = (a.date || '').slice(0, 10).split('-');
          const inner = (
            <>
              <span className="news-date" aria-hidden={!d}>
                <b>{d || '—'}</b>
                {m && <small>THG {Number(m)}</small>}
                {y && <small className="y">{y}</small>}
              </span>
              <span>
                {a.kind && <em>{a.kind}</em>}
                <strong>{a.title}</strong>
                {a.content ? <span className="more">Xem chi tiết →</span> : a.url ? <span className="more">Mở liên kết ↗</span> : null}
              </span>
            </>
          );
          const style = { animationDelay: `${Math.min(n % STEP, 8) * 50}ms` };
          if (a.content) return <Link key={a.id} href={`/tin-hoat-dong/${a.id}`} className="news-item" style={style}>{inner}</Link>;
          if (a.url) return <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="news-item" style={style}>{inner}</a>;
          return <div key={a.id} className="news-item" style={style}>{inner}</div>;
        })}
      </div>
      {items.length > shown && (
        <button type="button" className="lst-more" onClick={() => setShown(shown + STEP)}>
          Xem thêm <span aria-hidden="true">↓</span>
        </button>
      )}
    </>
  );
}
