import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrNull } from '@/lib/api';

type Props = { params: { slug: string }; searchParams: { page?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getOrNull(`/issues/${params.slug}`);
  return { title: d ? `Đọc PDF ${d.issue.label}` : 'Không tìm thấy' };
}

export default async function IssuePdf({ params, searchParams }: Props) {
  const d = await getOrNull(`/issues/${params.slug}`);
  if (!d || !d.issue.pdf_url) notFound();
  const { issue } = d;
  const page = parseInt(searchParams.page || '', 10);
  const src = `${issue.pdf_url}${page > 0 ? `#page=${page}` : ''}`;
  return (
    <div className="wrap" style={{ paddingTop: 16, paddingBottom: 24 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="row" style={{ gap: 14 }}>
          <Link href={`/issues/${issue.slug}`} className="btn ghost sm">← Mục lục</Link>
          <span className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Đặc san {issue.label.toLowerCase()} — bản PDF</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a href={src} target="_blank" rel="noopener noreferrer" className="btn ghost sm">Mở tab mới</a>
          <a href={issue.pdf_url} download className="btn ghost sm">Tải về</a>
        </div>
      </div>
      <iframe
        src={src}
        title={`PDF ${issue.label}`}
        style={{ width: '100%', height: 'calc(100vh - 150px)', minHeight: 480, border: '1px solid var(--line2)', background: '#fff' }}
      />
      <p className="muted" style={{ marginTop: 10 }}>
        Nếu trình duyệt không hiển thị được PDF (một số điện thoại), hãy bấm “Mở tab mới” hoặc “Tải về”.
      </p>
    </div>
  );
}
