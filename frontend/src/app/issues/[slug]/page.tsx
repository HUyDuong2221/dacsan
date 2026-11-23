import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrNull } from '@/lib/api';
import { previewQS } from '@/lib/preview';
import IssueBrowser from '@/components/reader/IssueBrowser';
import PreviewBar from '@/components/site/PreviewBar';
import TrackView from '@/components/site/TrackView';

type Props = { params: { slug: string }; searchParams: { field?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getOrNull(`/issues/${params.slug}${previewQS()}`);
  if (!d) return { title: 'Không tìm thấy' };
  return { title: `Mục lục ${d.issue.label}`, ...(d.preview ? { robots: { index: false, follow: false } } : {}) };
}

export default async function IssuePage({ params, searchParams }: Props) {
  const d = await getOrNull(`/issues/${params.slug}${previewQS()}`);
  if (!d) notFound();
  // IssueBrowser tự dựng khung (khối đầu trang tràn hết chiều ngang).
  return (
    <>
      {d.preview ? <PreviewBar slug={d.issue.slug} /> : <TrackView kind="view" issue={d.issue.slug} />}
      <IssueBrowser d={d} initialField={searchParams.field || ''} />
    </>
  );
}
