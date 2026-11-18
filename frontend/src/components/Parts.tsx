import Link from 'next/link';
import { fmtDate } from '@/lib/api';

export function Cover({ issue, text, shim }: { issue: any; text?: string; shim?: boolean }) {
  const label = text ?? `bìa số ${String(issue.number).padStart(2, '0')}`;
  return (
    <div className={`cover ${shim ? 'shim' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {issue.cover_url && <img src={issue.cover_url} alt={`Bìa ${issue.label}`} />}
      {!issue.cover_url && <span>{label}</span>}
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
      <Cover issue={i} shim />
      <div className="lab">{i.label.toUpperCase()}</div>
      <h3>{i.theme}</h3>
      {!dark && (
        <div className="muted" style={{ marginTop: 'auto', fontSize: 13 }}>
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
          <span className="d">{fmtDate(a.date)}</span>
          <span>
            <span className="ti">{a.title}</span>
            <span className="ki">{a.kind}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

export function SearchBox({
  action = '/search',
  placeholder = 'Tìm theo tiêu đề, tác giả hoặc chuyên mục',
  hidden,
  defaultValue,
  button = true,
  large,
}: any) {
  return (
    <form action={action} className="row" style={{ flexWrap: 'nowrap', flex: 1, minWidth: 240 }}>
      {hidden && Object.entries(hidden).map(([k, v]: any) => <input key={k} type="hidden" name={k} value={v} />)}
      <input className={`input ${large ? 'lg' : ''}`} name="q" placeholder={placeholder} defaultValue={defaultValue} minLength={2} required />
      {button && <button className="btn">Tìm</button>}
    </form>
  );
}
