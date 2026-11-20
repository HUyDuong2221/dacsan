'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import './v7.css';

export type Slide = { key: string; cat: string; title: string; excerpt: string; meta: string; href: string; img?: string | null };
export type TocItem = { slug: string; title: string; page: string };
export type TopicPost = { slug: string; issue: string; title: string; author: string };
export type Topic = { name: string; count: number; posts: TopicPost[] };
export type Act = { id: number; day: string; month: string; kind: string; title: string; url: string };
export type IssueItem = { slug: string; label: string; theme: string; cover: string | null; year: string; number: number };

export type HomeProps = {
  dateStr: string;
  site: Record<string, string>;
  issueCount: number;
  latest: null | { slug: string; label: string; theme: string; cover: string | null; pdf: string | null; articleCount: number; pageCount: number | null };
  slides: Slide[];
  toc: TocItem[];
  tocMore: number;
  stats: { v: string; l: string }[];
  topics: Topic[];
  acts: Act[];
  issues: IssueItem[];
};

const NAV = [
  { href: '/', label: 'Trang chủ' },
  { href: '/issues', label: 'Số đã phát hành' },
  { href: '/research', label: 'Nghiên cứu – Trao đổi' },
  { href: '/docs', label: 'Tư liệu' },
  { href: '/search', label: 'Tìm bài báo' },
];

const pad = (n: number) => (n < 10 ? '0' : '') + n;

