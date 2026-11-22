'use client';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './pdf-reader.css';

/**
 * Trình đọc PDF toàn màn hình (kiểu Google Drive), vẽ bằng pdf.js nên giống nhau trên máy tính và điện thoại:
 * thanh tiêu đề (in, tải về, mở tab mới, chia sẻ), thanh công cụ (ảnh thu nhỏ, mục lục, tìm + tô sáng,
 * chuyển trang, phóng to/thu nhỏ, xoay).
 * Trang chỉ được vẽ khi cuộn tới gần và bị xóa khi đi xa (tiết kiệm bộ nhớ với số 100+ trang).
 * embed: nhúng trong trang (khung có chiều cao cố định) thay vì phủ toàn màn hình, ví dụ trang bài chưa có toàn văn.
 */

const CSS_UNITS = 96 / 72; // 100% = kích thước in thật (giống trình xem PDF của Chrome)
const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const PAD = 24; // lề quanh trang trong vùng đọc

type Size = { w: number; h: number };
export type TocItem = { title: string; author?: string; page: number };
export type TocGroup = { name: string; items: TocItem[] };
type Panel = 'thumbs' | 'toc' | null;
// chữ của một trang: chuỗi đã chuẩn hóa + vị trí từng đoạn chữ (đơn vị PDF) để tô sáng
type Span = { s: number; e: number; x: number; y: number; w: number; h: number };
type PageText = { text: string; spans: Span[] };
type Hit = { p: number; a: number; b: number };

const normPart = (s: string) => s.normalize('NFC').toLocaleLowerCase('vi').replace(/\s/g, ' ');
const normQuery = (s: string) => normPart(s.trim()).replace(/ +/g, ' ');

