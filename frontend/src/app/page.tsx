import type { Metadata } from 'next';
import { get } from '@/lib/api';
import HomeV7, { type HomeProps } from './_home/HomeV7';

export const metadata: Metadata = { title: 'Trang chủ' };

export default async function Home() {
  const [d, site, all] = await Promise.all([
    get('/home'),
    get('/site').catch(() => ({} as Record<string, string>)),
    get('/issues').catch(() => ({ issues: [] as any[] })),
  ]);
  const latest = d.latest_issue;
  const articles: any[] = d.articles || [];

  const slides: HomeProps['slides'] = (d.hero || []).map((h: any) => ({
    key: h.key,
    cat: latest && h.key === `issue-${latest.slug}` ? 'SỐ MỚI NHẤT' : 'TIÊU ĐIỂM',
    title: h.title,
    excerpt: h.excerpt || '',
    meta: h.kicker || '',
    href: h.href,
    img: h.img || null,
  }));

  const toc = articles.slice(0, 5).map((a) => ({ slug: a.slug, title: a.title, page: a.page_label || '' }));

  // Chuyên mục lấy từ data; mỗi chuyên mục liệt kê các số đặc san thuộc chuyên mục đó.
  const topics: HomeProps['topics'] = (d.topics || []).map((t: any) => ({
    name: t.name,
    count: t.count,
    issues: (t.issues || []).map((i: any) => ({
      slug: i.slug,
      label: i.label,
      cover: i.cover_url || null,
      date: i.published_at ? i.published_at.slice(0, 10).split('-').reverse().join('/') : '',
      articles: i.article_count || 0,
      pages: i.page_count || null,
    })),
  }));

  const acts = (d.activities || []).map((a: any) => {
    const [, m, day] = (a.date || '').slice(0, 10).split('-');
    return { id: a.id, day: day || '', month: m ? `THG ${Number(m)}` : '', kind: a.kind || '', title: a.title, url: a.url || '' };
  });

  const issues = (all.issues || []).map((i: any) => ({
    slug: i.slug,
    label: i.label,
    theme: i.theme || '',
    cover: i.cover_url || null,
    number: i.number,
    year: i.published_at ? i.published_at.slice(0, 4) : 'Khác',
  }));

  const stats = [
    { v: String(d.stats?.issue_count ?? issues.length), l: 'số đặc san\nđã phát hành' },
    { v: String(d.stats?.article_count ?? 0), l: `bài viết theo\n${topics.length} chuyên mục` },
    { v: latest?.page_count ? String(latest.page_count) : '—', l: 'trang trong\nsố mới nhất' },
    { v: '2', l: 'tháng\nmột kỳ' },
  ];

  const props: HomeProps = {
    site,
    issueCount: d.stats?.issue_count ?? issues.length,
    latest: latest
      ? { slug: latest.slug, label: latest.label, theme: latest.theme, cover: latest.cover_url, pdf: latest.pdf_url, articleCount: latest.article_count, pageCount: latest.page_count }
      : null,
    slides,
    toc,
    tocMore: Math.max(articles.length - toc.length, 0),
    stats,
    topics,
    acts,
    issues,
  };

  return <HomeV7 {...props} />;
}
