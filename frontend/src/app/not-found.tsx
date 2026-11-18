import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap page">
      <div className="kicker">404</div>
      <h1 className="serif" style={{ fontSize: 34, margin: '10px 0 20px' }}>Không tìm thấy trang</h1>
      <Link href="/" className="btn">Về trang chủ</Link>
    </div>
  );
}
