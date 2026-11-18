'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, ArrowRight, ArrowUp, BookOpen, Mail, Search} from 'lucide-react';
import {Activity, HomeData, Issue, Notice, mediaUrl} from '@/lib/api';

function Cover({issue}: {issue: Issue | null}) {
  return <div className="home-cover">{issue?.cover_key ? <img src={mediaUrl(issue.cover_key)} alt={`Bìa đặc san số ${issue.number}`}/> : <><BookOpen size={54} strokeWidth={1}/><span>{issue ? `Số ${issue.number} · ${issue.month}/${issue.year}` : 'Khoa học & Phát triển'}</span></>}</div>;
}

export default function HomePage({data, unavailable, activities = [], notices = []}: {data: HomeData; unavailable: boolean; activities?: Activity[]; notices?: Notice[]}) {
  const issue = data.latest_issue;
  const articles = data.featured_articles;
  const slides = articles.slice(0, 5);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [mailReady, setMailReady] = useState(false);
  const current = slides[slide % Math.max(slides.length, 1)];
  const categories = Array.from(new Set(articles.map(article => article.section_name).filter(Boolean)));
  const visible = articles.filter(article => !category || article.section_name === category).slice(0, 6);
  const issueHref = issue ? `/issues/${issue.slug}` : '/issues';
  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setSlide(value => (value + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, [paused, slides.length, slide]);

  return <div className="home-page">
    <section className="home-hero science-panel" aria-label="Bài viết nổi bật">
      <div className="science-orbit" aria-hidden="true"/><div className="science-orbit science-orbit-small" aria-hidden="true"/>
      <svg className="science-network" viewBox="0 0 600 300" aria-hidden="true"><g fill="none" stroke="currentColor" strokeDasharray="6 9"><path d="M20 250 120 190 210 236 320 150 430 196 560 110M60 286 160 236 250 268 380 206 500 240M120 190 160 236M320 150 380 206M430 196 500 240"/></g><g fill="currentColor"><circle cx="120" cy="190" r="4"/><circle cx="320" cy="150" r="4"/><circle cx="430" cy="196" r="4"/></g></svg>
      <div className="home-container hero-layout">
        <div className="hero-copy" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);}}>
          <p className="hero-eyebrow"><span/>{issue ? `SỐ MỚI NHẤT — SỐ ${issue.number} (${issue.month}-${issue.year})` : 'ĐẶC SAN KHOA HỌC & PHÁT TRIỂN'}</p>
          <div className="hero-slide" key={current?.id ?? 'welcome'}><p className="hero-category">{current?.section_name || 'TRI THỨC · KHOA HỌC · ĐỔI MỚI SÁNG TẠO'}</p><h1><Link href={current ? `/articles/${current.slug}` : issueHref}>{current?.title || issue?.theme || 'Tri thức kiến tạo tương lai'}</Link></h1><p className="hero-description">{current?.summary || issue?.description || 'Nơi hội tụ nghiên cứu, phản biện, tri thức khoa học và những câu chuyện phát triển của thành phố Đà Nẵng.'}</p></div>
          <div className="hero-actions"><Link className="home-button home-button-cyan" href={current ? `/articles/${current.slug}` : issueHref}>{current ? 'Đọc bài này' : 'Khám phá đặc san'}</Link><Link className="home-button home-button-ghost" href={issueHref}>{issue ? `Mục lục số ${issue.number}` : 'Các số đã phát hành'}</Link></div>
          {slides.length > 1 && <div className="hero-controls"><button aria-label="Bài trước" onClick={() => setSlide((slide - 1 + slides.length) % slides.length)}><ArrowLeft size={17}/></button><button aria-label="Bài tiếp theo" onClick={() => setSlide((slide + 1) % slides.length)}><ArrowRight size={17}/></button><div className="hero-dots">{slides.map((article, index) => <button key={article.id} aria-label={`Xem bài nổi bật ${index + 1}`} aria-pressed={slide === index} className={slide === index ? 'active' : ''} onClick={() => setSlide(index)}/>)}</div><span>{slide + 1} / {slides.length}</span></div>}
        </div>
        <Link href={issueHref} className="hero-cover-link" aria-label={issue ? `Xem đặc san số ${issue.number}` : 'Xem kho đặc san'}><Cover issue={issue}/></Link>
      </div>
    </section>
    <section className="home-search-strip" aria-label="Tra cứu bài viết"><div className="home-container"><form action="/search" method="get"><label htmlFor="home-search" className="sr-only">Tìm theo tiêu đề, tác giả hoặc nội dung</label><Search size={19} aria-hidden="true"/><input id="home-search" name="q" maxLength={200} placeholder="Tìm theo tiêu đề, tác giả hoặc nội dung" required/><button type="submit">Tìm kiếm <ArrowRight size={16}/></button></form><Link href="/issues">Kho lưu trữ đặc san <ArrowRight size={15}/></Link></div></section>
    <section className="home-container home-section" id="trong-so-nay">
      <div className="home-section-heading"><h2>Trong số này</h2><Link href={issueHref}>Toàn bộ mục lục <ArrowRight size={16}/></Link></div>
      <div className="home-filters" aria-label="Lọc chuyên mục"><button aria-pressed={!category} className={!category ? 'active' : ''} onClick={() => setCategory('')}>Tất cả</button>{categories.map(name => <button key={name} aria-pressed={category === name} className={category === name ? 'active' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div>
      {visible.length ? <div className="home-article-grid">{visible.map(article => <Link href={`/articles/${article.slug}`} key={article.id} className="home-article"><span>{article.section_name || 'Bài viết'}</span><h3>{article.title}</h3><p>{article.author_display}{article.author_display && ' · '}tr. {article.print_page_start}{article.print_page_end > article.print_page_start && `–${article.print_page_end}`}</p></Link>)}</div> : <p className="home-empty" role="status">{unavailable ? 'Chưa thể tải nội dung đặc san. Vui lòng thử lại sau.' : 'Các bài viết sẽ được cập nhật khi số đặc san được xuất bản.'}</p>}
    </section>
    <section className="home-recent science-panel" id="cac-so-gan-day"><div className="home-container home-section"><div className="home-section-heading"><h2>Các số gần đây</h2><Link href="/issues">Tất cả các số đã phát hành <ArrowRight size={16}/></Link></div>{data.recent_issues.length ? <div className="home-issue-grid">{data.recent_issues.slice(0, 8).map(item => <Link className="home-issue" key={item.id} href={`/issues/${item.slug}`}><Cover issue={item}/><span>SỐ {item.number} · {item.month}/{item.year}</span><h3>{item.theme || item.title}</h3></Link>)}</div> : <p className="home-empty">Chưa có số đặc san được công bố.</p>}</div></section>
    <section className="home-container home-section home-community" id="tu-lieu">
      <div><div className="home-section-heading"><h2>Hoạt động nổi bật của LHHĐN</h2>{activities.length ? <Link href="/hoat-dong">Tất cả hoạt động <ArrowRight size={16}/></Link> : <a href="https://lhh.danang.gov.vn/" target="_blank" rel="noopener noreferrer">Xem trên cổng thông tin <ArrowRight size={16}/></a>}</div><p className="community-intro">Theo dõi hoạt động của Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng.</p>{activities.length > 0 ? activities.map(item => <Link className="community-link" key={item.id} href={`/hoat-dong/${item.slug}`}><span>{new Date(item.activity_date).toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'})}</span><div><h3>{item.title}</h3><p>{item.kind}{item.location && ` · ${item.location}`}</p></div><ArrowRight size={17}/></Link>) : [
        ['01', 'Tin tức và hoạt động của Liên hiệp Hội', 'Kết nối đội ngũ trí thức khoa học và công nghệ.'],
        ['02', 'Khoa học, công nghệ và đổi mới sáng tạo', 'Thông tin nghiên cứu và ứng dụng trong đời sống.'],
        ['03', 'Tư vấn, phản biện và giám định xã hội', 'Đóng góp tri thức cho sự phát triển của thành phố.'],
      ].map(([number, title, description]) => <a className="community-link" key={number} href="https://lhh.danang.gov.vn/" target="_blank" rel="noopener noreferrer"><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div><ArrowRight size={17}/></a>)}<Link className="community-archive" href="/search">Tra cứu nghiên cứu trong kho đặc san <ArrowRight size={16}/></Link></div>
      <aside className="home-sidebar">{notices.length > 0 && <div className="home-info-box"><h2>Thông báo của tòa soạn</h2>{notices.map(n => <p key={n.id}><Link href={`/thong-bao/${n.slug}`}><strong>{n.tag}</strong> · {new Date(n.notice_date).toLocaleDateString('vi-VN')}<br/>{n.title}</Link></p>)}<Link href="/thong-bao">Tất cả thông báo →</Link></div>}<div className="home-info-box"><h2>Gửi bài cho Đặc san</h2><p>Liên hệ ban biên tập để nhận thể lệ gửi bài, quy định xuất bản và hướng dẫn chuẩn bị bản thảo.</p><a className="home-button home-button-blue" href="mailto:lhhdanang@gmail.com?subject=Đề%20nghị%20hướng%20dẫn%20gửi%20bài%20Đặc%20san">Liên hệ gửi bài <ArrowRight size={16}/></a></div><div className="home-info-box newsletter"><h2>Nhận thông báo số mới</h2><p>Gửi yêu cầu nhận tin đến ban biên tập qua ứng dụng email của bạn.</p><form onSubmit={event => {event.preventDefault(); window.location.href = `mailto:lhhdanang@gmail.com?subject=${encodeURIComponent('Đăng ký nhận thông báo số đặc san mới')}&body=${encodeURIComponent(`Kính gửi Ban biên tập,\nTôi muốn nhận thông báo khi có số đặc san mới tại địa chỉ: ${email}.\nXin cảm ơn.`)}`; setMailReady(true);}}><label htmlFor="newsletter-email" className="sr-only">Địa chỉ email</label><input id="newsletter-email" type="email" placeholder="Địa chỉ email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email"/><button type="submit">Soạn email <Mail size={15}/></button></form>{mailReady && <p className="newsletter-status" role="status">Vui lòng gửi thư trong ứng dụng email để hoàn tất yêu cầu. Nếu ứng dụng chưa mở, hãy liên hệ lhhdanang@gmail.com.</p>}</div></aside>
    </section>
    <div className="home-floating"><Link href="/search" aria-label="Tìm kiếm bài viết"><Search size={22}/></Link><button aria-label="Về đầu trang" onClick={() => window.scrollTo({top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'})}><ArrowUp size={22}/></button></div>
  </div>;
}
