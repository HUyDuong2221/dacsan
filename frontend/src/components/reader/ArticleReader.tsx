'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Portal from '../ui/Portal';
import PdfReader from './PdfReader';
import { parseBody as parse } from '@/lib/body';
import './article.css';

const I = {
  toc: 'M4 6h16M4 12h16M4 18h10',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  prev: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  quote: 'M7 7h4v4c0 3-2 5-4 5M14 7h4v4c0 3-2 5-4 5',
  share: 'M8 12h8M15 8l4 4-4 4M4 5v14',
  pdf: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 13h5M9.5 16.5h5',
};
const Ico = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>
);

export default function ArticleReader({ a }: { a: any }) {
  const [size, setSize] = useState(18);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [scope, setScope] = useState<'issue' | 'all'>('issue');
  const [note, setNote] = useState('');
  // "Nội dung bài": mở sẵn trên máy tính, gập trên điện thoại cho đỡ chiếm chỗ
  const contents = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (contents.current && window.matchMedia('(min-width: 961px)').matches) contents.current.open = true;
  }, []);
  const blocks = parse(a.body || '');
  const pageNo = parseInt(String(a.page_label).replace(/\D/g, ''), 10);
  const pdfHref = `/issues/${a.issue.slug}/pdf${pageNo > 0 ? `?page=${pageNo}` : ''}`;
  // mục lục của số cho nút "Mục lục" trong trình đọc PDF (số trong page_label = trang của file PDF)
  const pdfToc = (a.issue_toc || []).map((g: any) => ({
    name: g.field,
    items: g.items.map((it: any) => ({ title: it.title, author: it.author || '', page: parseInt(String(it.page_label || '').replace(/\D/g, ''), 10) || 0 })),
  }));

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
    <div className="ar">
      {/* Thanh công cụ dính dưới menu: một hàng duy nhất */}
      <div className="ar-bar">
        <div className="ar-w ar-bar-in">
          <button type="button" className="ar-btn" onClick={() => setDrawer(true)}><Ico d={I.toc} /><span>Mục lục số</span></button>
          <span className="ar-pos">
            <Link href={`/issues/${a.issue.slug}`}>{a.issue.label}</Link>
            <i>Bài {a.position.index}/{a.position.total}</i>
          </span>
          <div className="ar-bar-r">
            <button type="button" className={'ar-ib ar-find' + (search ? ' on' : '')} onClick={() => setSearch(!search)} aria-label="Tìm kiếm" aria-expanded={search}><Ico d={I.search} /></button>
            <Link href={`/articles/${a.prev.slug}`} className="ar-ib" aria-label={`Bài trước: ${a.prev.title}`} title={a.prev.title}><Ico d={I.prev} /></Link>
            <Link href={`/articles/${a.next.slug}`} className="ar-ib" aria-label={`Bài sau: ${a.next.title}`} title={a.next.title}><Ico d={I.next} /></Link>
          </div>
        </div>
        {search && (
          <form action="/search" className="ar-w ar-search">
            {scope === 'issue' && <input type="hidden" name="issue" value={a.issue.slug} />}
            <input name="q" required minLength={2} placeholder="Nhập từ khóa hoặc tên tác giả" aria-label="Từ khóa" autoFocus />
            <div className="ar-seg" role="group" aria-label="Phạm vi tìm">
              {(['issue', 'all'] as const).map((s) => (
                <button type="button" key={s} className={scope === s ? 'on' : ''} aria-pressed={scope === s} onClick={() => setScope(s)}>
                  {s === 'issue' ? 'Trong số này' : 'Toàn bộ'}
                </button>
              ))}
            </div>
            <button className="ar-go">Tìm</button>
          </form>
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
                <button className="btn ghost sm" onClick={() => setDrawer(false)} aria-label="Đóng">✕</button>
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

      {/* Đầu bài */}
      <header className="ar-head">
        <div className="ar-w">
          <nav className="ar-crumb" aria-label="Đường dẫn">
            <Link href="/issues">Đặc san</Link><span aria-hidden="true">›</span><Link href={`/issues/${a.issue.slug}`}>{a.issue.label}</Link>
          </nav>
          {a.field && <div className="ar-field">{a.field}</div>}
          <h1>{a.title}</h1>
          <div className="ar-by">
            {a.author && <b>{a.author}</b>}
            <span>{a.issue.label} · {a.page_label}</span>
          </div>
          {/* Các nút chức năng gom về một hàng */}
          <div className="ar-tools">
            {a.has_fulltext && (
              <div className="ar-seg" role="group" aria-label="Cỡ chữ">
                <button type="button" onClick={() => setSize((s) => Math.max(14, s - 1))} aria-label="Giảm cỡ chữ">A−</button>
                <button type="button" onClick={() => setSize((s) => Math.min(26, s + 1))} aria-label="Tăng cỡ chữ">A+</button>
              </div>
            )}
            <button type="button" className="ar-btn" onClick={() => copy(a.citation, 'Đã sao chép trích dẫn')}><Ico d={I.quote} /><span>Trích dẫn</span></button>
            <button type="button" className="ar-btn" onClick={() => copy(window.location.href, 'Đã sao chép liên kết')}><Ico d={I.share} /><span>Chia sẻ</span></button>
            {a.pdf_url && a.has_fulltext && <Link className="ar-btn" href={pdfHref}><Ico d={I.pdf} /><span>Bản in PDF</span></Link>}
            <span className="ar-note" role="status" aria-live="polite">{note}</span>
          </div>
        </div>
      </header>

      <div className="ar-w ar-grid">
        {a.has_fulltext && a.toc.length > 0 && (
          <aside className="ar-side">
            <details className="ar-contents" ref={contents}>
              <summary>Nội dung bài</summary>
              <nav>
                {a.toc.map((t: string, k: number) => (
                  <a key={k} href={a.lead && k === 0 ? '#h-lead' : `#h-${a.lead ? k - 1 : k}`}>{t}</a>
                ))}
              </nav>
            </details>
          </aside>
        )}

        <article className="ar-main">
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
          ) : a.pdf_url ? (
            // Chưa có toàn văn: hiển thị luôn trang in trong tệp PDF của số, không cần bấm thêm.
            <div className="ar-pdf">
              <PdfReader
                embed
                src={a.pdf_url}
                page={pageNo > 0 ? pageNo : 0}
                title={`Bản in · ${a.title}`}
                meta={`${a.issue.label}${a.page_label ? ` · ${a.page_label}` : ''}`}
                toc={pdfToc}
                stats={a.preview ? undefined : { issue: a.issue.slug, article: a.slug }}
              />
              <p className="ar-hint">
                Bài này chưa có toàn văn trên web, đây là trang in trong {a.issue.label.toLowerCase()}.{' '}
                <Link href={pdfHref}>Mở toàn màn hình</Link>
              </p>
            </div>
          ) : (
            <div className="leadbox" style={{ padding: 28 }}>
              <div className="kicker" style={{ marginBottom: 12 }}>Chưa có toàn văn trên web</div>
              <p style={{ fontStyle: 'normal', fontSize: 17, marginBottom: 20 }}>
                Bài này hiện chỉ có trong bản in {a.issue.label.toLowerCase()}. Bản số hóa toàn văn đang được biên tập và sẽ cập nhật tại đây.
              </p>
              <button type="button" className="ar-btn" onClick={() => setDrawer(true)}><Ico d={I.toc} /><span>Mở mục lục số</span></button>
            </div>
          )}

          <section className="ar-cite" aria-label="Trích dẫn nguồn">
            <h2>Trích dẫn nguồn</h2>
            <p>{a.citation}</p>
            <button type="button" className="ar-btn" onClick={() => copy(a.citation, 'Đã sao chép trích dẫn')}><Ico d={I.quote} /><span>Sao chép trích dẫn</span></button>
          </section>

          <nav className="ar-pn" aria-label="Bài trước, bài sau">
            <Link href={`/articles/${a.prev.slug}`}><small>← Bài trước</small><span>{a.prev.title}</span></Link>
            <Link href={`/articles/${a.next.slug}`} className="r"><small>Bài sau →</small><span>{a.next.title}</span></Link>
          </nav>

          {a.related.length > 0 && (
            <section className="ar-related">
              <h2>Cùng số này</h2>
              <div>
                {a.related.map((r: any) => (
                  <Link key={r.slug} href={`/articles/${r.slug}`}>{r.title}</Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}
