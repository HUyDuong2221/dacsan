'use client';
import Link from 'next/link';
import { useState } from 'react';
import { fmtDate } from '@/lib/api';
import { Cover, SearchBox } from './Parts';

// Trang mục lục một số: lọc theo chuyên mục ngay trên trình duyệt (không tải lại trang, không nhảy lên đầu).
export default function IssueBrowser({ d, initialField }: { d: any; initialField: string }) {
  const { issue, groups, front } = d;
  const [active, setActive] = useState(groups.some((g: any) => g.field === initialField) ? initialField : '');
  const shown = groups.filter((g: any) => !active || g.field === active);
  const total = active ? shown.reduce((n: number, g: any) => n + g.items.length, 0) : d.total;
  const base = `/issues/${issue.slug}`;

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
        {issue.pdf_url && <Link href={`${base}/pdf`} className="btn ghost">Đọc PDF cả số</Link>}
      </aside>

      <div className="mainc">
        <div className="kicker" style={{ marginBottom: 12 }}>Đặc san Khoa học &amp; Phát triển — {issue.label}</div>
        <h1 className="serif" style={{ fontSize: 'clamp(28px,3.2vw,38px)', marginBottom: 12 }}>Mục lục {issue.label.toLowerCase()}: {issue.theme}</h1>
        <p style={{ color: 'var(--ink2)', fontSize: 16.5, maxWidth: '68ch' }}>
          Toàn văn đọc trực tiếp trên web. Mục lục giữ đúng thứ tự chuyên mục của bản in, kèm số trang để đối chiếu.
        </p>
        {issue.published_at && <p className="muted" style={{ margin: '0 0 16px' }}>Ngày đăng: {fmtDate(issue.published_at)}</p>}
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
