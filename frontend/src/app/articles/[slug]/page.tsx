import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrNull } from '@/lib/api';
import { previewQS } from '@/lib/preview';
import PreviewBar from '@/components/site/PreviewBar';
import TrackView from '@/components/site/TrackView';
import ArticleReader from '@/components/reader/ArticleReader';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getOrNull(`/articles/${params.slug}${previewQS()}`);
  if (!a) return { title: 'Không tìm thấy bài viết' };
  return { title: a.title, description: a.lead || undefined, authors: [{ name: a.author }], ...(a.preview ? { robots: { index: false, follow: false } } : {}) };
}

export default async function ArticlePage({ params }: Props) {
  const a = await getOrNull(`/articles/${params.slug}${previewQS()}`);
  if (!a) notFound();
  return (
    <>
      {a.preview ? <PreviewBar slug={a.issue.slug} /> : <TrackView kind="view" issue={a.issue.slug} article={a.slug} />}
      <ArticleReader a={a} />
    </>
  );
}
