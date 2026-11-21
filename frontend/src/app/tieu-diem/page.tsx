import type { Metadata } from 'next';
import { get } from '@/lib/api';
import SpotList from '@/components/SpotList';
import '@/components/listing.css';

export const metadata: Metadata = { title: 'Tiêu điểm' };

// Các số đặc san được tick "Tiêu điểm" trong trang quản trị (mới nhất trước).
// Hiện 10 số mới nhất, còn lại mở bằng "Xem thêm" (SpotList).
export default async function Spotlight() {
  const items: any[] = await get('/featured').catch(() => []);
  return (
    <div className="wrap page lst">
      <header className="lst-head">
        <small>TIÊU ĐIỂM</small>
        <h1>Các số đặc san tiêu điểm</h1>
        <p>Những số đặc san được Ban Biên tập chọn giới thiệu nổi bật.</p>
      </header>
      {items.length === 0 ? (
        <p className="lst-empty">Chưa có số đặc san nào được đánh dấu tiêu điểm.</p>
      ) : (
        <SpotList items={items} />
      )}
    </div>
  );
}
