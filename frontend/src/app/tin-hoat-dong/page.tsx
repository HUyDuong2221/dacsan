import type { Metadata } from 'next';
import { get } from '@/lib/api';
import NewsList from '@/components/NewsList';
import '@/components/listing.css';

export const metadata: Metadata = { title: 'Tin hoạt động' };

// Danh sách "Hoạt động" trong trang quản trị (chỉ mục đang bật Hiển thị), mới nhất trước.
// Hiện 10 tin mới nhất, còn lại mở bằng "Xem thêm" (NewsList).
export default async function News() {
  const items: any[] = await get('/activities').catch(() => []);
  return (
    <div className="wrap page lst">
      <header className="lst-head">
        <small>TIN HOẠT ĐỘNG</small>
        <h1>Tin hoạt động</h1>
        <p>Hội thảo, giải thưởng, hợp tác và các hoạt động của Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng.</p>
      </header>
      {items.length === 0 ? (
        <p className="lst-empty">Chưa có tin hoạt động.</p>
      ) : (
        <NewsList items={items} />
      )}
    </div>
  );
}