const P: Record<string, JSX.Element> = {
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  side: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  toc: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  prev: <path d="m15 6-6 6 6 6" />,
  next: <path d="m9 6 6 6-6 6" />,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  fit: <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />,
  rotate: <><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" /></>,
  print: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 21h16" />,
  open: <path d="M14 4h6v6m0-6-9 9m7 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4m-7.6 6.4 7.6 4.4" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
};
const Ic = ({ n }: { n: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>
);

export default function PdfReader({ src, title, meta, backHref, page = 0, toc = [], embed = false }: {
  src: string; title: string; meta: string; backHref?: string; page?: number; toc?: TocGroup[]; embed?: boolean;
}) {
  const view = useRef<HTMLDivElement>(null);
  const side = useRef<HTMLDivElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<any>(null);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState<number | null>(null);
  const [rot, setRot] = useState(0);
  const [cur, setCur] = useState(1);
  const [pageText, setPageText] = useState('1');
  const [panel, setPanel] = useState<Panel>(null);
  const [toast, setToast] = useState('');
  const zoomRef = useRef(1);
  const rotRef = useRef(0);
  zoomRef.current = zoom ?? 1;
  rotRef.current = rot;

  // ---- nạp tài liệu + kích thước từng trang ----
  useEffect(() => {
    let dead = false;
    let loaded: any = null;
    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.js', import.meta.url).toString();
        loaded = await pdfjs.getDocument({ url: src }).promise;
        if (dead) return loaded.destroy();
        const list: Size[] = await Promise.all(
          Array.from({ length: loaded.numPages }, (_, i) => loaded.getPage(i + 1).then((pg: any) => {
            const vp = pg.getViewport({ scale: 1 });
            return { w: vp.width, h: vp.height };
          })),
        );
        if (dead) return;
        setSizes(list);
        setDoc(loaded);
      } catch {
        if (!dead) setErr('Không mở được file PDF này.');
      }
    })();
    return () => { dead = true; loaded?.destroy(); };
  }, [src]);

  // khóa cuộn trang nền khi trình đọc phủ toàn màn hình
  useEffect(() => {
    if (embed) return;
    const h = document.documentElement;
    const old = h.style.overflow;
    h.style.overflow = 'hidden';
    if (window.innerWidth > 900) setPanel('thumbs');
    return () => { h.style.overflow = old; };
  }, [embed]);

  const swap = rot % 180 !== 0;
  const dims = (s: Size, z: number) => ({
    width: Math.round((swap ? s.h : s.w) * z * CSS_UNITS),
    height: Math.round((swap ? s.w : s.h) * z * CSS_UNITS),
  });

  const fitZoom = useCallback(() => {
    const v = view.current;
    if (!v || !sizes.length) return 1;
    const maxW = Math.max(...sizes.map((s) => (swap ? s.h : s.w)));
    return (v.clientWidth - PAD * 2) / (maxW * CSS_UNITS);
  }, [sizes, swap]);

  // ---- đổi cỡ mà vẫn giữ nguyên chỗ đang đọc ----
  const anchor = useRef<{ y: number; x: number } | null>(null);
  const keepPlace = (x?: number) => {
    const v = view.current;
    if (v) anchor.current = { y: (v.scrollTop + v.clientHeight / 2) / v.scrollHeight, x: x ?? (v.scrollLeft + v.clientWidth / 2) / v.scrollWidth };
  };
  const changeZoom = (z: number) => {
    keepPlace();
    setZoom(Math.min(4, Math.max(0.25, Math.round(z * 100) / 100)));
  };
  useLayoutEffect(() => {
    const v = view.current;
    const a = anchor.current;
    if (!v || !a) return;
    v.scrollTop = a.y * v.scrollHeight - v.clientHeight / 2;
    v.scrollLeft = a.x * v.scrollWidth - v.clientWidth / 2;
    anchor.current = null;
  }, [zoom, rot]);
  const zoomStep = (dir: 1 | -1) => {
    const z = zoom ?? 1;
    const next = dir > 0 ? ZOOMS.find((x) => x > z + 0.001) : [...ZOOMS].reverse().find((x) => x < z - 0.001);
    if (next) changeZoom(next);
  };
  const rotate = () => { keepPlace(0.5); setRot((r) => (r + 90) % 360); };

  // cỡ mặc định: vừa chiều rộng, tối đa 100%
  useEffect(() => {
    if (!doc || zoom !== null) return;
    setZoom(Math.min(1, fitZoom()));
  }, [doc, zoom, fitZoom]);

  // ---- chuyển tới trang ----
  const pageEl = (n: number) => view.current?.querySelector<HTMLElement>(`[data-p="${n}"]`) ?? null;
  const go = useCallback((n: number) => {
    const v = view.current;
    if (!v || !doc) return;
    const p = Math.min(doc.numPages, Math.max(1, n));
    const el = pageEl(p);
    if (el) v.scrollTop = el.offsetTop - PAD / 2;
    setCur(p);
  }, [doc]);
  const jumped = useRef(false);
  useEffect(() => {
    if (!doc || zoom === null || jumped.current) return;
    jumped.current = true;
    if (page > 1) requestAnimationFrame(() => go(page));
  }, [doc, zoom, page, go]);

  // trang hiện tại theo vị trí cuộn
  useEffect(() => {
    const v = view.current;
    if (!v || !doc) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = v.scrollTop + v.clientHeight * 0.35;
        let n = 1;
        for (const el of v.querySelectorAll<HTMLElement>('[data-p]')) { if (el.offsetTop <= line) n = Number(el.dataset.p); else break; }
        setCur(n);
      });
    };
    v.addEventListener('scroll', on, { passive: true });
    return () => { v.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [doc]);
  useEffect(() => { setPageText(String(cur)); }, [cur]);

  // ================= TÌM + TÔ SÁNG =================
  const texts = useRef<PageText[]>([]);
  const [findOpen, setFindOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [hitAt, setHitAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const hitsRef = useRef<{ byPage: Map<number, { a: number; b: number; k: number }[]>; cur: number }>({ byPage: new Map(), cur: -1 });

  const loadText = useCallback(async (n: number): Promise<PageText> => {
    if (texts.current[n]) return texts.current[n];
    const pg = await doc.getPage(n);
    const tc = await pg.getTextContent();
    let text = '';
    const spans: Span[] = [];
    for (const it of tc.items as any[]) {
      if (typeof it.str !== 'string') continue;
      const s = text.length;
      text += normPart(it.str);
      const t = it.transform;
      if (it.str) spans.push({ s, e: text.length, x: t[4], y: t[5], w: it.width, h: it.height || Math.hypot(t[2], t[3]) });
      if (it.hasEOL) text += ' ';
    }
    return (texts.current[n] = { text, spans });
  }, [doc]);

  // các khung (đơn vị PDF) phủ đoạn chữ [a, b) của trang: một khung cho mỗi đoạn chữ mà kết quả đi qua
  const rectsOf = (pt: PageText, a: number, b: number) => {
    const out: number[][] = [];
    for (const sp of pt.spans) {
      if (sp.e <= a || sp.s >= b) continue;
      const len = sp.e - sp.s || 1;
      const x1 = sp.x + (sp.w * (Math.max(a, sp.s) - sp.s)) / len;
      const x2 = sp.x + (sp.w * (Math.min(b, sp.e) - sp.s)) / len;
      out.push([x1, sp.y - sp.h * 0.22, x2, sp.y + sp.h * 0.9]);
    }
    return out;
  };
  // khung trên trang đã xoay/phóng, tính theo % kích thước trang để co giãn theo canvas khi đang vẽ lại
  const toBox = (vp: any, r: number[]) => {
    const [x1, y1, x2, y2] = vp.convertToViewportRectangle(r);
    return { l: Math.min(x1, x2), t: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  };

  // vẽ lớp tô sáng của một trang (gọi sau khi canvas vẽ xong hoặc khi kết quả đổi)
  const paint = useCallback((el: HTMLElement, pg: any) => {
    el.querySelector('.pdr-hl')?.remove();
    const n = Number(el.dataset.p);
    const list = hitsRef.current.byPage.get(n);
    const pt = texts.current[n];
    if (!list?.length || !pt) return;
    const vp = pg.getViewport({ scale: 1, rotation: (pg.rotate + rotRef.current) % 360 });
    const layer = document.createElement('div');
    layer.className = 'pdr-hl';
    for (const m of list) {
      for (const r of rectsOf(pt, m.a, m.b)) {
        const bx = toBox(vp, r);
        const d = document.createElement('i');
        if (m.k === hitsRef.current.cur) d.className = 'cur';
        d.style.cssText = `left:${(bx.l / vp.width) * 100}%;top:${(bx.t / vp.height) * 100}%;width:${(bx.w / vp.width) * 100}%;height:${(bx.h / vp.height) * 100}%`;
        layer.appendChild(d);
      }
    }
    el.appendChild(layer);
  }, []);
  const repaintAll = useCallback(() => {
    if (!doc) return;
    view.current?.querySelectorAll<HTMLElement>('[data-p]').forEach((el) => {
      if (el.querySelector('canvas') || el.querySelector('.pdr-hl')) doc.getPage(Number(el.dataset.p)).then((pg: any) => paint(el, pg));
    });
  }, [doc, paint]);

  // cuộn tới đúng chỗ của kết quả thứ k
  const goHit = useCallback(async (list: Hit[], k: number) => {
    const v = view.current;
    const h = list[k];
    if (!v || !h) return;
    const el = pageEl(h.p);
    if (!el) return;
    const pg = await doc.getPage(h.p);
    const pt = await loadText(h.p);
    const vp = pg.getViewport({ scale: zoomRef.current * CSS_UNITS, rotation: (pg.rotate + rotRef.current) % 360 });
    const r = rectsOf(pt, h.a, h.b)[0];
    if (!r) return go(h.p);
    const bx = toBox(vp, r);
    v.scrollTop = el.offsetTop + bx.t - v.clientHeight * 0.35;
    const left = el.offsetLeft + bx.l;
    if (left < v.scrollLeft || left + bx.w > v.scrollLeft + v.clientWidth) v.scrollLeft = left - 40;
    setCur(h.p);
  }, [doc, loadText, go]);

  const searchId = useRef(0);
  const runSearch = useCallback(async (raw: string) => {
    const id = ++searchId.current;
    const term = normQuery(raw);
    if (!doc || !term) { setHits(null); setBusy(false); return; }
    setBusy(true);
    const found: Hit[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pt = await loadText(n);
      if (id !== searchId.current) return; // đã gõ từ khác
      for (let i = pt.text.indexOf(term); i >= 0; i = pt.text.indexOf(term, i + term.length)) found.push({ p: n, a: i, b: i + term.length });
    }
    setBusy(false);
    setHits(found);
    // bắt đầu từ kết quả đầu tiên kể từ trang đang xem
    const k = Math.max(0, found.findIndex((h) => h.p >= cur));
    setHitAt(k);
    if (found.length) goHit(found, k);
  }, [doc, loadText, cur, goHit]);

  // tìm ngay khi gõ (chờ người dùng ngừng gõ một chút)
  useEffect(() => {
    if (!findOpen) return;
    const t = window.setTimeout(() => runSearch(q), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, findOpen, doc]);

  // đồng bộ kết quả sang lớp tô sáng
  useEffect(() => {
    const byPage = new Map<number, { a: number; b: number; k: number }[]>();
    (findOpen && hits ? hits : []).forEach((h, k) => {
      if (!byPage.has(h.p)) byPage.set(h.p, []);
      byPage.get(h.p)!.push({ a: h.a, b: h.b, k });
    });
    hitsRef.current = { byPage, cur: hitAt };
    repaintAll();
  }, [hits, hitAt, findOpen, repaintAll]);

  const step = (dir: 1 | -1) => {
    if (!hits?.length) return;
    const k = (hitAt + dir + hits.length) % hits.length;
    setHitAt(k);
    goHit(hits, k);
  };
  const openFind = () => { setFindOpen(true); requestAnimationFrame(() => findInput.current?.select()); };
  const closeFind = () => { setFindOpen(false); searchId.current++; setBusy(false); };

  // ---- vẽ trang khi cuộn tới gần ----
  useEffect(() => {
    const root = view.current;
    if (!doc || !root || zoom === null) return;
    const drawn = new Map<number, { task?: any }>();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        const n = Number(el.dataset.p);
        if (e.isIntersecting) {
          if (drawn.has(n)) continue;
          const st: { task?: any } = {};
          drawn.set(n, st);
          doc.getPage(n).then((pg: any) => {
            if (drawn.get(n) !== st) return;
            const vp = pg.getViewport({ scale: zoom * CSS_UNITS * dpr, rotation: (pg.rotate + rot) % 360 });
            const c = document.createElement('canvas');
            c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
            st.task = pg.render({ canvasContext: c.getContext('2d')!, viewport: vp });
            // giữ canvas cũ (bị kéo giãn) cho tới khi canvas mới vẽ xong để không nhấp nháy khi phóng to
            st.task.promise.then(() => {
              if (drawn.get(n) !== st) return;
              el.replaceChildren(c);
              paint(el, pg);
            }).catch(() => {});
          });
        } else {
          drawn.get(n)?.task?.cancel?.();
          drawn.delete(n);
          if (el.firstChild) el.replaceChildren();
        }
      }
    }, { root, rootMargin: '100% 0px' });
    root.querySelectorAll('[data-p]').forEach((p) => io.observe(p));
    return () => { io.disconnect(); drawn.forEach((s) => s.task?.cancel?.()); };
  }, [doc, zoom, rot, paint]);

  // ================= ẢNH THU NHỎ =================
  useEffect(() => {
    const root = side.current;
    if (!doc || !root || panel !== 'thumbs') return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        doc.getPage(Number(el.dataset.t)).then((pg: any) => {
          const base = pg.getViewport({ scale: 1 });
          const vp = pg.getViewport({ scale: (el.clientWidth / base.width) * 2 });
          const c = document.createElement('canvas');
          c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          pg.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise.then(() => el.replaceChildren(c)).catch(() => {});
        });
      }
    }, { root, rootMargin: '200px 0px' });
    root.querySelectorAll('[data-t]').forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [doc, panel]);

  // ================= MỤC LỤC =================
  // mục lục của số (từ CSDL); số nào chưa nhập thì lấy bookmark có sẵn trong file PDF
  const [outline, setOutline] = useState<TocGroup[]>([]);
  useEffect(() => {
    if (!doc || toc.length) return;
    let dead = false;
    (async () => {
      try {
        const nodes: any[] = (await doc.getOutline()) || [];
        const pageOf = async (dest: any) => {
          try {
            const d = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
            const ref = Array.isArray(d) ? d[0] : null;
            if (ref == null) return 0;
            return typeof ref === 'number' ? ref + 1 : (await doc.getPageIndex(ref)) + 1;
          } catch { return 0; }
        };
        const item = async (n: any): Promise<TocItem> => ({ title: n.title, page: await pageOf(n.dest) });
        const nested = nodes.some((n) => n.items?.length);
        const groups: TocGroup[] = nested
          ? await Promise.all(nodes.map(async (n) => ({ name: n.title, items: await Promise.all((n.items?.length ? n.items : [n]).map(item)) })))
          : [{ name: '', items: await Promise.all(nodes.map(item)) }];
        if (!dead) setOutline(groups.filter((g) => g.items.length));
      } catch { /* PDF không có bookmark */ }
    })();
    return () => { dead = true; };
  }, [doc, toc.length]);
  const groups = toc.length ? toc : outline;
  const tocCount = groups.reduce((s, g) => s + g.items.length, 0);
  // mục đang đọc: mục cuối cùng có số trang ≤ trang hiện tại
  const tocActive = useMemo(() => {
    let best = '';
    let bestPage = 0;
    groups.forEach((g, gi) => g.items.forEach((it, ii) => {
      if (it.page > 0 && it.page <= cur && it.page >= bestPage) { best = `${gi}-${ii}`; bestPage = it.page; }
    }));
    return best;
  }, [groups, cur]);

  useEffect(() => {
    if (!panel) return;
    const sel = panel === 'thumbs' ? `[data-tb="${cur}"]` : `[data-ti="${tocActive}"]`;
    side.current?.querySelector(sel)?.scrollIntoView({ block: 'nearest' });
  }, [cur, panel, tocActive]);

  const pick = (n: number) => { go(n); if (window.innerWidth <= 900) setPanel(null); };
  const toggle = (p: Panel) => setPanel((x) => (x === p ? null : p));

  // ---- phím tắt (khi nhúng trong trang: chỉ khi đang thao tác trong khung đọc) ----
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (embed && !root.current?.contains(document.activeElement)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); openFind(); }
      else if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomStep(1); }
      else if (mod && e.key === '-') { e.preventDefault(); zoomStep(-1); }
      else if (mod && e.key === '0') { e.preventDefault(); changeZoom(1); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  // ---- in / chia sẻ ----
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 2400); };
  const print = () => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    f.src = src;
    f.onload = () => {
      try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(src, '_blank'); }
      window.setTimeout(() => f.remove(), 60000);
    };
    document.body.appendChild(f);
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* người dùng hủy */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); flash('Đã sao chép liên kết'); }
    catch { flash(url); }
  };

  const total = doc?.numPages ?? 0;
  const z = zoom ?? 1;

  return (
    <div ref={root} className={`pdr${embed ? ' pdr-embed' : ''}`} role={embed ? 'region' : 'dialog'} aria-label={title}>
      <header className="pdr-top">
        {backHref && <Link href={backHref} className="pdr-ib" title="Quay lại mục lục" aria-label="Quay lại mục lục"><Ic n="back" /></Link>}
        <span className="pdr-file" aria-hidden="true">PDF</span>
        <div className="pdr-name">
          <strong title={title}>{title}</strong>
          <span>PDF{total ? ` · ${total} trang` : ''} · {meta}</span>
        </div>
        <div className="pdr-acts">
          <button type="button" className="pdr-ib pdr-hide-sm" onClick={print} title="In" aria-label="In"><Ic n="print" /></button>
          <a className="pdr-ib" href={src} download title="Tải về" aria-label="Tải về"><Ic n="download" /></a>
          <a className="pdr-ib pdr-hide-sm" href={src} target="_blank" rel="noopener noreferrer" title="Mở trong tab mới" aria-label="Mở trong tab mới"><Ic n="open" /></a>
          <button type="button" className="pdr-share" onClick={share}><Ic n="share" /><span>Chia sẻ</span></button>
        </div>
      </header>

      <div className="pdr-bar">
        <div className="pdr-grp">
          <button type="button" className={`pdr-ib${panel === 'thumbs' ? ' on' : ''}`} onClick={() => toggle('thumbs')} title="Ảnh thu nhỏ các trang" aria-label="Ảnh thu nhỏ các trang" aria-pressed={panel === 'thumbs'}><Ic n="side" /></button>
          {groups.length > 0 && (
            <button type="button" className={`pdr-tocb${panel === 'toc' ? ' on' : ''}`} onClick={() => toggle('toc')} title="Mục lục" aria-pressed={panel === 'toc'}><Ic n="toc" /><span>Mục lục</span></button>
          )}
          <button type="button" className={`pdr-ib${findOpen ? ' on' : ''}`} onClick={() => (findOpen ? closeFind() : openFind())} title="Tìm trong tài liệu (Ctrl+F)" aria-label="Tìm trong tài liệu"><Ic n="search" /></button>
          <i className="pdr-sep" />
          <button type="button" className="pdr-ib" onClick={() => go(cur - 1)} disabled={cur <= 1} title="Trang trước" aria-label="Trang trước"><Ic n="prev" /></button>
          <input
            className="pdr-pg" inputMode="numeric" aria-label="Số trang" value={pageText}
            onChange={(e) => setPageText(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { go(parseInt(pageText, 10) || cur); (e.target as HTMLInputElement).blur(); } }}
            onBlur={() => setPageText(String(cur))}
          />
          <span className="pdr-of">/ {total || '–'}</span>
          <button type="button" className="pdr-ib" onClick={() => go(cur + 1)} disabled={!total || cur >= total} title="Trang sau" aria-label="Trang sau"><Ic n="next" /></button>
        </div>
        <div className="pdr-grp">
          <button type="button" className="pdr-ib" onClick={() => zoomStep(-1)} disabled={z <= ZOOMS[0]} title="Thu nhỏ" aria-label="Thu nhỏ"><Ic n="minus" /></button>
          <span className="pdr-zoom">{Math.round(z * 100)}%</span>
          <button type="button" className="pdr-ib" onClick={() => zoomStep(1)} disabled={z >= ZOOMS[ZOOMS.length - 1]} title="Phóng to" aria-label="Phóng to"><Ic n="plus" /></button>
          <button type="button" className="pdr-ib pdr-hide-sm" onClick={() => changeZoom(fitZoom())} title="Vừa chiều rộng" aria-label="Vừa chiều rộng"><Ic n="fit" /></button>
          <i className="pdr-sep pdr-hide-sm" />
          <button type="button" className="pdr-ib pdr-hide-sm" onClick={rotate} title="Xoay" aria-label="Xoay trang"><Ic n="rotate" /></button>
        </div>

        {findOpen && (
          <form className="pdr-find" onSubmit={(e) => { e.preventDefault(); step(1); }}>
            <input
              ref={findInput} value={q} placeholder="Tìm trong tài liệu" aria-label="Tìm trong tài liệu"
              onChange={(e) => { setQ(e.target.value); setHits(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeFind();
                if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); step(-1); }
              }}
            />
            <span className="pdr-hits" aria-live="polite">
              {busy ? 'Đang tìm…' : hits ? (hits.length ? `${hitAt + 1}/${hits.length}` : 'Không thấy') : ''}
            </span>
            <button type="button" className="pdr-ib" onClick={() => step(-1)} disabled={!hits?.length} title="Kết quả trước (Shift+Enter)" aria-label="Kết quả trước"><Ic n="up" /></button>
            <button type="submit" className="pdr-ib" disabled={!hits?.length} title="Kết quả sau (Enter)" aria-label="Kết quả sau"><Ic n="down" /></button>
            <button type="button" className="pdr-ib" onClick={closeFind} title="Đóng" aria-label="Đóng tìm kiếm"><Ic n="close" /></button>
          </form>
        )}
      </div>

      <div className="pdr-body">
        {panel === 'thumbs' && (
          <nav ref={side} className="pdr-side pdr-thumbs" aria-label="Các trang">
            {sizes.map((s, i) => (
              <button key={i} type="button" data-tb={i + 1} className={cur === i + 1 ? 'on' : ''} onClick={() => pick(i + 1)} aria-label={`Trang ${i + 1}`} aria-current={cur === i + 1 ? 'page' : undefined}>
                <span data-t={i + 1} style={{ aspectRatio: `${s.w} / ${s.h}` }} />
                <em>{i + 1}</em>
              </button>
            ))}
          </nav>
        )}
        {panel === 'toc' && (
          <nav ref={side} className="pdr-side pdr-toc" aria-label="Mục lục">
            <div className="pdr-toc-h">
              <strong>Mục lục</strong>
              <span>{tocCount} mục</span>
              <button type="button" className="pdr-ib" onClick={() => setPanel(null)} title="Đóng" aria-label="Đóng mục lục"><Ic n="close" /></button>
            </div>
            {groups.map((g, gi) => (
              <section key={gi}>
                {g.name && <h3>{g.name}</h3>}
                {g.items.map((it, ii) => {
                  const key = `${gi}-${ii}`;
                  const on = key === tocActive;
                  return (
                    <button key={ii} type="button" data-ti={key} className={on ? 'on' : ''} disabled={!it.page} onClick={() => pick(it.page)} aria-current={on ? 'true' : undefined}>
                      <span>
                        <b>{it.title}</b>
                        {it.author && <small>{it.author}</small>}
                      </span>
                      <em>{it.page || ''}</em>
                    </button>
                  );
                })}
              </section>
            ))}
          </nav>
        )}
        <div ref={view} className="pdr-view" tabIndex={embed ? -1 : undefined}>
          {err ? (
            <div className="pdr-msg">{err} <a href={src} target="_blank" rel="noopener noreferrer">Mở file PDF</a></div>
          ) : !doc || zoom === null ? (
            <div className="pdr-msg"><span className="pdr-spin" />Đang tải PDF…</div>
          ) : (
            <div className="pdr-pages" style={{ padding: PAD }}>
              {sizes.map((s, i) => (
                <div key={i} data-p={i + 1} className="pdr-page" style={dims(s, z)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && <div className="pdr-toast" role="status">{toast}</div>}
    </div>
  );
}
