'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Slide = { key: string; kicker: string; title: string; excerpt: string; href: string };

export default function HeroSlider({ slides, issue }: { slides: Slide[]; issue: { slug: string; label: string; number: number } | null }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [paused, i, slides.length]);

  if (!slides.length) return null;
  const s = slides[i];
  const go = (n: number) => setI((n + slides.length) % slides.length);

  return (
    <div className="hero-main">
      {issue && (
        <div className="hero-kicker"><i />SỐ MỚI NHẤT — {issue.label.toUpperCase()}</div>
      )}
      <div className="hero-slide" key={s.key} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="k">{s.kicker}</div>
        <h1><Link href={s.href}>{s.title}</Link></h1>
        <p>{s.excerpt}</p>
      </div>
      <div className="row" style={{ marginTop: 26 }}>
        <Link href={s.href} className="btn-c">Đọc bài này</Link>
        {issue && <Link href={`/issues/${issue.slug}`} className="btn-o">Mục lục số {issue.number}</Link>}
      </div>
      <div className="hero-ctl">
        <div className="row" style={{ gap: 8 }}>
          <button className="arrow" onClick={() => go(i - 1)} aria-label="Slide trước">←</button>
          <button className="arrow" onClick={() => go(i + 1)} aria-label="Slide sau">→</button>
        </div>
        <div className="dots">
          {slides.map((x, k) => (
            <button key={x.key} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />
          ))}
        </div>
        <span className="mono" style={{ fontSize: 11.5, color: '#c9d8f6', whiteSpace: 'nowrap' }}>{i + 1} / {slides.length}</span>
      </div>
    </div>
  );
}
