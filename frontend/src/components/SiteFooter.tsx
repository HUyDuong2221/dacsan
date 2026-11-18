import Link from 'next/link';
export default function SiteFooter() {
 return <footer className="site-footer"><div className="home-container footer-columns">
  <div><h2>Đặc san Khoa học & Phát triển thành phố Đà Nẵng</h2><p>Cơ quan chủ quản: Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng.</p></div>
  <div><h3>KHÁM PHÁ</h3><Link href="/issues">Các số đã phát hành</Link><Link href="/search">Tra cứu bài viết</Link><Link href="/#trong-so-nay">Nghiên cứu – Trao đổi</Link><Link href="/tai-lieu">Tư liệu</Link><Link href="/thong-bao">Thông báo</Link><Link href="/hoat-dong">Hoạt động</Link></div>
  <div><h3>LIÊN HỆ</h3><p>05 Quang Trung, phường Hải Châu, thành phố Đà Nẵng</p><a href="mailto:lhhdanang@gmail.com">lhhdanang@gmail.com</a><a href="https://lhh.danang.gov.vn/" target="_blank" rel="noopener noreferrer">lhh.danang.gov.vn</a></div>
  <div><h3>BAN BIÊN TẬP</h3><Link href="/admin">Đăng nhập quản trị</Link><a href="mailto:lhhdanang@gmail.com">Liên hệ gửi bài</a><p>Đọc và đối chiếu nội dung với bản PDF gốc của từng số.</p></div>
 </div><div className="footer-bottom"><div className="home-container"><span>© Đặc san Khoa học & Phát triển thành phố Đà Nẵng</span><span>Tri thức · Khoa học · Đổi mới sáng tạo</span></div></div></footer>;
}
