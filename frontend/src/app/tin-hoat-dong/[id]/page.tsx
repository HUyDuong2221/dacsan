import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fmtDate, getOrNull } from '@/lib/api';
import '@/components/listing.css';

type Props = { params: { id: string } };

async function load(id: string) {
  return /^\d+$/.test(id) ? getOrNull(`/activities/${id}`) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await load(params.id);
  return { title: a ? a.title : 'Không tìm thấy' };
}

export default async function NewsDetail({ params }: Props) {
  const a = await load(params.id);
  if (!a) notFound();
  return (
    <div className="wrap page lst">
      <article className="news-detail">
        <nav className="crumb" aria-label="Đường dẫn"><Link href="/tin-hoat-dong">Tin hoạt động</Link> / {a.kind || 'Hoạt động'}</nav>
        <h1>{a.title}</h1>
        <div className="meta">
          {a.kind && <em>{a.kind}</em>}
          {a.date && <span>{fmtDate(a.date)}</span>}
        </div>
        {/* Nội dung HTML do quản trị viên / biên tập viên soạn bằng CKEditor trong trang quản trị */}
        {a.content && <div className="news-body" dangerouslySetInnerHTML={{ __html: a.content }} />}
        <div className="news-acts">
          {a.attachment_url && <a className="p" href={a.attachment_url} download>Tải tệp đính kèm</a>}
          {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer">Xem nguồn ↗</a>}
          <Link href="/tin-hoat-dong" style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 18px', fontSize: 14, fontWeight: 600, color: '#03368D' }}>← Tất cả tin hoạt động</Link>
        </div>
      </article>
    </div>
  );
}
