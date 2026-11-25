import type { Metadata } from 'next';
import { get } from '@/lib/api';
import SpotList from '@/components/site/SpotList';
import '@/components/site/listing.css';

export const metadata: Metadata = { title: 'Tiêu điểm' };

// Các mục Tiêu điểm chọn trong trang quản trị (số đặc san, hoạt động, trang nội dung, bài viết), theo thứ tự sắp xếp.
// Hiện 10 số mới nhất, còn lại mở bằng "Xem thêm" (SpotList).
export default async function Spotlight() {
  const items: any[] = await get('/featured').catch(() => []);
  return (
    <div className="wrap page lst">
      <header className="lst-head">
        <small>TIÊU ĐIỂM</small>
        <h1>Nội dung tiêu điểm</h1>
        <p>Những nội dung được Ban Biên tập chọn giới thiệu nổi bật.</p>
      </header>
      {items.length === 0 ? (
        <p className="lst-empty">Chưa có nội dung nào được chọn làm tiêu điểm.</p>
      ) : (
        <SpotList items={items} />
      )}
    </div>
  );
}
