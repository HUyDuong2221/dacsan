import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmtDate, getOrNull } from '@/lib/api';
import '@/components/site/listing.css';

type Props = { params: { slug: string } };

// Trang nội dung tĩnh (Giới thiệu, Ban biên tập, Hỏi đáp...) soạn ở mục "Trang nội dung" trong admin.
async function load(slug: string) {
  return /^[a-z0-9-]{1,120}$/.test(slug) ? getOrNull(`/pages/${slug}`) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load(params.slug);
  return { title: p ? p.title : 'Không tìm thấy' };
}

export default async function StaticPage({ params }: Props) {
  const p = await load(params.slug);
  if (!p) notFound();
  return (
    <div className="wrap page lst">
      <article className="news-detail">
        <nav className="crumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link> / {p.title}</nav>
        <h1>{p.title}</h1>
        {p.updated_at && <div className="meta"><span>Cập nhật {fmtDate(p.updated_at)}</span></div>}
        {/* HTML do quản trị viên / biên tập viên soạn bằng CKEditor trong trang quản trị */}
        <div className="news-body" dangerouslySetInnerHTML={{ __html: p.content }} />
      </article>
    </div>
  );
}
