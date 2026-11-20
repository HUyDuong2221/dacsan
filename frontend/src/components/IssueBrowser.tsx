'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '@/lib/api';
import { Cover, SearchBox } from './Parts';
import PdfViewer from './PdfViewer';

// Trang mục lục một số: lọc theo chuyên mục ngay trên trình duyệt (không tải lại trang, không nhảy lên đầu).
export default function IssueBrowser({ d, initialField }: { d: any; initialField: string }) {
  const { issue, groups, front } = d;
  const [active, setActive] = useState(groups.some((g: any) => g.field === initialField) ? initialField : '');
  const shown = groups.filter((g: any) => !active || g.field === active);
  const total = active ? shown.reduce((n: number, g: any) => n + g.items.length, 0) : d.total;
  const base = `/issues/${issue.slug}`;
  // Xem PDF ngay trong trang mục lục (khung nhúng), không chuyển trang.
  const [pdf, setPdf] = useState(false);
  const pdfBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (pdf) pdfBox.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pdf]);
  const pdfBtn = issue.pdf_url && (
    <button type="button" className={pdf ? 'btn ghost' : 'btn'} onClick={() => setPdf(!pdf)} aria-expanded={pdf}>
      {pdf ? 'Đóng bản PDF' : 'Đọc bản PDF của số'}
    </button>
  );

  function pick(field: string) {
    setActive(field);
    // giữ URL chia sẻ được (?field=...) mà không điều hướng
    window.history.replaceState(null, '', field ? `${base}?field=${encodeURIComponent(field)}` : base);
  }

  const item = (field: string, label: string, n: number) => (
    <button key={label} type="button" onClick={() => pick(field)} className={`f ${active === field ? 'on' : ''}`} aria-pressed={active === field}>
      <span>{label}</span><span className="mono">{n}</span>
    </button>
  );

  return (
    <div className="layout">
      <aside className="side">
        <Cover issue={issue} text={`bìa ${issue.label.toLowerCase()}`} />
        <div>
          <div className="lbl">CHUYÊN MỤC</div>
          <div className="flist">
            {item('', 'Tất cả', d.total)}
            {groups.map((g: any) => item(g.field, g.field, g.items.length))}
          </div>
        </div>
        {issue.pdf_url && <button type="button" className="btn ghost" onClick={() => setPdf(true)}>Đọc PDF cả số</button>}
      </aside>

      <div className="mainc">
        <div className="kicker" style={{ marginBottom: 12 }}>Đặc san Khoa học &amp; Phát triển — {issue.label}</div>
        <h1 className="serif" style={{ fontSize: 'clamp(28px,3.2vw,38px)', marginBottom: 12 }}>Mục lục {issue.label.toLowerCase()}: {issue.theme}</h1>
        <p style={{ color: 'var(--ink2)', fontSize: 16.5, maxWidth: '68ch' }}>
          Toàn văn đọc trực tiếp trên web. Mục lục giữ đúng thứ tự chuyên mục của bản in, kèm số trang để đối chiếu.
        </p>
        <div className="row" style={{ gap: 16, margin: '0 0 18px', alignItems: 'center' }}>
          {pdfBtn}
          {issue.published_at && <span className="muted">Ngày đăng: {fmtDate(issue.published_at)}{issue.page_count ? ` · ${issue.page_count} trang` : ''}</span>}
        </div>

        {pdf && issue.pdf_url && (
          <div ref={pdfBox} style={{ marginBottom: 24, scrollMarginTop: 60 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Bản PDF {issue.label.toLowerCase()}</span>
              <div className="row" style={{ gap: 8 }}>
                <a href={issue.pdf_url} target="_blank" rel="noopener noreferrer" className="btn ghost sm">Mở tab mới</a>
                <a href={issue.pdf_url} download className="btn ghost sm">Tải về</a>
                <button type="button" className="btn ghost sm" onClick={() => setPdf(false)}>Đóng</button>
              </div>
            </div>
            <PdfViewer src={issue.pdf_url} title={`PDF ${issue.label}`} height="calc(100vh - 140px)" />
            <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>Nếu trình duyệt không hiển thị được PDF (một số điện thoại), hãy bấm “Mở tab mới” hoặc “Tải về”.</p>
          </div>
        )}
        <div className="row" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 22, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 220 }}><SearchBox placeholder="Tìm trong số này" hidden={{ issue: issue.slug }} /></div>
          <span className="muted" aria-live="polite">{total} bài · {active || 'toàn bộ chuyên mục'}</span>
        </div>

        {!active && front.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--line)', padding: '18px 0 20px' }}>
            <div className="mono muted" style={{ fontSize: 10.5, letterSpacing: '.1em', marginBottom: 10 }}>TRANG ĐẦU SỐ</div>
            {front.map((a: any) => (
              <Link key={a.slug} href={`/articles/${a.slug}`} style={{ display: 'flex', gap: 14, padding: '6px 0', color: 'var(--ink2)' }}>
                <span style={{ flex: 1 }}>{a.title}</span><span className="mono muted">{a.page_label.replace('tr. ', '')}</span>
              </Link>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 34, paddingTop: 14 }}>
          {shown.map((g: any) => (
            <section key={g.field}>
              <div className="group-h"><h2>{g.field.toUpperCase()}</h2><i /><span className="mono muted" style={{ fontSize: 11 }}>{g.items.length} bài</span></div>
              {g.items.map((a: any) => (
                <Link key={a.slug} href={`/articles/${a.slug}`} className="toc-item">
                  <div><h3>{a.title}</h3><div className="muted">{a.author}</div></div>
                  <span className="mono muted" style={{ textAlign: 'right', fontSize: 12 }}>{a.page_label.replace('tr. ', '')}</span>
                </Link>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
