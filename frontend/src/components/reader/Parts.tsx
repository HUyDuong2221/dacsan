import Link from 'next/link';

export function Cover({ issue, text }: { issue: any; text?: string }) {
  const label = text ?? `bìa số ${String(issue.number).padStart(2, '0')}`;
  return (
    <div className="cover">
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
