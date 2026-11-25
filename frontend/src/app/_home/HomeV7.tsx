'use client';
import Link from 'next/link';
import IssueTile, { type IssueTileData } from '@/components/reader/IssueTile';
import { Fragment, useEffect, useRef, useState } from 'react';
import BannerSlider from '@/components/site/BannerSlider';
import { BANNER_POSITIONS, parseLayouts, type BannerItem, type BannerPosition } from '@/lib/banners';
import { parseHomeLayout, type HomeBlockKey } from '@/lib/homeLayout';
import './v7.css';

type Slide = { key: string; cat: string; title: string; excerpt: string; meta: string; href: string; img?: string | null };
type TocItem = { slug: string; title: string; page: string };
type TopicIssue = IssueTileData;
type Topic = { name: string; count: number; issues: TopicIssue[] };
type Act = { id: number; day: string; month: string; kind: string; title: string; url: string };
type PostCard = { slug: string; title: string; author: string; date: string; excerpt: string; cover: string | null };
type IssueItem = { slug: string; label: string; theme: string; cover: string | null; year: string; number: number };

export type HomeProps = {
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
  banners: BannerItem[];
  posts: PostCard[];
};

const pad = (n: number) => (n < 10 ? '0' : '') + n;

export default function HomeV7(p: HomeProps) {
  const { latest, slides } = p;
  const [hero, setHero] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cover, setCover] = useState(false);
  const [topic, setTopic] = useState(0);
  const years = Array.from(new Set(p.issues.map((i) => i.year)));
  const [year, setYear] = useState(years[0] || '');
  // Kho lưu trữ: máy tính hiện 10 số (2 hàng x 5), điện thoại 6 số (2 hàng x 3);
  // bấm "Xem thêm" hiện tiếp từng ấy số cho đến hết.
  const [archStep, setArchStep] = useState(10);
  const [archShown, setArchShown] = useState(10);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const apply = () => { const n = mq.matches ? 6 : 10; setArchStep(n); setArchShown(n); };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const archIssues = p.issues.filter((i) => i.year === year);
  const [email, setEmail] = useState('');
  const [sub, setSub] = useState<'idle' | 'ok' | 'err'>('idle');
  const [subMsg, setSubMsg] = useState('');
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
    const j = await r.json().catch(() => ({}));
    setSub(r.ok ? 'ok' : 'err');
    setSubMsg(typeof j.message === 'string' ? j.message : typeof j.detail === 'string' ? j.detail : '');
    if (r.ok) setEmail('');
  }

  const tp = p.topics[topic] || p.topics[0];
  // Banner theo vị trí (admin: Giao diện › Banner trang chủ); cùng vị trí thành slider, kích thước theo vị trí.
  const layouts = parseLayouts(p.site.banner_layout);
  const zone = (pos: BannerPosition) => {
    if (layouts[pos].hidden) return null; // cả vị trí đang ẩn (admin: Banner trang chủ › Cấu hình theo vị trí)
    const items = (p.banners || []).filter((b) => b.position === pos);
    const label = BANNER_POSITIONS.find((x) => x.value === pos)!.label;
    return items.length ? <BannerSlider items={items} layout={layouts[pos]} label={`Banner: ${label}`} /> : null;
  };

  // Bố cục (admin: Giao diện › Bố cục trang chủ): thứ tự, bật/tắt và tiêu đề của từng khối. Banner đi theo khối đứng sau nó.
  const layout = parseHomeLayout(p.site.home_layout);
  const ttl = (k: HomeBlockKey) => layout.find((b) => b.key === k)?.title || '';
  const blocks: Record<HomeBlockKey, React.ReactNode> = {
    front: (
      <>
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
                  <div className="v7-btns">
                    <Link href={`/issues/${latest.slug}`} className="p">Mục lục đầy đủ</Link>
                    {latest.pdf && <Link href={`/issues/${latest.slug}/pdf`} className="g">Đọc bản PDF</Link>}
                  </div>
                </>
              ) : (
                <p style={{ color: '#5B6478' }}>Chưa có số nào được phát hành.</p>
              )}
            </aside>
          </div>
        </section>

        {zone('after_front')}
      </>
    ),
    stats: (
        <section className="v7-stats">
          <div className="v7-w">
            {p.stats.map((s) => (
              <div key={s.l} className="v7-stat"><b>{s.v}</b><span>{s.l}</span></div>
            ))}
          </div>
        </section>
    ),
    topics: (
      <>
        {zone('before_topics')}

        {tp && (
          <section className="v7-w v7-topics">
            <div className="v7-sec-h">
              <h2 className="v7-h2">{ttl('topics')}</h2>
            </div>
            <div className="v7-tabs" role="tablist" aria-label="Chuyên mục">
              {p.topics.map((t, i) => (
                <button key={t.name} role="tab" aria-selected={i === topic} className={i === topic ? 'on' : ''} onClick={() => setTopic(i)}>
                  {t.name}
                </button>
              ))}
            </div>
            <div className="v7-tbody" key={topic}>
              <div className="v7-tintro">
                <i aria-hidden="true" />
                <h3>{tp.name}</h3>
                <Link href="/issues">Xem tất cả các số <span aria-hidden="true">→</span></Link>
              </div>
              {tp.issues.length > 0 ? (
                <div className="v7-tposts itile-grid">
                  {tp.issues.map((s) => <IssueTile key={s.slug} s={s} />)}
                </div>
              ) : null}
            </div>
          </section>
        )}
      </>
    ),
    posts: (
      <>
        {p.posts.length > 0 && (
          <section className="v7-w v7-posts">
            <div className="v7-acts-h">
              <h2 className="v7-h2">{ttl('posts')}</h2>
              <Link href="/bai-viet">Xem tất cả bài viết →</Link>
            </div>
            <div className="v7-posts-g">
              {p.posts.map((x) => (
                <Link key={x.slug} href={`/bai-viet/${x.slug}`} className="v7-post">
                  <span className="pc">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {x.cover && <img src={x.cover} alt="" loading="lazy" />}
                  </span>
                  <strong data-hl>{x.title}</strong>
                  {(x.author || x.date) && <small>{[x.author, x.date].filter(Boolean).join(' · ')}</small>}
                  {x.excerpt && <span className="px">{x.excerpt}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </>
    ),
    acts: (
      <>
        {zone('before_acts')}

        {p.acts.length > 0 && (
          <section className="v7-w v7-acts">
            <div className="v7-acts-h">
              <h2 className="v7-h2">{ttl('acts')}</h2>
              <Link href="/tin-hoat-dong">Xem tất cả tin hoạt động →</Link>
            </div>
            <div className="v7-acts-g">
              {p.acts.map((a) => (
                <a key={a.id} className="v7-act" href={a.url} {...(a.url.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  <span className="d"><b>{a.day}</b><small>{a.month}</small></span>
                  <span><em>{a.kind}</em><strong data-hl>{a.title}</strong></span>
                </a>
              ))}
            </div>
          </section>
        )}
      </>
    ),
    archive: (
      <>
        {zone('before_archive')}

        {years.length > 0 && (
          <section className="v7-arch">
            <div className="v7-w">
              <div className="v7-arch-h">
                <h2 className="v7-h2">{ttl('archive')}</h2>
                <div className="v7-years" role="tablist" aria-label="Năm phát hành">
                  {years.map((y) => (
                    <button key={y} role="tab" aria-selected={y === year} className={y === year ? 'on' : ''} onClick={() => { setYear(y); setArchShown(archStep); }}>{y}</button>
                  ))}
                </div>
              </div>
              <div className="v7-grid">
                {archIssues.slice(0, archShown).map((i) => (
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
              {archIssues.length > archShown && (
                <button className="v7-arch-more" onClick={() => setArchShown(archShown + archStep)}>
                  Xem thêm <span aria-hidden="true">↓</span>
                </button>
              )}
            </div>
          </section>
        )}
      </>
    ),
    submit: (
      <>
        {zone('before_submit')}

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
              <p>Mỗi ba tháng một email khi số mới lên web.</p>
              <form onSubmit={subscribe}>
                <label htmlFor="v7-email">Email</label>
                <div className="v7-nform">
                  <input id="v7-email" type="email" required placeholder="ten@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button type="submit">Đăng ký</button>
                </div>
                {sub === 'ok' && <div className="v7-nmsg ok" role="status">{subMsg || 'Đã nhận đăng ký. Vui lòng mở email và bấm liên kết xác nhận.'}</div>}
                {sub === 'err' && <div className="v7-nmsg err" role="alert">{subMsg || 'Email không hợp lệ.'}</div>}
              </form>
            </div>
          </div>
        </section>
      </>
    ),
  };

  return (
    <div className="v7">
      <main>
        {zone('top')}
        {layout.filter((b) => !b.hidden).map((b) => <Fragment key={b.key}>{blocks[b.key]}</Fragment>)}
      </main>
    </div>
  );
}
