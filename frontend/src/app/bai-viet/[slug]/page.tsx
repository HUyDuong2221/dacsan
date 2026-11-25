import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmtDate, getOrNull } from '@/lib/api';
import '../post.css';

type Props = { params: { slug: string } };

async function load(slug: string) {
  return /^[a-z0-9-]{1,200}$/.test(slug) ? getOrNull(`/posts/${slug}`) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load(params.slug);
  if (!p) return { title: 'Không tìm thấy bài viết' };
  return { title: p.title, description: p.excerpt || undefined, ...(p.author ? { authors: [{ name: p.author }] } : {}) };
}

export default async function PostPage({ params }: Props) {
  const p = await load(params.slug);
  if (!p) notFound();
  const toc: { id: string; text: string; level: number }[] = p.toc || [];
  return (
    <div className="wrap page post">
      <article className="post-doc">
        <nav className="crumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link> / <Link href="/bai-viet">Bài viết</Link></nav>
        <h1>{p.title}</h1>
        <div className="post-meta">
          {p.author && <span>Tác giả: <b>{p.author}</b></span>}
          {p.published_at && <span>{fmtDate(p.published_at)}</span>}
        </div>
        {toc.length >= 3 && (
          <nav className="post-toc" aria-label="Mục lục bài">
            <b>Nội dung bài</b>
            <ol>{toc.map((h) => <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>)}</ol>
          </nav>
        )}
        {/* HTML do quản trị viên / biên tập viên soạn bằng CKEditor trong trang quản trị (cùng cách với Hoạt động và Trang nội dung) */}
        <div className="post-body" dangerouslySetInnerHTML={{ __html: p.body }} />
      </article>
    </div>
  );
}
