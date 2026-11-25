import type { Metadata } from 'next';
import Link from 'next/link';
import { fmtDate, get } from '@/lib/api';
import './post.css';

export const metadata: Metadata = { title: 'Bài viết' };

// Bài viết độc lập đã công bố (soạn ở Nội dung › Bài viết, hoặc tạo từ PDF ở Nội dung › Tạo bài từ PDF), mới nhất trước.
export default async function Posts() {
  const items: any[] = await get('/posts').catch(() => []);
  return (
    <div className="wrap page post">
      <header className="post-head">
        <small>BÀI VIẾT</small>
        <h1>Bài viết</h1>
        <p>Các bài viết của Đặc san Khoa học và Phát triển thành phố Đà Nẵng, đọc trực tiếp trên website.</p>
      </header>
      {items.length === 0 ? (
        <p className="post-empty">Chưa có bài viết.</p>
      ) : (
        <div className="post-list">
          {items.map((p) => (
            <Link key={p.slug} href={`/bai-viet/${p.slug}`} className="post-card">
              {p.cover && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.cover} alt="" loading="lazy" />
                </figure>
              )}
              <div>
                <h2>{p.title}</h2>
                <small>{[p.author, fmtDate(p.published_at)].filter(Boolean).join(' · ')}</small>
                {p.excerpt && <p>{p.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