export default function HomeV7(p: HomeProps) {
  const { site, latest, slides } = p;
  const [menu, setMenu] = useState(false);
  const [hero, setHero] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cover, setCover] = useState(false);
  const [topic, setTopic] = useState(0);
  const years = Array.from(new Set(p.issues.map((i) => i.year)));
  const [year, setYear] = useState(years[0] || '');
  const [email, setEmail] = useState('');
  const [sub, setSub] = useState<'idle' | 'ok' | 'err'>('idle');
  const n = Math.max(slides.length, 1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    timer.current = setInterval(() => setHero((h) => (h + 1) % slides.length), 6000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [paused, hero, slides.length]);

  // Điện thoại (không có hover): tự mở bìa sách khi cuộn tới block "Số mới nhất", gập lại khi cuộn qua.
  const book = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = book.current;
    if (!el || !window.matchMedia('(hover: none)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      ([e]) => setCover(e.isIntersecting),
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/v1/public/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setSub(r.ok ? 'ok' : 'err');
    if (r.ok) setEmail('');
  }

  const tp = p.topics[topic] || p.topics[0];
  const logo = site.logo_url || '/logo.jpg';
  const alt = 'Đặc san Khoa học & Phát triển thành phố Đà Nẵng';

  return (
    <div className="v7">
      <div className="v7-util">
        <div className="v7-w">
          <span className="nw">{p.dateStr}</span>
          <span className="v7-util-r">
            {site.issn && <span className="nw">ISSN {site.issn}</span>}
            <a href="https://lhh.danang.gov.vn" target="_blank" rel="noopener noreferrer" className="nw">lhh.danang.gov.vn ↗</a>
          </span>
        </div>
      </div>

      <header className="v7-mast">
        <div className="v7-w">
          <Link href="/" className="v7-logo" aria-label={alt}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt={alt} />
          </Link>
          <div className="v7-mast-meta">
            {latest && <span className="nw">{latest.label}</span>}
            <i className="hs">◆</i>
            <span className="hs nw">{(site.org_name || 'Liên hiệp các Hội KH&KT TP. Đà Nẵng')}</span>
            <i className="hs">◆</i>
            <span className="hs nw">Phát hành hai tháng một kỳ</span>
          </div>
        </div>
      </header>

      <nav className="v7-nav" aria-label="Điều hướng chính">
        <div className="v7-w">
          <Link href="/" className="v7-mini" aria-label="Trang chủ">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" />
          </Link>
          <button className="v7-ibtn v7-menu-btn" onClick={() => setMenu(!menu)} aria-label="Mở menu" aria-expanded={menu}>
            <span className="v7-bars"><span /><span /><span /></span>
          </button>
          <div className="v7-links">
            {NAV.map((m, i) => <Link key={m.href} href={m.href} className={i === 0 ? 'on' : ''}>{m.label}</Link>)}
          </div>
          <div className="v7-nav-r">
            <Link href="/search" className="v7-ibtn" aria-label="Tìm kiếm">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#03368D" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            </Link>
            <Link href="/gui-bai" className="v7-cta">Gửi bài</Link>
          </div>
        </div>
        {menu && (
          <div className="v7-drawer">
            <div className="v7-w">
              {NAV.map((m, i) => (
                <Link key={m.href} href={m.href} className={i === 0 ? 'on' : ''} onClick={() => setMenu(false)}>
                  {m.label}<span style={{ color: '#03368D' }} aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main>
        <section className="v7-w v7-front">
          <div className="v7-front-row">
            <article className="v7-lead" aria-roledescription="carousel" aria-label="Bài tiêu điểm"
              onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              <div className="v7-stage">
                <div className="v7-track" style={{ transform: `translateX(${-100 * hero}%)` }}>
                  {slides.map((s, i) => (
                    <Link key={s.key} href={s.href} className="v7-slide" aria-hidden={i !== hero} tabIndex={i === hero ? 0 : -1}>
                      {s.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.img} alt={s.title} />
                      ) : (
                        <span aria-hidden="true">{pad(i + 1)}</span>
                      )}
                    </Link>
                  ))}
                </div>
                <span className="v7-tag">TIÊU ĐIỂM</span>
                {slides.length > 1 && (
                  <div className="v7-arrows">
                    <button onClick={() => setHero((hero - 1 + n) % n)} aria-label="Bài trước">←</button>
                    <button onClick={() => setHero((hero + 1) % n)} aria-label="Bài sau">→</button>
                  </div>
                )}
              </div>
              <div className="v7-prog">
                <b>{pad(hero + 1)}<em> / {pad(slides.length)}</em></b>
                <div className="v7-bars-row">
                  {slides.map((s, i) => (
                    <button key={s.key} onClick={() => setHero(i)} aria-label={`Bài tiêu điểm ${i + 1}`} aria-current={i === hero}>
                      <span style={{ background: i === hero ? '#03368D' : i < hero ? '#8FA3CF' : '#DCE1EB' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="v7-texts" aria-live="polite">
                {slides.map((s, i) => (
                  <div key={s.key} className="v7-text" aria-hidden={i !== hero}
                    style={{ opacity: i === hero ? 1 : 0, transform: `translateY(${i === hero ? 0 : 8}px)`, visibility: i === hero ? 'visible' : 'hidden' }}>
                    <div className="v7-cat">{s.cat}</div>
                    <h2><Link href={s.href} data-hl tabIndex={i === hero ? 0 : -1}>{s.title}</Link></h2>
                    {s.excerpt && <p>{s.excerpt}</p>}
                    {s.meta && <div className="v7-meta"><span>{s.meta}</span></div>}
                  </div>
                ))}
              </div>
            </article>

            <aside className="v7-side">
              <div className="v7-side-h"><h2>SỐ MỚI NHẤT</h2></div>
              {latest ? (
                <>
                  <div className="v7-bookwrap" data-open={cover} ref={book}>
                    <div className="v7-book">
                      <div className="v7-bshadow" />
                      <div className="v7-binner">
                        <div className="v7-binner-h">
                          <b>MỤC LỤC</b><span>{latest.label.toUpperCase()}</span>
                        </div>
                        <ol>
                          {p.toc.map((t, i) => (
                            <li key={t.slug}>
                              <Link href={`/articles/${t.slug}`}>
                                <b>{pad(i + 1)}</b><span data-hl>{t.title}</span><i>{t.page}</i>
                              </Link>
                            </li>
                          ))}
                        </ol>
                        {p.tocMore > 0 && <Link href={`/issues/${latest.slug}`}>+ {p.tocMore} bài khác →</Link>}
                      </div>
                      <div className="v7-bcover">
                        <div className="v7-face front">
                          {latest.cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={latest.cover} alt={`Bìa ${latest.label}`} />
                          ) : (
                            <div className="ph"><small>ĐẶC SAN</small><strong>Khoa học &amp; Phát triển</strong><small>THÀNH PHỐ ĐÀ NẴNG</small><em>{latest.label}</em></div>
                          )}
                        </div>
                        <div className="v7-face back"><span>Khoa học &amp; Phát triển<br />Đà Nẵng</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="v7-iss-meta">
                    <b>{latest.label.toUpperCase()}</b>
                    <span>{latest.articleCount} bài{latest.pageCount ? ` · ${latest.pageCount} trang` : ''}</span>
                  </div>
                  <div className="v7-iss-theme">{latest.theme}</div>
                  <button className="v7-link" onClick={() => setCover(!cover)} aria-pressed={cover}>
                    {cover ? 'Gập bìa lại' : 'Mở bìa xem mục lục'}
                  </button>
                  <div className="v7-btns">
                    <Link href={`/issues/${latest.slug}`} className="p">Mục lục đầy đủ</Link>
                    {latest.pdf && <a href={latest.pdf} className="g" target="_blank" rel="noopener noreferrer">Tải PDF</a>}
                  </div>
                </>
              ) : (
                <p style={{ color: '#5B6478' }}>Chưa có số nào được phát hành.</p>
              )}
            </aside>
          </div>
        </section>

        <section className="v7-stats">
          <div className="v7-w">
            {p.stats.map((s) => (
              <div key={s.l} className="v7-stat"><b>{s.v}</b><span>{s.l}</span></div>
            ))}
          </div>
        </section>

        {tp && (
          <section className="v7-w v7-topics">
            <div className="v7-sec-h">
              <h2 className="v7-h2">Chuyên mục</h2>
              <p>Chọn một chuyên mục để xem các bài trong số mới nhất.</p>
            </div>
            <div className="v7-tabs" role="tablist" aria-label="Chuyên mục">
              {p.topics.map((t, i) => (
                <button key={t.name} role="tab" aria-selected={i === topic} className={i === topic ? 'on' : ''} onClick={() => setTopic(i)}>
                  {t.name} <em>{t.count}</em>
                </button>
              ))}
            </div>
            <div className="v7-tbody" key={topic}>
              <div className="v7-tintro">
                <i aria-hidden="true" />
                <h3>{tp.name}</h3>
                <p>{tp.count} bài trong số mới nhất{latest ? ` (${latest.label})` : ''}.</p>
                {latest && <Link href={`/issues/${latest.slug}`}>Xem mục lục <span aria-hidden="true">→</span></Link>}
              </div>
              <div className="v7-tposts">
                {tp.posts.map((a) => (
                  <Link key={a.slug} href={`/articles/${a.slug}`} className="v7-tcard">
                    <small>{a.issue}</small>
                    <strong>{a.title}</strong>
                    <div><span>{a.author}</span><b aria-hidden="true">→</b></div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {p.acts.length > 0 && (
          <section className="v7-w v7-acts">
            <div className="v7-acts-h">
              <h2 className="v7-h2">Tin hoạt động</h2>
              <a href="https://lhh.danang.gov.vn/chi-tiet-tin-tuc?danhmuc=1" target="_blank" rel="noopener noreferrer">Xem tất cả trên lhh.danang.gov.vn ↗</a>
            </div>
            <div className="v7-acts-g">
              {p.acts.map((a) => (
                <a key={a.id} className="v7-act" href={a.url || 'https://lhh.danang.gov.vn/chi-tiet-tin-tuc?danhmuc=1'} target="_blank" rel="noopener noreferrer">
                  <span className="d"><b>{a.day}</b><small>{a.month}</small></span>
                  <span><em>{a.kind}</em><strong data-hl>{a.title}</strong></span>
                </a>
              ))}
            </div>
          </section>
        )}

        {years.length > 0 && (
          <section className="v7-arch">
            <div className="v7-w">
              <div className="v7-arch-h">
                <h2 className="v7-h2">Kho lưu trữ</h2>
                <div className="v7-years" role="tablist" aria-label="Năm phát hành">
                  {years.map((y) => (
                    <button key={y} role="tab" aria-selected={y === year} className={y === year ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>
                  ))}
                </div>
              </div>
              <div className="v7-grid">
                {p.issues.filter((i) => i.year === year).map((i) => (
                  <Link key={i.slug} href={`/issues/${i.slug}`} className="v7-iss">
                    <div className="c">
                      {i.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.cover} alt={`Bìa ${i.label}`} />
                      ) : (
                        <span>Số {i.number}</span>
                      )}
                    </div>
                    <b>{i.label}</b>
                    {i.theme && <strong>{i.theme}</strong>}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="v7-w v7-submit" id="gui-bai">
          <div className="v7-submit-row">
            <div className="v7-sbox">
              <div>
                <small>CỘNG TÁC VỚI ĐẶC SAN</small>
                <h3>Gửi bài cho Đặc san</h3>
                <p>Bản thảo nhận liên tục. Xem thể lệ gửi bài, quy định xuất bản và đạo đức công bố khoa học trước khi gửi.</p>
              </div>
              <Link href="/gui-bai">Hướng dẫn gửi bài →</Link>
            </div>
            <div className="v7-nbox" id="dang-ky">
              <h3>Nhận thông báo số mới</h3>
              <p>Mỗi hai tháng một email khi số mới lên web.</p>
              <form onSubmit={subscribe}>
                <label htmlFor="v7-email">Email</label>
                <div className="v7-nform">
                  <input id="v7-email" type="email" required placeholder="ten@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button type="submit">Đăng ký</button>
                </div>
                {sub === 'ok' && <div className="v7-nmsg ok">Đã đăng ký. Cảm ơn bạn!</div>}
                {sub === 'err' && <div className="v7-nmsg err">Email không hợp lệ.</div>}
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="v7-foot">
        <div className="v7-w">
          <div className="v7-foot-row">
            <div className="v7-foot-brand">
              <div className="t">Đặc san Khoa học &amp; Phát triển<small>THÀNH PHỐ ĐÀ NẴNG</small></div>
              {site.org_name && <p style={{ margin: 0, color: '#AFC2EA' }}>Cơ quan chủ quản: {site.org_name}</p>}
            </div>
            {site.contact && (
              <div>
                <h4>LIÊN HỆ</h4>
                {site.contact.split('\n').map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
            <div>
              <h4>GIẤY PHÉP</h4>
              {site.license && <div>{site.license}</div>}
              {site.issn && <div>ISSN {site.issn}</div>}
            </div>
          </div>
          <div className="v7-foot-bot">
            <span>© {new Date().getFullYear()} Đặc san Khoa học &amp; Phát triển thành phố Đà Nẵng</span>
          </div>
        </div>
      </footer>

      <button className="v7-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Về đầu trang">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V6" /><path d="M6 12l6-6 6 6" /></svg>
      </button>
    </div>
  );
}
