// Cấu hình trang quản trị: nhóm menu, mục con, biểu tượng, vai trò được thấy từng mục, và định nghĩa các mục
// dùng ResourceManager (trường, nhãn, gợi ý). Thêm mục mới: khai báo ở RESOURCES + TAB_ROLES + GROUPS (+ ICONS).
import type { ResourceDef } from './ResourceManager';

export const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Nội dung', keys: ['issues', 'posts', 'submissions', 'fields'] },
  { title: 'Truyền thông', keys: ['spotlights', 'activities', 'activity-types', 'pages'] },
  { title: 'Báo cáo', keys: ['stats'] },
  { title: 'Hệ thống', keys: ['appearance', 'users', 'settings', 'subscribers', 'outbox', 'backups', 'audit'] },
];
// Menu thả xuống: mục cha -> các mục con
export const SUBMENUS: Record<string, string[]> = { appearance: ['logo', 'banner', 'menu', 'home'] };
export const SUB_KEYS = Object.values(SUBMENUS).flat();
export const ICONS: Record<string, string> = {
  spotlights: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  issues: 'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z',
  submissions: 'M3 7l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  fields: 'M4 6h16M4 12h16M4 18h10',
  posts: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  activities: 'M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  'activity-types': 'M4 7h16M4 12h16M4 17h16M2 7h.01M2 12h.01M2 17h.01',
  users: 'M3 19c0-3 2.7-5 6-5s6 2 6 5M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM16 14c2.5 0 5 1.5 5 4',
  appearance: 'M4 5h16v11H4zM4 16l5-5 4 4 3-3 4 4M9 21h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 1-2-1-1-2h-4l-1 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z',
  subscribers: 'M4 6h16v12H4zM4 7l8 6 8-6',
  pages: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4',
  audit: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  outbox: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  backups: 'M4 7c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3zM4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 12c0 2 3.6 3 8 3s8-1 8-3',
};

export const ROLE_LABELS: Record<string, string> = { admin: 'Quản trị viên', editor: 'Biên tập viên', contributor: 'Cộng tác viên' };
export const STAFF = ['admin', 'editor', 'contributor'];
export const EDIT = ['admin', 'editor'];
export const ADMIN = ['admin'];
// Vai trò được thấy từng thẻ (máy chủ vẫn kiểm tra quyền ở mọi API)
export const TAB_ROLES: Record<string, string[]> = {
  issues: STAFF, spotlights: EDIT, posts: EDIT, submissions: EDIT, fields: EDIT, activities: EDIT, 'activity-types': EDIT,
  users: ADMIN, appearance: ADMIN, logo: ADMIN, banner: ADMIN, menu: ADMIN, home: ADMIN, settings: ADMIN, subscribers: ADMIN,
  pages: EDIT, audit: ADMIN, stats: EDIT, outbox: ADMIN, backups: ADMIN,
};

