'use client';
import { useEffect, useRef, useState } from 'react';
import type { BannerItem, BannerLayout } from '@/lib/banners';
import './banner.css';

/**
 * Banner trang chủ tại một vị trí. 1 ảnh: hiện tĩnh. Nhiều ảnh: slider tự chuyển sau layout.interval giây,
 * dừng khi rê chuột/focus vào, có nút ‹ › và phím ←/→, vuốt trên điện thoại,
 * và không tự chạy nếu người dùng bật "giảm chuyển động".
 */
export default function BannerSlider({ items, layout, label }: { items: BannerItem[]; layout: BannerLayout; label: string }) {
  const n = items.length;
  const [idx, setIdx] = useState(0);
  const [hover, setHover] = useState(false);
  const [stopped, setStopped] = useState(false); // hệ thống bật giảm chuyển động
  const startX = useRef<number | null>(null);
  const swiped = useRef(false); // vừa vuốt: bỏ qua cú bấm liên kết đi kèm

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setStopped(true);
  }, []);

  const playing = n > 1 && !stopped && !hover;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setIdx((i) => (i + 1) % n), layout.interval * 1000);
    return () => clearTimeout(t);
  }, [playing, idx, n, layout.interval]);

  if (!n) return null;
  const go = (i: number) => setIdx(((i % n) + n) % n);
  const style = { '--bh': `${layout.h}px`, '--bhm': `${layout.hm}px`, '--bfit': layout.fit } as React.CSSProperties;

  const img = (b: BannerItem, i: number) => {
    // eslint-disable-next-line @next/next/no-img-element
    const pic = <img src={b.image_url} alt={b.alt || ''} loading={i === 0 ? 'eager' : 'lazy'} draggable={false} />;
    if (!b.link) return pic;
    const ext = /^https?:/.test(b.link);
    return (
      <a href={b.link} tabIndex={i === idx ? 0 : -1} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {pic}
      </a>
    );
  };

  return (
    <section
      className={`bnr bnr-${layout.width}${layout.width === 'content' ? ' v7-w' : ''}${layout.fit === 'contain' ? ' bnr-contain' : ''}`}
      style={style}
      aria-label={label}
      {...(n > 1 ? { 'aria-roledescription': 'carousel' } : {})}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(false); }}
      onKeyDown={(e) => {
        if (n < 2) return;
        if (e.key === 'ArrowLeft') go(idx - 1);
        if (e.key === 'ArrowRight') go(idx + 1);
      }}
    >
      <div
        className="bnr-stage"
        onPointerDown={(e) => { startX.current = e.clientX; swiped.current = false; }}
        onClickCapture={(e) => { if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; } }}
        onPointerUp={(e) => {
          if (startX.current === null || n < 2) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 40) { swiped.current = true; go(idx + (dx < 0 ? 1 : -1)); }
        }}
      >
        <div className="bnr-track" style={{ transform: `translateX(${-100 * idx}%)` }} aria-live={playing ? 'off' : 'polite'}>
          {items.map((b, i) => (
            <div key={b.id} className="bnr-slide" {...(n > 1 ? { role: 'group', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} / ${n}` } : {})}
              aria-hidden={i !== idx}>
              {img(b, i)}
            </div>
          ))}
        </div>
        {n > 1 && (
          <>
            <button type="button" className="bnr-nav bnr-prev" onClick={() => go(idx - 1)} aria-label="Banner trước">‹</button>
            <button type="button" className="bnr-nav bnr-next" onClick={() => go(idx + 1)} aria-label="Banner sau">›</button>
          </>
        )}
      </div>
    </section>
  );
}
