import type { Metadata } from 'next';
import Link from 'next/link';
import { fmtDate, get } from '@/lib/api';
import { Cover, SearchBox } from '@/components/Parts';
import { toTile } from '@/components/IssueTile';
import PastIssues from '@/components/PastIssues';
import IssueTabs from '@/components/IssueTabs';
import './issues.css';

export const metadata: Metadata = { title: 'Các số đã phát hành' };

export default async function Issues() {
  const d = await get('/issues');
  const issues: any[] = d.issues || [];
  const [latest, ...older] = issues;
  // "Trong số này": mục lục của số mới nhất, nhóm theo chuyên mục.
  const toc = latest ? await get(`/issues/${latest.slug}`).catch(() => null) : null;
  const groups: any[] = toc?.groups || [];
  const totalArticles = issues.reduce((n, i) => n + (i.article_count || 0), 0);

  return (
    <div className="wrap page iss">
      <header className="iss-head">
        <div className="iss-head-text">
          <div className="kicker iss-kicker">Đặc san Khoa học &amp; Phát triển <span>thành phố Đà Nẵng</span></div>
          <h1>Các số đã phát hành</h1>
          <p>Toàn bộ các số đặc san được số hóa, đọc trực tiếp trên web theo mục lục của bản in.</p>
          <ul className="iss-stats" aria-label="Thống kê">
            <li><b>{issues.length}</b> số đặc san</li>
            <li><b>{totalArticles}</b> bài viết</li>
          </ul>
        </div>
        <div className="iss-search">
          <SearchBox placeholder="Tìm bài, tác giả, chuyên mục" />
        </div>
      </header>

      {latest && (
        <section className="iss-feat" aria-label="Số mới nhất">
          <Link href={`/issues/${latest.slug}`} className="iss-feat-cover">
            <Cover issue={latest} text={`bìa ${latest.label.toLowerCase()}`} />
          </Link>
          <div className="iss-feat-head">
            <span className="iss-badge">Số mới nhất</span>
            <div className="iss-label">{latest.label}</div>
            <h2>{latest.theme || latest.label}</h2>
            <div className="iss-meta">
              {latest.published_at && <span className="iss-date">Phát hành {fmtDate(latest.published_at)}</span>}
              <span>{latest.article_count} bài</span>
              {latest.page_count ? <span>{latest.page_count} trang</span> : null}
            </div>
          </div>
          {latest.summary && <p className="iss-feat-sum">{latest.summary}</p>}
          <div className="iss-feat-act">
            <Link href={`/issues/${latest.slug}`} className="btn">Xem mục lục</Link>
            {latest.pdf_url && <Link href={`/issues/${latest.slug}/pdf`} className="btn ghost">Đọc bản PDF</Link>}
          </div>
        </section>
      )}

      {latest && (
        <section className="iss-sec">
          <div className="sec-head">
            <h2>Trong số này</h2>
            <Link href={`/issues/${latest.slug}`}>Toàn bộ mục lục →</Link>
          </div>
          {groups.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Mục lục của {latest.label.toLowerCase()} đang được cập nhật.</p>
          ) : (
            <IssueTabs articles={groups.flatMap((g) => g.items)} fields={groups.map((g) => g.field)} />
          )}
        </section>
      )}

      {older.length > 0 && (
        <PastIssues issues={older.map((i: any) => ({ ...toTile(i), year: (i.published_at || '').slice(0, 4) }))} />
      )}
    </div>
  );
}