export const RESOURCES: ResourceDef[] = [
  {
    key: 'issues', title: 'Số đặc san', addLabel: 'Thêm số đặc san mới', editLabel: 'Sửa số đặc san', hideId: true,
    fields: [
      { key: 'number', label: 'Số đặc san', listLabel: 'Số', type: 'number', required: true, list: true, hint: 'Số thứ tự, ví dụ 18. Nhãn hiển thị (VD: Số 18 (8-2026)) tự tạo từ Số đặc san và Ngày đăng.' },
      { key: 'published_at', label: 'Ngày đăng', type: 'date', required: true },
      { key: 'title', label: 'Tên số đặc san', list: true, full: true, hint: 'Hiển thị làm tiêu đề ở khối Tiêu điểm trang chủ. Để trống thì dùng Chủ đề.' },
      { key: 'theme', label: 'Chủ đề (chuyên mục)', listLabel: 'Chuyên mục', required: true, list: true, full: true, optionsFrom: { resource: 'fields', labelKey: 'name', valueKey: 'name' } },
      { key: 'summary', label: 'Giới thiệu', type: 'textarea', def: 'Toàn văn đọc trực tiếp trên web, không cần tải PDF. Mục lục giữ đúng thứ tự chuyên mục của bản in, kèm số trang để đối chiếu.' },
      { key: 'cover_url', label: 'Ảnh bìa', type: 'file' },
      { key: 'pdf_url', label: 'Tệp PDF', type: 'file' },
      { key: 'page_count', label: 'Số trang', type: 'number', hint: 'Để trống thì tự đếm từ tệp PDF khi lưu.' },
      { key: 'published', label: 'Công bố trên website', listLabel: 'Công bố', type: 'bool', list: true,
        hint: 'Chưa đánh dấu thì số và mục lục của số chưa hiện ra ngoài. Lần công bố đầu tiên, hệ thống tự gửi thư báo số mới tới những người đã đăng ký nhận tin.',
        confirmTrue: (row) => (row.notified_at ? null : 'Công bố số này? Hệ thống sẽ tự gửi thư báo số mới tới những người đã đăng ký nhận tin (chỉ gửi một lần cho mỗi số).') },
    ],
  },
  { key: 'submissions', title: 'Bài gửi', fields: [] },
  { key: 'spotlights', title: 'Tiêu điểm', addLabel: 'Thêm vào Tiêu điểm', editLabel: 'Sửa mục Tiêu điểm', hideId: true, fields: [
    { key: 'issue_id', label: 'Số đặc san', listLabel: 'Số đặc san', list: true, optionsFrom: { resource: 'issues', labelKey: 'label' }, hint: 'Chọn ĐÚNG MỘT trong bốn ô: số đặc san, hoạt động, trang nội dung hoặc bài viết.' },
    { key: 'activity_id', label: 'Hoạt động', list: true, optionsFrom: { resource: 'activities', labelKey: 'title' } },
    { key: 'page_id', label: 'Trang nội dung', listLabel: 'Trang', list: true, optionsFrom: { resource: 'pages', labelKey: 'title' } },
    { key: 'post_id', label: 'Bài viết', list: true, optionsFrom: { resource: 'posts', labelKey: 'title' } },
    { key: 'title', label: 'Tiêu đề hiển thị', full: true, hint: 'Để trống thì lấy tiêu đề của nội dung gốc.' },
    { key: 'excerpt', label: 'Mô tả ngắn', type: 'textarea', full: true, hint: 'Để trống thì lấy đoạn đầu của nội dung gốc.' },
    { key: 'image_url', label: 'Ảnh', type: 'image', full: true, hint: 'Để trống thì lấy bìa số đặc san hoặc ảnh đầu tiên trong nội dung.' },
    { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true, def: 0, hint: 'Số nhỏ hiện trước. Trang chủ hiện tối đa 10 mục đầu.' },
    { key: 'published', label: 'Hiển thị', type: 'bool', list: true, def: true }] },
  { key: 'pages', title: 'Trang nội dung', addLabel: 'Thêm trang', editLabel: 'Sửa trang', hideId: true, fields: [
    { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true },
    { key: 'slug', label: 'Đường dẫn', list: true, hint: 'Trang hiện tại /trang/<đường dẫn>, ví dụ gioi-thieu. Để trống thì tự tạo từ tiêu đề. Đổi đường dẫn thì nhớ sửa lại Menu điều hướng.' },
    { key: 'content', label: 'Nội dung', type: 'richtext', hint: 'Dùng nút “Nhập từ Word” để đưa nội dung tệp .docx vào ô này. Hỏi đáp: mỗi câu hỏi là một Đề mục.' },
    { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true, hint: 'Thứ tự trong cột “Thông tin” ở chân trang.' },
    { key: 'published', label: 'Hiển thị', type: 'bool', list: true, def: true }] },
  { key: 'fields', title: 'Chuyên mục', fields: [
    { key: 'name', label: 'Tên', required: true, list: true }, { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true }] },
  { key: 'activities', title: 'Hoạt động', fields: [
    { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true }, { key: 'kind', label: 'Loại hoạt động', list: true, optionsFrom: { resource: 'activity-types', labelKey: 'name', valueKey: 'name' }, hint: 'Quản lý danh sách ở mục “Loại hoạt động”.' },
    { key: 'event_date', label: 'Ngày', type: 'date', list: true }, { key: 'url', label: 'Liên kết' },
    { key: 'content', label: 'Nội dung', type: 'richtext', hint: 'Dùng nút “Nhập từ Word” để đưa nội dung tệp .docx vào ô này.' },
    { key: 'attachment_url', label: 'Tệp đính kèm (Word, PDF, Excel)', type: 'file', hint: 'Tải .doc, .docx, .pdf, .xls, .xlsx để người đọc tải về.' },
    { key: 'published', label: 'Hiển thị', type: 'bool', list: true }] },
  { key: 'activity-types', title: 'Loại hoạt động', addLabel: 'Thêm loại hoạt động', editLabel: 'Sửa loại hoạt động', fields: [
    { key: 'name', label: 'Tên loại', required: true, list: true }, { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true }] },
  { key: 'appearance', title: 'Giao diện', fields: [] },
  { key: 'logo', title: 'Logo', fields: [] },
  { key: 'banner', title: 'Banner trang chủ', fields: [] },
  { key: 'menu', title: 'Menu điều hướng', fields: [] },
  { key: 'home', title: 'Bố cục trang chủ', fields: [] },
  { key: 'users', title: 'Người dùng', addLabel: 'Thêm người dùng', editLabel: 'Sửa người dùng', fields: [
    { key: 'email', label: 'Email đăng nhập', required: true, list: true },
    { key: 'full_name', label: 'Họ tên', list: true },
    { key: 'status_label', label: 'Trạng thái', list: true, listOnly: true },
    { key: 'role', label: 'Vai trò', type: 'select', required: true, list: true, def: 'contributor',
      options: [{ value: 'contributor', label: 'Cộng tác viên' }, { value: 'editor', label: 'Biên tập viên' }, { value: 'admin', label: 'Quản trị viên' }] },
    { key: 'is_active', label: 'Đang hoạt động', type: 'bool', list: true, def: true, hint: 'Bỏ đánh dấu để khóa tài khoản (có hiệu lực ngay).' },
    { key: 'password', label: 'Mật khẩu', type: 'password', hint: 'Tối thiểu 8 ký tự. Khi sửa: để trống = giữ nguyên mật khẩu.' },
  ] },
  { key: 'settings', title: 'Cấu hình site', fields: [
    { key: 'key', label: 'Khóa', required: true, list: true, hint: 'org_name, issn, contact, license, copyright, publisher, editors' },
    { key: 'value', label: 'Giá trị', type: 'textarea', list: true }] },
  { key: 'audit', title: 'Nhật ký hoạt động', fields: [] },
  {
    key: 'posts', title: 'Bài viết', addLabel: 'Thêm bài viết', editLabel: 'Sửa bài viết', hideId: true,
    fields: [
      { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true },
      { key: 'author', label: 'Tác giả', list: true },
      { key: 'published_at', label: 'Ngày đăng', type: 'date', list: true, hint: 'Để trống thì lấy ngày hôm nay.' },
      { key: 'published', label: 'Công bố trên website', listLabel: 'Công bố', type: 'bool', list: true, hint: 'Chưa đánh dấu thì bài chưa hiện ra ngoài. Bài đã công bố có ở trang /bai-viet.' },
      { key: 'cover_url', label: 'Ảnh bìa', type: 'image', full: true, hint: 'Hiện ở danh sách bài viết và khối Tiêu điểm, không hiện trong trang bài. Để trống thì lấy ảnh đầu tiên trong bài.' },
      { key: 'body', label: 'Toàn văn', type: 'richtext', hint: 'Soạn như trong mục Hoạt động; có nút “Nhập từ Word”. Muốn lấy bài từ tệp PDF, dùng khung “Tạo nội dung từ PDF” ở đầu form.' },
    ],
  },
  { key: 'stats', title: 'Thống kê', fields: [] },
  { key: 'outbox', title: 'Hộp thư đi', fields: [] },
  { key: 'backups', title: 'Sao lưu và bảo mật tệp', fields: [] },
  { key: 'subscribers', title: 'Đăng ký email', readonly: true, fields: [{ key: 'email', label: 'Email', list: true }, { key: 'confirmed', label: 'Đã xác nhận email', listLabel: 'Đã xác nhận', type: 'bool', list: true }, { key: 'created_at', label: 'Ngày', list: true }] },
];
