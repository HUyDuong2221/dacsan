'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HeroSlider({ slides }: { slides: any[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  if (!slides.length) return null;
  const s = slides[i];
  const go = (n: number) => setI((n + slides.length) % slides.length);
  return (
    <div className="hero-main" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="hero-kicker">— NỔI BẬT · {s.issue.label.toUpperCase()}</div>
      <div className="hero-slide" key={s.slug}>
        <div className="mono" style={{ fontSize: 11.5, letterSpacing: '.06em', color: '#c9d8f6', marginBottom: 14 }}>
          {s.author} · {s.page_label}
        </div>
        <h1><Link href={`/articles/${s.slug}`}>{s.title}</Link></h1>
        <p>{s.excerpt}</p>
      </div>
      <div className="row" style={{ marginTop: 26 }}>
        <Link href={`/articles/${s.slug}`} className="btn">Đọc bài này</Link>
        <Link href={`/issues/${s.issue.slug}`} className="btn ghost">Mục lục {s.issue.label.toLowerCase()}</Link>
      </div>
      <div className="hero-ctl">
        <div className="row" style={{ gap: 8 }}>
          <button className="arrow" onClick={() => go(i - 1)} aria-label="Trước">←</button>
          <button className="arrow" onClick={() => go(i + 1)} aria-label="Sau">→</button>
        </div>
        <div className="dots">
          {slides.map((_, k) => (
            <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />
          ))}
        </div>
        <span className="mono" style={{ fontSize: 11.5, color: '#c9d8f6' }}>{i + 1} / {slides.length}</span>
      </div>
    </div>
  );
}
