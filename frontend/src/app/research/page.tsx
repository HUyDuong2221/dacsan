import type { Metadata } from 'next';
import { get } from '@/lib/api';
import { ArticleCard } from '@/components/Parts';

export const metadata: Metadata = { title: 'Nghiên cứu – Trao đổi' };

export default async function Research() {
  const items = await get('/research');
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Nghiên cứu – Trao đổi</div>
        <h1>Trao đổi học thuật và phản biện</h1>
      </div>
      <div className="cards">{items.map((a: any) => <ArticleCard key={a.slug} a={a} />)}</div>
      {!items.length && <p className="muted">Chưa có bài.</p>}
    </div>
  );
}
