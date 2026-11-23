// Banner trang chủ: vị trí (khớp BANNER_POSITIONS ở backend/app/models.py) và kích thước theo vị trí.
// Kích thước lưu ở cấu hình site, khóa "banner_layout" (JSON { [vị trí]: BannerLayout }), sửa ở admin: Giao diện › Banner trang chủ.

export const BANNER_POSITIONS = [
  { value: 'top', label: 'Đầu trang, trên Tiêu điểm' },
  { value: 'after_front', label: 'Dưới Tiêu điểm / Số mới nhất' },
  { value: 'before_topics', label: 'Trên Chuyên mục' },
  { value: 'before_acts', label: 'Trên Tin hoạt động' },
  { value: 'before_archive', label: 'Trên Kho lưu trữ' },
  { value: 'before_submit', label: 'Cuối trang, trên Gửi bài' },
] as const;

export type BannerPosition = (typeof BANNER_POSITIONS)[number]['value'];
export type BannerItem = { id: number; image_url: string; link: string | null; alt: string; position: string };
export type BannerLayout = {
  h: number; // chiều cao trên máy tính (px)
  hm: number; // chiều cao trên điện thoại (px)
  width: 'content' | 'full'; // theo khung nội dung | tràn hết màn hình
  fit: 'cover' | 'contain'; // cắt ảnh cho vừa khung | hiện đủ ảnh
  interval: number; // giây giữa hai lần tự chuyển (slider)
  hidden: boolean; // ẩn cả vị trí (mọi banner ở vị trí này không hiện), banner vẫn giữ nguyên
};

export const LAYOUT_KEY = 'banner_layout';
export const LIMITS = { h: [80, 800], hm: [60, 500], interval: [3, 30] } as const;
export const DEFAULT_LAYOUT: BannerLayout = { h: 320, hm: 180, width: 'content', fit: 'cover', interval: 6, hidden: false };

const clamp = (v: unknown, [lo, hi]: readonly [number, number], d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function normLayout(x: any): BannerLayout {
  const d = DEFAULT_LAYOUT;
  return {
    h: clamp(x?.h, LIMITS.h, d.h),
    hm: clamp(x?.hm, LIMITS.hm, d.hm),
    width: x?.width === 'full' ? 'full' : 'content',
    fit: x?.fit === 'contain' ? 'contain' : 'cover',
    interval: clamp(x?.interval, LIMITS.interval, d.interval),
    hidden: x?.hidden === true,
  };
}

/** Đọc cấu hình kích thước; thiếu hoặc lỗi thì dùng mặc định cho từng vị trí. */
export function parseLayouts(raw?: string | null): Record<BannerPosition, BannerLayout> {
  let obj: any = {};
  try { obj = raw ? JSON.parse(raw) : {}; } catch { obj = {}; }
  return Object.fromEntries(BANNER_POSITIONS.map((p) => [p.value, normLayout(obj?.[p.value])])) as Record<BannerPosition, BannerLayout>;
}
