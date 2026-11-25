// Bố cục trang chủ: danh sách các khối theo thứ tự từ trên xuống, bật/tắt từng khối, đổi tiêu đề, số mục.
// Lưu ở cấu hình "home_layout" (JSON, sửa ở admin: Giao diện › Bố cục trang chủ). Thiếu hoặc lỗi thì dùng bố cục mặc định.

export const HOME_LAYOUT_KEY = 'home_layout';

export type HomeBlockKey = 'front' | 'stats' | 'topics' | 'posts' | 'acts' | 'archive' | 'submit';

export type HomeBlockInfo = {
  key: HomeBlockKey;
  label: string; // tên trong trang quản trị
  desc: string;
  title?: string; // có tiêu đề sửa được: tiêu đề mặc định
  count?: { min: number; max: number; def: number; label: string }; // có số mục sửa được
  hidden?: boolean; // mặc định ẩn
};

// Thứ tự mặc định (giống trang chủ trước khi có cấu hình). Khối "Bài viết" mặc định ẩn.
export const HOME_BLOCKS: HomeBlockInfo[] = [
  { key: 'front', label: 'Tiêu điểm và Số mới nhất', desc: 'Slide tiêu điểm cùng bìa số mới nhất ở đầu trang.' },
  { key: 'stats', label: 'Dải số liệu', desc: 'Số đặc san đã phát hành, số bài, số trang, chu kỳ phát hành.' },
  { key: 'topics', label: 'Chuyên mục', desc: 'Các số đặc san theo chuyên mục, chuyển bằng thẻ.', title: 'Chuyên mục' },
  { key: 'posts', label: 'Bài viết', desc: 'Các bài viết riêng mới nhất (Nội dung › Bài viết).', title: 'Bài viết', hidden: true,
    count: { min: 1, max: 12, def: 4, label: 'Số bài hiện' } },
  { key: 'acts', label: 'Tin hoạt động', desc: 'Các tin hoạt động mới nhất.', title: 'Tin hoạt động' },
  { key: 'archive', label: 'Kho lưu trữ', desc: 'Toàn bộ các số đặc san theo năm.', title: 'Kho lưu trữ' },
  { key: 'submit', label: 'Gửi bài và Đăng ký nhận tin', desc: 'Lời mời gửi bài và ô đăng ký email nhận thông báo số mới.' },
];

export type HomeBlock = { key: HomeBlockKey; hidden: boolean; title: string; count: number };

const INFO = Object.fromEntries(HOME_BLOCKS.map((b) => [b.key, b])) as Record<HomeBlockKey, HomeBlockInfo>;
export const blockInfo = (k: HomeBlockKey) => INFO[k];

const fresh = (k: HomeBlockKey): HomeBlock => ({ key: k, hidden: !!INFO[k].hidden, title: INFO[k].title || '', count: INFO[k].count?.def ?? 0 });

/** Đọc cấu hình; mọi khối luôn có mặt đúng một lần (khối chưa có trong cấu hình được chèn lại ở vị trí mặc định). */
export function parseHomeLayout(raw?: string | null): HomeBlock[] {
  let arr: any[] = [];
  try {
    const j = raw ? JSON.parse(raw) : [];
    if (Array.isArray(j)) arr = j;
  } catch { /* dùng mặc định */ }
  const out: HomeBlock[] = [];
  for (const x of arr) {
    const k = x?.key as HomeBlockKey;
    if (!INFO[k] || out.some((b) => b.key === k)) continue;
    const info = INFO[k];
    const b = fresh(k);
    b.hidden = typeof x.hidden === 'boolean' ? x.hidden : b.hidden;
    if (info.title && typeof x.title === 'string' && x.title.trim()) b.title = x.title.trim().slice(0, 60);
    if (info.count && Number.isFinite(Number(x.count))) b.count = Math.min(info.count.max, Math.max(info.count.min, Math.round(Number(x.count))));
    out.push(b);
  }
  // khối thiếu: chèn sau khối đứng trước nó trong bố cục mặc định
  HOME_BLOCKS.forEach((info, i) => {
    if (out.some((b) => b.key === info.key)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const pos = out.findIndex((b) => b.key === HOME_BLOCKS[j].key);
      if (pos >= 0) { at = pos + 1; break; }
    }
    out.splice(at, 0, fresh(info.key));
  });
  return out;
}

/** Chỉ lưu phần khác mặc định của từng khối để cấu hình gọn. */
export function serializeHomeLayout(blocks: HomeBlock[]): string {
  return JSON.stringify(blocks.map((b) => {
    const info = INFO[b.key];
    return {
      key: b.key,
      hidden: b.hidden,
      ...(info.title ? { title: b.title.trim() || info.title } : {}),
      ...(info.count ? { count: b.count } : {}),
    };
  }));
}
