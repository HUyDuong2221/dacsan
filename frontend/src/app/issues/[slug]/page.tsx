import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOrNull } from '@/lib/api';
import IssueBrowser from '@/components/IssueBrowser';

type Props = { params: { slug: string }; searchParams: { field?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getOrNull(`/issues/${params.slug}`);
  return { title: d ? `Mục lục ${d.issue.label}` : 'Không tìm thấy' };
}

export default async function IssuePage({ params, searchParams }: Props) {
  const d = await getOrNull(`/issues/${params.slug}`);
  if (!d) notFound();
  return (
    <div className="wrap page" style={{ paddingTop: 40 }}>
      <IssueBrowser d={d} initialField={searchParams.field || ''} />
    </div>
  );
}
