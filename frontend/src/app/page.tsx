import Link from 'next/link';
import { get } from '@/lib/api';
import HeroSlider from '@/components/HeroSlider';
import IssueTabs from '@/components/IssueTabs';
import SubscribeForm from '@/components/SubscribeForm';
import { Activities, Cover, IssueCard, SearchBox } from '@/components/Parts';

export default async function Home() {
  const d = await get('/home');
  const latest = d.latest_issue;
  return (
    <>
      <section className="hero dark">
        <div className="wrap">
          <HeroSlider slides={d.hero} />
          {latest && (
            <Link href={`/issues/${latest.slug}`} style={{ flex: '0 1 260px' }}>
              <Cover issue={latest} large />
            </Link>
          )}
        </div>
      </section>

      <section style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="wrap row" style={{ padding: '20px 28px' }}>
          <div style={{ flex: 1, minWidth: 240 }}><SearchBox /></div>
          <span className="mono muted">Kho lưu trữ {d.issues.length}+ số</span>
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
        <div className="wrap">
          <div className="sec-head" style={{ borderImage: 'none', borderColor: 'rgba(168,212,238,.3)' }}>
            <h2 style={{ color: '#fff' }}>Các số gần đây</h2>
            <Link href="/issues" style={{ color: '#8fe1ff' }}>Tất cả các số đã phát hành →</Link>
          </div>
          <div className="issue-grid">
            {d.issues.slice(0, 6).map((i: any) => <IssueCard key={i.slug} i={i} dark />)}
          </div>
        </div>
      </section>

      <section className="wrap two">
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          <div className="sec-head" style={{ borderImage: 'none', borderColor: 'var(--line)' }}>
            <h2 style={{ fontSize: 24 }}>Hoạt động nổi bật của LHHĐN</h2>
          </div>
          <Activities items={d.activities} />
        </div>
        <div style={{ flex: '1 1 300px', maxWidth: 420 }}>
          <div className="box tint">
            <h3>Gửi bài cho Đặc san</h3>
            <p>Bản thảo nhận liên tục. Xem thể lệ gửi bài, quy định xuất bản và đạo đức công bố khoa học trước khi gửi.</p>
            <Link href="/docs" className="btn">Hướng dẫn gửi bài</Link>
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
