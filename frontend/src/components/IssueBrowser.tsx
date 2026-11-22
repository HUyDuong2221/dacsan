'use client';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtDate } from '@/lib/api';
import { SearchBox } from './Parts';
import './issue-detail.css';

const pad = (n: number) => (n < 10 ? '0' : '') + n;
const FRONT = '__front';
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Số chạy từ 0 lên n khi vào trang (giữ nguyên n khi render phía server / tắt chuyển động).
function useCountUp(n: number, ms = 1100) {
  const [v, setV] = useState(n);
  useEffect(() => {
    if (reduced() || !n) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    setV(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  return v;
}

function Stat({ n, label }: { n: number; label: string }) {
  const v = useCountUp(n);
  return <div className="idt-stat"><b>{v}</b><span>{label}</span></div>;
}

// Trang mục lục một số: khối "cuốn sách" + thanh chuyên mục dính (cuộn tới, tự sáng theo vị trí) + mục lục kiểu bản in.
export default function IssueBrowser({ d, initialField }: { d: any; initialField: string }) {
  const { issue, groups, front } = d;
  const base = `/issues/${issue.slug}`;
  const all: any[] = groups.flatMap((g: any) => g.items);


  // ---- Bìa sách: nghiêng theo chuột, mở bìa khi rê chuột / chạm ----
  const book = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  function tilt(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || reduced()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty('--ry', `${(-14 + x * 16).toFixed(2)}deg`);
    e.currentTarget.style.setProperty('--rx', `${(4 - y * 10).toFixed(2)}deg`);
  }
  function untilt(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.style.removeProperty('--ry');
    e.currentTarget.style.removeProperty('--rx');
  }
  // Điện thoại: tự mở bìa khi cuộn tới giữa màn hình.
  useEffect(() => {
    const el = book.current;
    if (!el || !window.matchMedia('(hover: none)').matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setOpen(e.isIntersecting), { threshold: 0.75 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ---- Chuyên mục: cuộn tới + tự sáng theo vị trí cuộn ----
  const nav = [
    ...(front.length ? [{ key: FRONT, label: 'Trang đầu số', n: front.length }] : []),
    ...groups.map((g: any) => ({ key: g.field, label: g.field, n: g.items.length })),
  ];
  const [active, setActive] = useState<string>(nav[0]?.key || '');
  const secs = useRef<Record<string, HTMLElement | null>>({});
  const lock = useRef(0); // tạm khóa scrollspy khi đang cuộn do bấm

  const go = useCallback((key: string, smooth = true) => {
    const el = secs.current[key];
    if (!el) return;
    setActive(key);
    lock.current = Date.now() + 900;
    el.scrollIntoView({ behavior: smooth && !reduced() ? 'smooth' : 'auto', block: 'start' });
    window.history.replaceState(null, '', key && key !== FRONT ? `${base}?field=${encodeURIComponent(key)}` : base);
  }, [base]);

  useEffect(() => {
    if (initialField && groups.some((g: any) => g.field === initialField)) {
      const t = setTimeout(() => go(initialField, false), 60);
      return () => clearTimeout(t);
    }
  }, [initialField, groups, go]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (es) => {
        if (Date.now() < lock.current) return;
        const hit = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive((hit.target as HTMLElement).dataset.key || '');
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    Object.values(secs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [groups, front]);

  // Vạch chỉ báo trượt theo chuyên mục đang sáng (cột trái) + chip đang sáng luôn nằm trong tầm nhìn (điện thoại).
  const rail = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ y: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const btn = rail.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(active)}"]`);
      if (!btn || !rail.current) return;
      setBar({ y: btn.offsetTop, h: btn.offsetHeight });
      const r = rail.current;
      if (r.scrollWidth > r.clientWidth) r.scrollTo({ left: btn.offsetLeft - r.clientWidth / 2 + btn.offsetWidth / 2, behavior: reduced() ? 'auto' : 'smooth' });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active]);

  // ---- Các bài hiện lần lượt khi cuộn tới ----
  const toc = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const items = toc.current?.querySelectorAll<HTMLElement>('.idt-item');
    if (!items) return;
    if (reduced() || !('IntersectionObserver' in window)) { items.forEach((x) => x.classList.add('in')); return; }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    items.forEach((x) => io.observe(x));
    return () => io.disconnect();
  }, [groups, front]);

  const row = (a: any, i: number) => (
    <Link key={a.slug} href={`/articles/${a.slug}`} className="idt-item" style={{ ['--d' as any]: `${(i % 8) * 55}ms` }}>
      <span className="t"><strong>{a.title}</strong>{a.author && <small>{a.author}</small>}</span>
      <i aria-hidden="true" />
      <span className="p"><em>{a.page_label.replace('tr. ', '')}</em><b>Đọc →</b></span>
    </Link>
  );

  return (
    <div className="idt">
      {/* ===== Khối đầu trang: cuốn sách trên bàn ===== */}
      <header className="idt-hero">
        <span className="idt-water" aria-hidden="true">{pad(issue.number)}</span>
        <div className="idt-w idt-hero-row">
          <div className="idt-bookwrap" ref={book} data-open={open} onPointerMove={tilt} onPointerLeave={untilt} onClick={() => setOpen(!open)}>
            <div className="idt-book">
              <div className="idt-bshadow" />
              <div className="idt-inner">
                <div className="h"><b>MỤC LỤC</b><span>{issue.label.toUpperCase()}</span></div>
                <ol>
                  {all.slice(0, 6).map((a) => (
                    <li key={a.slug}><span>{a.title}</span><i>{a.page_label.replace('tr. ', '')}</i></li>
                  ))}
                </ol>
                {all.length > 6 && <small>+ {all.length - 6} bài khác</small>}
              </div>
              <div className="idt-cover">
                <div className="face front">
                  {issue.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={issue.cover_url} alt={`Bìa ${issue.label}`} />
                  ) : (
                    <div className="ph"><small>ĐẶC SAN</small><strong>Khoa học &amp; Phát triển</strong><small>THÀNH PHỐ ĐÀ NẴNG</small><em>{issue.label}</em></div>
                  )}
                </div>
                <div className="face back"><span>Khoa học &amp; Phát triển<br />Đà Nẵng</span></div>
              </div>
            </div>
            <span className="idt-hint">{open ? 'Chạm để gập bìa' : 'Rê chuột / chạm để mở bìa'}</span>
          </div>

          <div className="idt-head">
            <div className="idt-kick idt-up" style={{ ['--d' as any]: '0ms' }}>ĐẶC SAN KHOA HỌC &amp; PHÁT TRIỂN · {issue.label.toUpperCase()}</div>
            <h1 className="idt-up" style={{ ['--d' as any]: '90ms' }}>{issue.theme || issue.title || issue.label}</h1>
            {issue.summary && <p className="idt-up" style={{ ['--d' as any]: '180ms' }}>{issue.summary}</p>}
            <div className="idt-stats idt-up" style={{ ['--d' as any]: '270ms' }}>
              <Stat n={d.total} label="bài viết" />
              {issue.page_count ? <Stat n={issue.page_count} label="trang" /> : null}
              <Stat n={groups.length} label="chuyên mục" />
            </div>
            <div className="idt-cta idt-up" style={{ ['--d' as any]: '360ms' }}>
              {issue.pdf_url && <Link href={`${base}/pdf`} className="w">Đọc bản PDF →</Link>}
              {issue.published_at && <span>Phát hành {fmtDate(issue.published_at)}</span>}
            </div>
          </div>
        </div>
      </header>

      {/* ===== Thân trang: thanh chuyên mục + mục lục ===== */}
      <div className="idt-w idt-body">
        <aside className="idt-side">
          <div className="idt-lbl">CHUYÊN MỤC</div>
          <div className="idt-rail" ref={rail}>
            {bar && <span className="idt-bar" style={{ transform: `translateY(${bar.y}px)`, height: bar.h }} aria-hidden="true" />}
            {nav.map((x, i) => (
              <button key={x.key} type="button" data-key={x.key} className={active === x.key ? 'on' : ''} aria-current={active === x.key} onClick={() => go(x.key)}>
                <em>{pad(i + 1)}</em><span>{x.label}</span><small>{x.n}</small>
              </button>
            ))}
          </div>
        </aside>

        <div className="idt-main">
          <div className="idt-search">
            <SearchBox placeholder="Tìm trong số này" hidden={{ issue: issue.slug }} />
          </div>

          <div ref={toc}>
            {front.length > 0 && (
              <section className="idt-sec front" data-key={FRONT} ref={(el) => { secs.current[FRONT] = el; }}>
                <div className="idt-sec-h"><em>{pad(1)}</em><h2>Trang đầu số</h2><i /><span>{front.length} mục</span></div>
                {front.map(row)}
              </section>
            )}
            {groups.map((g: any, gi: number) => (
              <section key={g.field} className="idt-sec" data-key={g.field} ref={(el) => { secs.current[g.field] = el; }}>
                <div className="idt-sec-h"><em>{pad(gi + 1 + (front.length ? 1 : 0))}</em><h2>{g.field}</h2><i /><span>{g.items.length} bài</span></div>
                {g.items.map(row)}
              </section>
            ))}
            {!all.length && !front.length && <p className="idt-empty">Mục lục của {issue.label.toLowerCase()} đang được cập nhật.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
