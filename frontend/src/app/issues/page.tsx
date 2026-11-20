import type { Metadata } from 'next';
import Link from 'next/link';
import { fmtDate, get } from '@/lib/api';
import { Cover, IssueCard, SearchBox } from '@/components/Parts';
import IssueTabs from '@/components/IssueTabs';

export const metadata: Metadata = { title: 'Các số đã phát hành' };

export default async function Issues() {
  const d = await get('/issues');
  const [latest, ...older] = d.issues;
  // "Trong số này": mục lục của số mới nhất, nhóm theo chuyên mục.
  const toc = latest ? await get(`/issues/${latest.slug}`).catch(() => null) : null;
  const groups: any[] = toc?.groups || [];
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Đặc san Khoa học &amp; Phát triển thành phố Đà Nẵng</div>
        <h1>Các số đã phát hành</h1>
        <p className="muted" style={{ maxWidth: '62ch', fontSize: 16 }}>
          Toàn bộ các số đặc san được số hóa, đọc trực tiếp trên web theo mục lục của bản in.
        </p>
        <div style={{ maxWidth: 560 }}><SearchBox /></div>
      </div>

      {latest && (
        <div className="row" style={{ alignItems: 'flex-start', gap: 44, paddingBottom: 44, marginBottom: 44, borderBottom: '1px solid var(--line)' }}>
          <Link href={`/issues/${latest.slug}`} style={{ flex: '0 1 240px' }}><Cover issue={latest} text={`bìa ${latest.label.toLowerCase()}`} /></Link>
          <div style={{ flex: '1 1 420px' }}>
            <div className="kicker" style={{ marginBottom: 12 }}>Số mới nhất · {latest.label}</div>
            <h2 className="serif" style={{ fontSize: 'clamp(24px,2.8vw,32px)', lineHeight: 1.2, marginBottom: 14 }}>{latest.theme}</h2>
            <p style={{ color: 'var(--ink2)', maxWidth: '64ch', lineHeight: 1.66 }}>{latest.summary}</p>
            <div className="row" style={{ margin: '20px 0' }}>
              <Link href={`/issues/${latest.slug}`} className="btn">Xem mục lục {latest.label.toLowerCase()}</Link>
              {latest.pdf_url && <Link href={`/issues/${latest.slug}/pdf`} className="btn ghost">Đọc bản PDF của số</Link>}
              <span className="muted">{latest.published_at ? `Ngày đăng ${fmtDate(latest.published_at)} · ` : ''}{latest.article_count} bài{latest.page_count ? ` · ${latest.page_count} trang` : ''}</span>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {d.fields.map((f: string) => <span key={f} className="chip">{f}</span>)}
            </div>
          </div>
        </div>
      )}

      {latest && (
        <section style={{ marginBottom: 56 }}>
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

      <h2 className="serif" style={{ fontSize: 24, marginBottom: 26 }}>Các số trước</h2>
      <div className="issue-grid auto">
        {older.map((i: any) => <IssueCard key={i.slug} i={i} />)}
      </div>
    </div>
  );
}
