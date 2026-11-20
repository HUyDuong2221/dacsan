import type { Metadata } from 'next';
import { get } from '@/lib/api';
import HomeV7, { type HomeProps } from './_home/HomeV7';

export const metadata: Metadata = { title: 'Trang chủ' };

const FONTS =
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,700;1,800&family=Source+Serif+4:wght@400;600&display=swap';

const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function viDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

export default async function Home() {
  const [d, site, all] = await Promise.all([
    get('/home'),
    get('/site').catch(() => ({} as Record<string, string>)),
    get('/issues').catch(() => ({ issues: [] as any[] })),
  ]);
  const latest = d.latest_issue;
  const articles: any[] = d.articles || [];

  const slides: HomeProps['slides'] = (d.hero || []).map((h: any, i: number) => ({
    key: h.key,
    cat: i === 0 && latest && h.key === `issue-${latest.slug}` ? 'SỐ MỚI NHẤT' : 'TIÊU ĐIỂM',
    title: h.title,
    excerpt: h.excerpt || '',
    meta: h.kicker || '',
    href: h.href,
    img: i === 0 && latest && h.key === `issue-${latest.slug}` ? latest.cover_url : null,
  }));

  const toc = articles.slice(0, 5).map((a) => ({ slug: a.slug, title: a.title, page: a.page_label || '' }));

  const fields: string[] = d.fields || [];
  const topics = fields
    .map((f) => {
      const items = articles.filter((a) => a.field === f);
      return {
        name: f,
        count: items.length,
        posts: items.slice(0, 3).map((a) => ({ slug: a.slug, issue: a.issue?.label || '', title: a.title, author: a.author || '' })),
      };
    })
    .filter((t) => t.count > 0);

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
  const totalArticles = (all.issues || []).reduce((s: number, i: any) => s + (i.article_count || 0), 0);

  const stats = [
    { v: String(d.stats?.issue_count ?? issues.length), l: 'số đặc san\nđã phát hành' },
    { v: String(totalArticles), l: 'bài viết\ntrong mục lục' },
    ...(latest?.page_count ? [{ v: String(latest.page_count), l: 'trang trong\nsố mới nhất' }] : []),
    { v: '2', l: 'tháng\nmột kỳ' },
  ];

  const props: HomeProps = {
    dateStr: viDate(new Date()),
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

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS} />
      <HomeV7 {...props} />
    </>
  );
}
