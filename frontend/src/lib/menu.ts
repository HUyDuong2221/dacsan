// Menu điều hướng chính. Lưu ở cấu hình site, khóa "nav_menu" (JSON [{label, href, hidden?}]), sửa ở admin: Giao diện › Menu điều hướng.
// hidden = mục tạm ẩn khỏi website nhưng vẫn giữ trong danh sách để bật lại.
export type MenuItem = { label: string; href: string; hidden?: boolean };

export const DEFAULT_MENU: MenuItem[] = [
  { href: '/', label: 'Trang chủ' },
  { href: '/tieu-diem', label: 'Tiêu điểm' },
  { href: '/issues', label: 'Đặc san' },
  { href: '/research', label: 'Nghiên cứu – Trao đổi' },
  { href: '/tin-hoat-dong', label: 'Tin hoạt động' },
  { href: '/docs', label: 'Tư liệu' },
];

export const MENU_KEY = 'nav_menu';

/** Liên kết hợp lệ: đường dẫn trong site ("/..."), hoặc http(s) ra ngoài. */
export function validHref(href: string) {
  return /^\/(?!\/)[^\s]*$/.test(href) || /^https?:\/\/[^\s]+$/.test(href);
}

/** Đọc menu từ cấu hình; thiếu hoặc lỗi thì dùng menu mặc định để site không bao giờ mất thanh điều hướng. */
export function parseMenu(raw?: string | null): MenuItem[] {
  if (!raw) return DEFAULT_MENU;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return DEFAULT_MENU;
    const items = arr
      .filter((x) => x && typeof x.label === 'string' && typeof x.href === 'string')
      .map((x) => ({ label: x.label.trim(), href: x.href.trim(), ...(x.hidden ? { hidden: true } : {}) }))
      .filter((x) => x.label && validHref(x.href));
    return items.length ? items : DEFAULT_MENU;
  } catch {
    return DEFAULT_MENU;
  }
}

/** Các mục hiện trên website (bỏ mục đang ẩn). */
export function visibleMenu(raw?: string | null): MenuItem[] {
  return parseMenu(raw).filter((x) => !x.hidden);
}
