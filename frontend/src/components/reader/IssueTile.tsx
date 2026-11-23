import Link from 'next/link';
import './issue-tile.css';

export type IssueTileData = {
  slug: string;
  label: string;
  cover?: string | null;
  date?: string; // dd/mm/yyyy
  articles?: number;
  pages?: number | null;
};

// Chuyển dữ liệu số đặc san từ API (issue_card) sang dạng thẻ.
export function toTile(i: any): IssueTileData {
  return {
    slug: i.slug,
    label: i.label,
    cover: i.cover_url || null,
    date: i.published_at ? i.published_at.slice(0, 10).split('-').reverse().join('/') : '',
    articles: i.article_count || 0,
    pages: i.page_count || null,
  };
}

// Thẻ số đặc san dùng chung (trang chủ – khối Chuyên mục, trang Các số đã phát hành).
// Đặt trong lưới .itile-grid: 4 cột, 2 cột dưới 900px.
export default function IssueTile({ s }: { s: IssueTileData }) {
  return (
    <Link href={`/issues/${s.slug}`} className="itile">
      <span className="itile-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {s.cover ? <img src={s.cover} alt={`Bìa ${s.label}`} loading="lazy" /> : <em>{s.label}</em>}
      </span>
      <strong>{s.label}</strong>
      {s.date && <small>Phát hành {s.date}</small>}
      <div>
        <span>{s.articles ?? 0} bài{s.pages ? ` · ${s.pages} trang` : ''}</span>
        <b aria-hidden="true">→</b>
      </div>
    </Link>
  );
}
