import type { Metadata } from 'next';
import Link from 'next/link';
import { get } from '@/lib/api';
import HeroBg from './_home/HeroBg';
import './_home/d.css';
import './_home/d3.css';
import IssueTabs from '@/components/IssueTabs';
import SubscribeForm from '@/components/SubscribeForm';
import { fmtDate } from '@/lib/api';

export const metadata: Metadata = { title: 'Trang chủ' };

const FONTS =
  'https://fonts.googleapis.com/css2?family=Noto+Serif:wght@600;700&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap';

const CATS = [
  { name: 'Nghiên cứu – Trao đổi', desc: 'Công bố kết quả nghiên cứu, trao đổi học thuật, lý luận và thực tiễn', href: '/research', d: 'M3 5h7a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h7z' },
  { name: 'Ứng dụng – Công nghệ', desc: 'Giải pháp, mô hình, công nghệ và ứng dụng phục vụ phát triển', href: '/search?q=công nghệ', d: 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  { name: 'Chính sách', desc: 'Cơ chế, chính sách, quản lý khoa học và phát triển địa phương', href: '/search?q=chính sách', d: 'M12 3v18M5 7h14M7 7l-3 6h6zM17 7l-3 6h6z' },
  { name: 'Nhân vật', desc: 'Chân dung nhà khoa học, chuyên gia, những đóng góp tiêu biểu', href: '/search?q=nhân vật', d: 'M3 19c0-3 2.7-5 6-5s6 2 6 5M14 15c2.5 0 5 1.5 5 4M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z' },
  { name: 'Thông tin', desc: 'Tin hoạt động, sự kiện khoa học và công nghệ, thông tin trong nước và quốc tế', href: '/docs', d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 11v6M12 7.5v.5' },
];

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default async function HomeV3() {
  const [d, site] = await Promise.all([
    get('/home'),
    get('/site').catch(() => ({} as Record<string, string>)),
  ]);
  const latest = d.latest_issue;
  const fields: string[] = d.fields || [];
  const allArticles: any[] = d.articles || [];
  const acts: any[] = d.activities || [];
  const issues: any[] = (d.issues || []).slice(0, 5);
  const heroIntro = d.hero?.[0]?.excerpt || site.hero_intro || '';

  return (
    <div className="d-page">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONTS} />

      <div className="d-topbar">
        <div className="d-wrap">
          <div className="d-meta"><span>{(site.org_name || 'LIÊN HIỆP CÁC HỘI KHOA HỌC KỸ THUẬT ĐÀ NẴNG').toUpperCase()}</span></div>
          <div className="d-meta">
            <span>ISSN {site.issn || '—'}</span>
            <span className="d-sep">|</span>
            <span>VI / EN</span>
            <form action="/search" className="d-topsearch">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <input type="search" name="q" minLength={2} aria-label="Tìm kiếm trên trang" placeholder="Tìm kiếm..." />
            </form>
          </div>
        </div>
      </div>

      <header className="d-header">
        <div className="d-wrap">
          <Link href="/" className="d-logo" aria-label="Đặc san Khoa học & Phát triển thành phố Đà Nẵng">
            {site.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.logo_url} alt="Đặc san Khoa học & Phát triển thành phố Đà Nẵng" className="d-logo-img" />
            ) : (
              <>
                <span className="d-small">ĐẶC SAN</span>
                <span className="d-big">Khoa học &amp; Phát triển</span>
                <span className="d-city">THÀNH PHỐ ĐÀ NẴNG</span>
              </>
            )}
          </Link>
          <nav className="d-nav" aria-label="Điều hướng chính">
            <Link href="/" className="d-on" aria-current="page">Trang chủ</Link>
            <Link href="/issues">Số đã phát hành</Link>
            <Link href="/research">Nghiên cứu – Trao đổi</Link>
            <Link href="/docs">Tư liệu</Link>
            <Link href="/search">Tìm bài báo</Link>
          </nav>
        </div>
      </header>

      <section className="d-hero">
        {site.hero_bg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="d-hero-img" src={site.hero_bg} alt="" />
        ) : (
          <HeroBg />
        )}
        <div className="d-wrap">
          <div className="d-hero-grid">
            {latest && (
              <Link href={`/issues/${latest.slug}`} className="d-cover" aria-label={`Bìa ${latest.label}`}>
                {latest.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={latest.cover_url} alt={`Bìa ${latest.label}`} />
                ) : (
                  <>
                    <span className="d-c-small">ĐẶC SAN</span>
                    <span className="d-c-big">Khoa học &amp; Phát triển</span>
                    <span className="d-c-city">THÀNH PHỐ ĐÀ NẴNG</span>
                    <span className="d-c-num">{latest.label}</span>
                  </>
                )}
              </Link>
            )}
            <div>
              {latest && <span className="d-badge">Số mới nhất — {latest.label}</span>}
              <h2>{latest?.theme || 'Đặc san Khoa học & Phát triển thành phố Đà Nẵng'}</h2>
              {(latest?.summary || heroIntro) && <p className="d-lede">{latest?.summary || heroIntro}</p>}
              {latest && (
                <div className="d-actions">
                  <Link href={`/issues/${latest.slug}`} className="d-btn">Đọc số mới</Link>
                  <Link href={`/issues/${latest.slug}`} className="d-btn d-ghost">Xem mục lục</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="d-search d-wrap">
        <form className="d-search-card" action="/search" role="search">
          <div className="d-search-title">Tìm kiếm &amp; Khám phá bài viết</div>
          <label className="d-field">Chuyên mục
            <select name="field" defaultValue="">
              <option value="">Tất cả chuyên mục</option>
              {fields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="d-field">Tác giả, tiêu đề hoặc từ khóa
            <input type="search" name="q" minLength={2} required placeholder="Ví dụ: đô thị thông minh, Nguyễn Văn A" />
          </label>
          <button className="d-search-btn" type="submit" aria-label="Tìm kiếm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          </button>
        </form>
      </section>

      {allArticles.length > 0 && (
        <section className="d-sec d-wrap" id="trong-so-nay">
          <div className="d-sec-head">
            <h2>Trong số này</h2>
            {latest && <Link href={`/issues/${latest.slug}`}>Toàn bộ mục lục &rsaquo;</Link>}
          </div>
          <IssueTabs articles={allArticles} fields={fields} />
        </section>
      )}

      <section className="d-sec d-wrap">
        <div className="d-sec-head"><h2>Chuyên mục chính</h2></div>
        <div className="d-cats">
          {CATS.map((c) => (
            <Link key={c.name} href={c.href} className="d-ccard">
              <span className="d-ico"><Icon d={c.d} /></span>
              <div><h3>{c.name}</h3><p>{c.desc}</p></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="d-sec d-wrap">
        <div className="d-sec-head">
          <h2>Các số đã phát hành</h2>
          <Link href="/issues">Xem toàn bộ số đã phát hành &rsaquo;</Link>
        </div>
        <div className="d-issues">
          <div className="d-covers">
            {issues.map((i) => (
              <Link key={i.slug} href={`/issues/${i.slug}`} className="d-mini">
                <div className="d-thumb d-ph" role="img" aria-label={`Bìa ${i.label}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.cover_url && <img src={i.cover_url} alt="" />}
                  <b>Số {i.number}</b>
                </div>
                {i.label}
              </Link>
            ))}
          </div>
          <div className="d-cta-list">
            <Link href="/gui-bai" className="d-cta">
              <span className="d-ico"><Icon size={32} d="M4 20l4-1 11-11-3-3L5 16z" /></span>
              <div><h3>Gửi bài cho Đặc san</h3><p>Đăng tải công trình nghiên cứu, trao đổi, ứng dụng và các bài viết có giá trị khoa học, thực tiễn.</p></div>
              <span className="d-arrow" aria-hidden="true">&rsaquo;</span>
            </Link>
            <a href="#dang-ky" className="d-cta">
              <span className="d-ico"><Icon size={32} d="M3 7l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /></span>
              <div><h3>Đăng ký nhận số mới</h3><p>Nhận thông báo khi có số mới phát hành </p></div>
              <span className="d-arrow" aria-hidden="true">&rsaquo;</span>
            </a>
            <Link href="/docs" className="d-cta">
              <span className="d-ico"><Icon size={32} d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" /></span>
              <div><h3>Quy định xuất bản</h3><p>Thể lệ, quy định, quy trình phản biện và các hướng dẫn liên quan.</p></div>
              <span className="d-arrow" aria-hidden="true">&rsaquo;</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="d-sec d-wrap" id="hoat-dong">
        <div className="d-two">
          <div>
            <div className="d-sec-head">
              <h2>Hoạt động nổi bật của LHHĐN</h2>
              <a href="https://lhh.danang.gov.vn/chi-tiet-tin-tuc?danhmuc=1" target="_blank" rel="noopener noreferrer">Xem trên lhh.danang.gov.vn &rsaquo;</a>
            </div>
            {acts.map((a) => (
              <a key={a.id} className="d-act" href={a.url || '#'} target="_blank" rel="noopener noreferrer">
                <span className="d-date">{fmtDate(a.date)}</span>
                <span><span className="d-ti">{a.title}</span><span className="d-ki">{a.kind}</span></span>
              </a>
            ))}
          </div>
          <div>
            <div className="d-box">
              <h3>Gửi bài cho Đặc san</h3>
              <p>Bản thảo nhận liên tục. Xem thể lệ gửi bài, quy định xuất bản và đạo đức công bố khoa học trước khi gửi.</p>
              <div className="d-actions">
                <Link href="/gui-bai" className="d-btn">Gửi bài ngay</Link>
                <Link href="/docs" className="d-btn d-ghost">Thể lệ gửi bài</Link>
              </div>
            </div>
            <div className="d-box" id="dang-ky">
              <h3>Nhận thông báo số mới</h3>
              <p>Mỗi hai tháng một email khi số mới lên web.</p>
              <SubscribeForm />
            </div>
          </div>
        </div>
      </section>

      <footer className="d-footer">
        <div className="d-wrap">
          <div className="d-fl">ĐẶC SAN<br />Khoa học &amp; Phát triển<small>THÀNH PHỐ ĐÀ NẴNG</small></div>
          <div className="d-col">
            <strong>Cơ quan chủ quản: {site.org_name}</strong><br />
            {(site.contact || '').split('\n').map((l: string, i: number) => <span key={i}>{l}<br /></span>)}
          </div>
          <div className="d-col">
            <strong>ISSN {site.issn}</strong><br />
            {site.license}<br />
            © {new Date().getFullYear()} Đặc san Khoa học &amp; Phát triển thành phố Đà Nẵng.
          </div>
        </div>
      </footer>
    </div>
  );
}
