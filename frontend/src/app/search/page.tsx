import type { Metadata } from 'next';
import { get } from '@/lib/api';
import { ArticleCard, SearchBox } from '@/components/Parts';

export const metadata: Metadata = { title: 'Tìm bài báo' };

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; issue?: string } }) {
  const q = (searchParams.q || '').trim();
  const issue = searchParams.issue || '';
  let res: any = null;
  if (q.length >= 2) {
    res = await get(`/search?q=${encodeURIComponent(q)}${issue ? `&issue=${encodeURIComponent(issue)}` : ''}`);
  }
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Tìm kiếm</div>
        <h1>Tìm bài báo</h1>
        <div style={{ maxWidth: 640, marginTop: 18 }}>
          <SearchBox defaultValue={q} hidden={issue ? { issue } : undefined} placeholder="Tiêu đề, tác giả hoặc từ khóa (không cần gõ dấu)" />
        </div>
        {issue && <p className="muted">Giới hạn trong: {issue}</p>}
      </div>
      {res && (
        <>
          <p className="muted" style={{ marginBottom: 18 }}>{res.count} kết quả cho “{q}”</p>
          <div className="cards">{res.results.map((a: any) => <ArticleCard key={a.slug} a={a} />)}</div>
        </>
      )}
      {!res && <p className="muted">Nhập ít nhất 2 ký tự.</p>}
    </div>
  );
}
