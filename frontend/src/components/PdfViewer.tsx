'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Khung đọc PDF dùng chung.
 * - Máy tính: trình xem PDF có sẵn của trình duyệt (iframe, #page=N).
 * - Điện thoại/màn nhỏ: iframe PDF bị tràn (iOS) hoặc không hiện (Android), nên vẽ từng trang bằng pdf.js
 *   vừa khít chiều ngang màn hình; trang chỉ được vẽ khi cuộn tới gần (tiết kiệm bộ nhớ với số 100+ trang).
 */
export default function PdfViewer({ src, page = 0, title, height = 'calc(100vh - 150px)' }: { src: string; page?: number; title: string; height?: string }) {
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px), (hover: none) and (pointer: coarse)');
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  if (mobile === null) return <div className="pdfv-box" style={{ height }} aria-busy="true" />;
  if (!mobile) {
    return (
      <iframe key={`${src}#${page}`} src={page > 0 ? `${src}#page=${page}` : src} title={title} className="pdfv-frame" style={{ height }} />
    );
  }
  return <MobilePdf key={`${src}#${page}`} src={src} page={page} title={title} />;
}

type Doc = { numPages: number; getPage: (n: number) => Promise<any>; destroy: () => void };

function MobilePdf({ src, page, title }: { src: string; page: number; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [ratio, setRatio] = useState(1.414); // cao/rộng của trang (A4 mặc định)
  const [err, setErr] = useState('');
  const [cur, setCur] = useState(page > 0 ? page : 1);

  useEffect(() => {
    let dead = false;
    let loaded: Doc | null = null;
    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.js', import.meta.url).toString();
        loaded = await pdfjs.getDocument({ url: src }).promise;
        if (dead) return loaded?.destroy();
        const p1 = await loaded!.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setRatio(vp.height / vp.width);
        setDoc(loaded);
      } catch {
        if (!dead) setErr('Không mở được file PDF trên thiết bị này.');
      }
    })();
    return () => { dead = true; loaded?.destroy(); };
  }, [src]);

  // nhảy tới trang cần đọc khi tài liệu đã sẵn sàng
  useEffect(() => {
    if (!doc || page <= 1) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-p="${Math.min(page, doc.numPages)}"]`);
    if (el && box.current) box.current.scrollTop = el.offsetTop; // .pdfv-scroll là position:relative
  }, [doc, page]);

  // vẽ trang khi cuộn tới gần, xóa canvas khi đi xa để giải phóng bộ nhớ
  useEffect(() => {
    const root = box.current;
    if (!doc || !root) return;
    const drawn = new Map<number, { task?: any }>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        const n = Number(el.dataset.p);
        if (e.isIntersecting && !drawn.has(n)) {
          const st: { task?: any } = {};
          drawn.set(n, st);
          doc.getPage(n).then((pg: any) => {
            if (drawn.get(n) !== st) return;
            const w = el.clientWidth;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const vp = pg.getViewport({ scale: (w / pg.getViewport({ scale: 1 }).width) * dpr });
            const c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height;
            c.style.width = '100%'; c.style.height = 'auto'; c.style.display = 'block';
            st.task = pg.render({ canvasContext: c.getContext('2d')!, viewport: vp });
            st.task.promise.then(() => { if (drawn.get(n) === st) el.replaceChildren(c); }).catch(() => {});
          });
        } else if (!e.isIntersecting && drawn.has(n)) {
          drawn.get(n)?.task?.cancel?.();
          drawn.delete(n);
          el.replaceChildren();
        }
      }
    }, { root, rootMargin: '150% 0px' });
    const pages = root.querySelectorAll('[data-p]');
    pages.forEach((p) => io.observe(p));

    // số trang đang xem (hiển thị ở góc)
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setCur(Number((e.target as HTMLElement).dataset.p));
    }, { root, threshold: 0.5 });
    pages.forEach((p) => spy.observe(p));
    return () => { io.disconnect(); spy.disconnect(); drawn.forEach((s) => s.task?.cancel?.()); };
  }, [doc]);

  if (err) {
    return (
      <div className="pdfv-box pdfv-msg">
        {err} <a href={src} target="_blank" rel="noopener noreferrer">Mở file PDF</a>
      </div>
    );
  }

  return (
    <div className="pdfv-wrap" aria-label={title}>
      <div ref={box} className="pdfv-box pdfv-scroll">
        {!doc && <div className="pdfv-msg">Đang tải PDF…</div>}
        {doc && Array.from({ length: doc.numPages }, (_, i) => (
          <div key={i} data-p={i + 1} className="pdfv-page" style={{ aspectRatio: `1 / ${ratio}` }} />
        ))}
      </div>
      {doc && <span className="pdfv-count">{cur} / {doc.numPages}</span>}
    </div>
  );
}
