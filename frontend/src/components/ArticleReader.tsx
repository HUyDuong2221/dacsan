'use client';
import Link from 'next/link';
import { useState } from 'react';
import Portal from './Portal';

type Block = { t: 'h'; text: string; id: string } | { t: 'p'; text: string } | { t: 'img'; alt: string; src: string };

function parse(body: string): Block[] {
  const out: Block[] = [];
  let h = 0;
  for (const raw of body.split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split('\n');
    if (lines[0].startsWith('## ')) {
      out.push({ t: 'h', text: lines[0].slice(3).trim(), id: `h-${h++}` });
      const rest = lines.slice(1).join(' ').trim();
      if (rest) out.push({ t: 'p', text: rest });
      continue;
    }
    const m = block.match(/^!\[(.*)\]\((.+)\)$/);
    if (m && (m[2].startsWith('/') || m[2].startsWith('https://'))) out.push({ t: 'img', alt: m[1], src: m[2] });
    else out.push({ t: 'p', text: lines.join(' ') });
  }
  return out;
}

export default function ArticleReader({ a }: { a: any }) {
  const [size, setSize] = useState(18);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [scope, setScope] = useState<'issue' | 'all'>('issue');
  const [note, setNote] = useState('');
  const blocks = parse(a.body || '');
  const pageNo = parseInt(String(a.page_label).replace(/\D/g, ''), 10);
  const pdfHref = `/issues/${a.issue.slug}/pdf${pageNo > 0 ? `?page=${pageNo}` : ''}`;
  let hi = 0;

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNote(msg);
    } catch {
      setNote('Không sao chép được');
    }
    setTimeout(() => setNote(''), 2000);
  }

  return (
    <>
      <div className="ctx">
        <div className="wrap">
          <div className="row" style={{ gap: 12 }}>
            <button className="btn ghost sm" onClick={() => setDrawer(true)}>☰ Mục lục số</button>
            <Link href={`/issues/${a.issue.slug}`} style={{ color: '#32424c', fontSize: 14 }}>Đặc san {a.issue.label.toLowerCase()}</Link>
            <span className="mono muted" style={{ fontSize: 11.5 }}>Bài {a.position.index}/{a.position.total}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost sm" onClick={() => setSearch(!search)}>Tìm kiếm</button>
            <Link href={`/articles/${a.prev.slug}`} className="btn ghost sm" title={a.prev.title}>←</Link>
            <Link href={`/articles/${a.next.slug}`} className="btn ghost sm" title={a.next.title}>→</Link>
          </div>
        </div>
        {search && (
          <div style={{ borderTop: '1px solid var(--line)', background: 'var(--tint)' }}>
            <form action="/search" className="wrap row" style={{ padding: '14px 28px' }}>
              {scope === 'issue' && <input type="hidden" name="issue" value={a.issue.slug} />}
              <input className="input" name="q" required minLength={2} placeholder="Nhập từ khóa hoặc tên tác giả" style={{ flex: '1 1 260px', width: 'auto' }} />
              <div className="row" style={{ gap: 0 }}>
                {(['issue', 'all'] as const).map((s) => (
                  <button type="button" key={s} className={`chip ${scope === s ? 'on' : ''}`} onClick={() => setScope(s)}>
                    {s === 'issue' ? 'Trong số này' : 'Toàn bộ đặc san'}
                  </button>
                ))}
              </div>
              <button className="btn">Tìm</button>
            </form>
          </div>
        )}
      </div>

      {drawer && (
        <Portal>
        <div className="drawer-wrap">
          <div className="drawer-bg" onClick={() => setDrawer(false)} />
          <aside className="drawer">
            <div className="row" style={{ justifyContent: 'space-between', padding: '22px 26px 18px', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
              <div>
                <div className="kicker" style={{ marginBottom: 8 }}>Mục lục số này</div>
                <div className="serif" style={{ fontSize: 20, fontWeight: 700 }}>Đặc san Khoa học &amp; Phát triển — {a.issue.label.toLowerCase()}</div>
              </div>
              <button className="btn ghost sm" onClick={() => setDrawer(false)}>✕</button>
            </div>
            <div className="list">
              {a.issue_toc.map((g: any) => (
                <div key={g.field} style={{ paddingTop: 14 }}>
                  <div className="tag" style={{ padding: '0 26px 8px' }}>{g.field}</div>
                  {g.items.map((it: any) => (
                    <Link key={it.slug} href={`/articles/${it.slug}`} className={it.slug === a.slug ? 'cur' : ''} onClick={() => setDrawer(false)}>
                      <span style={{ flex: 1 }}>{it.title}</span>
                      <span className="mono muted" style={{ fontSize: 11 }}>{it.page_label.replace('tr. ', '')}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>
        </Portal>
      )}

      <div className="ahead">
        <div className="wrap">
          <div className="muted row" style={{ gap: 10 }}>
            <Link href="/issues">Đặc san</Link>/<Link href={`/issues/${a.issue.slug}`}>{a.issue.label}</Link>/<span>{a.field}</span>
          </div>
          <h1>{a.title}</h1>
          <div style={{ fontSize: 16.5, color: '#32424c', marginBottom: 20 }}>{a.author}</div>
          <div className="row mono muted" style={{ gap: 22, fontSize: 12 }}>
            <span>{a.issue.label.toUpperCase()}</span><span>{(a.field || '').toUpperCase()}</span><span>{a.page_label.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="wrap alayout">
        <aside className="aside-l">
          {a.has_fulltext && <div className="mono muted" style={{ fontSize: 11.5, letterSpacing: '.08em', marginBottom: 12 }}>NỘI DUNG BÀI</div>}
          <nav>
            {a.toc.map((t: string, k: number) => (
              <a key={k} href={a.lead && k === 0 ? '#h-lead' : `#h-${a.lead ? k - 1 : k}`}>{t}</a>
            ))}
          </nav>
          <div style={{ marginTop: 26 }}>
            <div className="mono muted" style={{ fontSize: 11.5, letterSpacing: '.08em', marginBottom: 10 }}>CỠ CHỮ</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost sm" onClick={() => setSize((s) => Math.max(14, s - 1))}>A−</button>
              <button className="btn ghost sm" onClick={() => setSize((s) => Math.min(26, s + 1))}>A+</button>
            </div>
          </div>
        </aside>

        <article className="art">
          {a.has_fulltext ? (
            <>
              {a.lead && (
                <div className="leadbox" id="h-lead">
                  <div className="kicker" style={{ marginBottom: 12 }}>Lời dẫn</div>
                  <p>{a.lead}</p>
                </div>
              )}
              <div className="body" style={{ fontSize: size }}>
                {blocks.map((b, k) =>
                  b.t === 'h' ? <h2 key={k} id={b.id}>{b.text}</h2>
                  : b.t === 'img' ? (
                    <figure key={k}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.src} alt={b.alt} />
                      {b.alt && <figcaption>{b.alt}</figcaption>}
                    </figure>
                  ) : <p key={k}>{b.text}</p>,
                )}
              </div>
            </>
          ) : (
            <div className="leadbox" style={{ padding: 32 }}>
              <div className="kicker" style={{ marginBottom: 12 }}>Chưa có toàn văn trên web</div>
              <p style={{ fontStyle: 'normal', fontSize: 17, marginBottom: 20 }}>
                Bài này hiện chỉ có trong bản in {a.issue.label.toLowerCase()}. Bản số hóa toàn văn đang được biên tập và sẽ cập nhật tại đây.
              </p>
              <div className="row">
                {a.pdf_url && <Link className="btn" href={pdfHref}>Xem trang in ({a.page_label})</Link>}
                <button className="btn ghost" onClick={() => setDrawer(true)}>Mở mục lục số</button>
              </div>
            </div>
          )}

          <nav className="pn">
            <Link href={`/articles/${a.prev.slug}`}><span className="tag">← Bài trước</span><span className="t">{a.prev.title}</span></Link>
            <Link href={`/articles/${a.next.slug}`} className="r"><span className="tag">Bài sau →</span><span className="t">{a.next.title}</span></Link>
          </nav>
        </article>

        <aside className="aside-r">
          <div className="box" style={{ margin: 0, padding: 20 }}>
            <div className="mono muted" style={{ fontSize: 11.5, letterSpacing: '.08em', marginBottom: 12 }}>TRÍCH DẪN NGUỒN</div>
            <p style={{ fontSize: 13.5, lineHeight: 1.65, margin: '0 0 14px' }}>{a.citation}</p>
            <button className="btn ghost" style={{ width: '100%' }} onClick={() => copy(a.citation, 'Đã sao chép trích dẫn')}>
              {note || 'Sao chép trích dẫn'}
            </button>
          </div>
          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            {a.pdf_url ? <Link className="btn ghost" href={pdfHref}>Đọc PDF bản in của số</Link> : <span className="btn ghost disabled">Chưa có PDF của số</span>}
            <button className="btn ghost" onClick={() => copy(window.location.href, 'Đã sao chép liên kết')}>Chia sẻ liên kết</button>
          </div>
          {a.related.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 18 }}>
              <div className="mono muted" style={{ fontSize: 11.5, letterSpacing: '.08em', marginBottom: 12 }}>CÙNG SỐ NÀY</div>
              {a.related.map((r: any) => (
                <Link key={r.slug} href={`/articles/${r.slug}`} className="serif" style={{ display: 'block', fontSize: 15.5, lineHeight: 1.4, marginBottom: 14 }}>{r.title}</Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
