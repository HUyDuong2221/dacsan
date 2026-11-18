import Link from 'next/link';
import { get } from '@/lib/api';
import HeroSlider from '@/components/HeroSlider';
import IssueTabs from '@/components/IssueTabs';
import SubscribeForm from '@/components/SubscribeForm';
import { Activities, IssueCard, SearchBox } from '@/components/Parts';

function GridFx() {
  return <div className="gridfx" />;
}

export default async function Home() {
  const d = await get('/home');
  const latest = d.latest_issue;
  const st = d.stats;
  return (
    <>
      <section className="hero">
        <GridFx />
        <div className="orbit" style={{ top: -70, right: -120, width: 520, height: 520, border: '1px solid rgba(168,212,238,.22)', animation: 'dcOrbit 46s linear infinite' }}>
          <span style={{ top: -5, width: 10, height: 10, background: '#8fe1ff', boxShadow: '0 0 18px rgba(127,212,255,.9)' }} />
        </div>
        <div className="orbit" style={{ top: 10, right: -40, width: 340, height: 340, border: '1px dashed rgba(200,55,45,.32)', animation: 'dcOrbitRev 34s linear infinite' }}>
          <span style={{ bottom: -4, width: 8, height: 8, background: '#ff9b72', boxShadow: '0 0 14px rgba(255,155,114,.85)' }} />
        </div>
        <svg viewBox="0 0 600 300" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: 0, width: '62%', height: '78%', opacity: 0.5, pointerEvents: 'none' }}>
          <g stroke="#8FE1FF" strokeWidth="1" fill="none" strokeDasharray="6 9" style={{ animation: 'dcTrace 14s linear infinite' }}>
            <path d="M20 250 L120 190 L210 236 L320 150 L430 196 L560 110" />
            <path d="M60 286 L160 236 L250 268 L380 206 L500 240" />
            <path d="M120 190 L160 236 M320 150 L380 206 M430 196 L500 240" />
          </g>
          <g fill="#C9D8F6">
            {[[120, 190, 0], [320, 150, 0.7], [430, 196, 1.4], [250, 268, 2.1]].map(([x, y, dl]) => (
              <circle key={`${x}`} cx={x} cy={y} r="4" style={{ animation: `dcPulse 3.4s ease-in-out ${dl}s infinite`, transformOrigin: `${x}px ${y}px` }} />
            ))}
          </g>
        </svg>
        <div className="wrap">
          <HeroSlider slides={d.hero} issue={latest ? { slug: latest.slug, label: latest.label, number: latest.number } : null} />
          {latest && (
            <Link href={`/issues/${latest.slug}`} className="hero-cover">
              <div className="scan" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {latest.cover_url ? <img src={latest.cover_url} alt={`Bìa ${latest.label}`} /> : <em>ảnh bìa {latest.label.toLowerCase()}</em>}
            </Link>
          )}
        </div>
      </section>

      <section className="search-strip">
        <div className="wrap">
          <SearchBox button={false} large />
          <span className="mono" style={{ fontSize: 13, color: 'var(--mute)' }}>
            Kho lưu trữ {st.issue_count} số{st.year_from ? ` · ${st.year_from}–${st.year_to}` : ''}
          </span>
        </div>
      </section>

      <section className="wrap sec">
        <div className="sec-head">
          <h2>Trong số này</h2>
          {latest && <Link href={`/issues/${latest.slug}`}>Toàn bộ mục lục →</Link>}
        </div>
        <IssueTabs articles={d.articles} fields={d.fields} />
      </section>

      <section className="band dark">
        <GridFx />
        <div className="orbit" style={{ left: -90, bottom: -140, width: 420, height: 420, border: '1px dashed rgba(168,212,238,.24)', animation: 'dcOrbit 52s linear infinite' }}>
          <span style={{ top: -4, width: 8, height: 8, background: '#8fe1ff', boxShadow: '0 0 16px rgba(127,212,255,.9)' }} />
        </div>
        <div className="wrap">
          <div className="sec-head">
            <h2>Các số gần đây</h2>
            <Link href="/issues">Tất cả các số đã phát hành →</Link>
          </div>
          <div className="issue-grid">
            {d.issues.map((i: any) => <IssueCard key={i.slug} i={i} dark />)}
          </div>
        </div>
      </section>

      <section className="wrap two">
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          <div className="sec-head">
            <h2>Hoạt động nổi bật của LHHĐN</h2>
            <a href="https://lhh.danang.gov.vn/chi-tiet-tin-tuc?danhmuc=1" target="_blank" rel="noopener noreferrer">Xem trên lhh.danang.gov.vn →</a>
          </div>
          <Activities items={d.activities} />
        </div>
        <div style={{ flex: '1 1 300px', maxWidth: 420 }}>
          <div className="box tint">
            <h3>Gửi bài cho Đặc san</h3>
            <p>Bản thảo nhận liên tục. Xem thể lệ gửi bài, quy định xuất bản và đạo đức công bố khoa học trước khi gửi.</p>
            <div className="row">
              <Link href="/gui-bai" className="btn">Gửi bài ngay</Link>
              <Link href="/docs" className="btn ghost">Thể lệ gửi bài</Link>
            </div>
          </div>
          <div className="box">
            <h3>Nhận thông báo số mới</h3>
            <p>Mỗi hai tháng một email khi số mới lên web.</p>
            <SubscribeForm />
          </div>
        </div>
      </section>
    </>
  );
}
