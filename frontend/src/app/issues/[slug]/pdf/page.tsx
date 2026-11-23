import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrNull } from '@/lib/api';
import { previewQS } from '@/lib/preview';
import PdfReader, { type TocGroup } from '@/components/reader/PdfReader';
import TrackView from '@/components/site/TrackView';

type Props = { params: { slug: string }; searchParams: { page?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getOrNull(`/issues/${params.slug}${previewQS()}`);
  return { title: d ? `Đọc PDF ${d.issue.label}` : 'Không tìm thấy' };
}

// Trình đọc PDF toàn màn hình; ?page=N mở thẳng tới trang N.
export default async function IssuePdf({ params, searchParams }: Props) {
  const d = await getOrNull(`/issues/${params.slug}${previewQS()}`);
  if (!d || !d.issue.pdf_url) notFound();
  const { issue } = d;
  const page = parseInt(searchParams.page || '', 10);
  // mục lục cho nút "Mục lục": số trong page_label ("tr. 9") là số trang của file PDF
  const item = (a: any) => ({ title: a.title, author: a.author || '', page: parseInt(String(a.page_label || '').replace(/\D/g, ''), 10) || 0 });
  const toc: TocGroup[] = [
    ...(d.front.length ? [{ name: 'Trang đầu số', items: d.front.map(item) }] : []),
    ...d.groups.map((g: any) => ({ name: g.field, items: g.items.map(item) })),
  ];
  return (
    <>
    {!d.preview && <TrackView kind="read" issue={issue.slug} />}
    <PdfReader
      src={issue.pdf_url}
      title={`Đặc san ${issue.label.toLowerCase()}.pdf`}
      meta="Đặc san Khoa học & Phát triển"
      backHref={`/issues/${issue.slug}`}
      page={page > 0 ? page : 0}
      toc={toc}
      stats={d.preview ? undefined : { issue: issue.slug }}
    />
    </>
  );
}
