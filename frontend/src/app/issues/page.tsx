import type { Metadata } from 'next';
import Link from 'next/link';
import { fmtDate, get } from '@/lib/api';
import { Cover, IssueCard, SearchBox } from '@/components/Parts';

export const metadata: Metadata = { title: 'Các số đã phát hành' };

export default async function Issues() {
  const d = await get('/issues');
  const [latest, ...older] = d.issues;
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

      {d.notices.length > 0 && (
        <div className="box tint" style={{ marginBottom: 44 }}>
          <div className="kicker" style={{ marginBottom: 16 }}>Thông báo của tòa soạn</div>
          <div className="notice-grid">
            {d.notices.map((n: any) => (
              <article key={n.id}>
                <div className="row mono" style={{ fontSize: 11, gap: 10 }}>
                  <span className="tag" style={{ border: '1px solid var(--line2)', padding: '3px 7px' }}>{n.tag}</span>
                  <span style={{ color: 'var(--faint)' }}>{fmtDate(n.date)}</span>
                </div>
                <h3>{n.title}</h3>
              </article>
            ))}
          </div>
        </div>
      )}

      <h2 className="serif" style={{ fontSize: 24, marginBottom: 26 }}>Các số trước</h2>
      <div className="issue-grid auto">
        {older.map((i: any) => <IssueCard key={i.slug} i={i} />)}
      </div>
    </div>
  );
}
