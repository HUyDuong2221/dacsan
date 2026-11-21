import type { Metadata } from 'next';
import Link from 'next/link';
import { get } from '@/lib/api';
import '@/components/listing.css';

export const metadata: Metadata = { title: 'Tin hoạt động' };

// Danh sách "Hoạt động" trong trang quản trị (chỉ mục đang bật Hiển thị), mới nhất trước.
// Mục có nội dung -> trang chi tiết trên site; chỉ có liên kết -> mở trang ngoài.
export default async function News() {
  const items: any[] = await get('/activities').catch(() => []);
  return (
    <div className="wrap page lst">
      <header className="lst-head">
        <small>TIN HOẠT ĐỘNG</small>
        <h1>Tin hoạt động</h1>
        <p>Hội thảo, giải thưởng, hợp tác và các hoạt động của Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng.</p>
      </header>
      {items.length === 0 ? (
        <p className="lst-empty">Chưa có tin hoạt động.</p>
      ) : (
        <div className="news">
          {items.map((a, n) => {
            const [, m, d] = (a.date || '').slice(0, 10).split('-');
            const inner = (
              <>
                <span className="news-date" aria-hidden={!d}>
                  <b>{d || '—'}</b>
                  {m && <small>THG {Number(m)}{a.date ? ` · ${a.date.slice(0, 4)}` : ''}</small>}
                </span>
                <span>
                  {a.kind && <em>{a.kind}</em>}
                  <strong>{a.title}</strong>
                  {a.content ? <span className="more">Xem chi tiết →</span> : a.url ? <span className="more">Mở liên kết ↗</span> : null}
                </span>
              </>
            );
            const style = { animationDelay: `${Math.min(n, 8) * 50}ms` };
            if (a.content) return <Link key={a.id} href={`/tin-hoat-dong/${a.id}`} className="news-item" style={style}>{inner}</Link>;
            if (a.url) return <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="news-item" style={style}>{inner}</a>;
            return <div key={a.id} className="news-item" style={style}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
