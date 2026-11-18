import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrNull } from '@/lib/api';
import ArticleReader from '@/components/ArticleReader';

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getOrNull(`/articles/${params.slug}`);
  if (!a) return { title: 'Không tìm thấy bài viết' };
  return { title: a.title, description: a.lead || undefined, authors: [{ name: a.author }] };
}

export default async function ArticlePage({ params }: Props) {
  const a = await getOrNull(`/articles/${params.slug}`);
  if (!a) notFound();
  return <ArticleReader a={a} />;
}
