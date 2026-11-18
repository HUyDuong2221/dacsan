import Link from 'next/link';
import { fmtDate } from '@/lib/api';

export function Cover({ issue, large }: { issue: any; large?: boolean }) {
  return (
    <div className={`cover ${large ? 'lg' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {issue.cover_url && <img src={issue.cover_url} alt={`Bìa ${issue.label}`} />}
      {!issue.cover_url && <span>bìa {issue.label.toLowerCase()}</span>}
    </div>
  );
}

export function ArticleCard({ a }: { a: any }) {
  return (
    <Link href={`/articles/${a.slug}`} className="card">
      <div className="tag">{a.field}</div>
      <h3>{a.title}</h3>
      <div className="meta">{a.author} · {a.page_label}</div>
    </Link>
  );
}

export function IssueCard({ i, dark }: { i: any; dark?: boolean }) {
  return (
    <Link href={`/issues/${i.slug}`} className="issue-card">
      <Cover issue={i} />
      <div className="tag" style={dark ? { color: '#ff9b72' } : undefined}>{i.label}</div>
      <h3 style={dark ? { color: '#eaf6ff' } : undefined}>{i.theme}</h3>
      {!dark && (
        <div className="muted" style={{ marginTop: 'auto' }}>
          {i.article_count} bài{i.page_count ? ` · ${i.page_count} trang` : ''}
        </div>
      )}
    </Link>
  );
}

export function Activities({ items }: { items: any[] }) {
  return (
    <div>
      {items.map((a) => (
        <a key={a.id} className="act" href={a.url || '#'} target="_blank" rel="noopener noreferrer">
          <span className="mono muted" style={{ fontSize: 12 }}>{fmtDate(a.date)}</span>
          <span>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>{a.title}</span>
            <span className="muted">{a.kind}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

export function SearchBox({ action = '/search', placeholder = 'Tìm theo tiêu đề, tác giả hoặc chuyên mục', hidden, defaultValue }: any) {
  return (
    <form action={action} className="row" style={{ flexWrap: 'nowrap' }}>
      {hidden && Object.entries(hidden).map(([k, v]: any) => <input key={k} type="hidden" name={k} value={v} />)}
      <input className="input" name="q" placeholder={placeholder} defaultValue={defaultValue} minLength={2} required />
      <button className="btn">Tìm</button>
    </form>
  );
}
