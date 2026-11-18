# Phân tích nguồn HTML và Đặc san số 18

## Nguồn
- `sample/HTML-giao-dien-tham-chieu.html`: HTML đóng gói template tương tác, trước đây dùng React-like runtime và mảng dữ liệu local (`ISSUE_LIST`, `ARTICLES`, `DOCS`, ...).
- `sample/KHPT_2-11.pdf`: PDF gốc Đặc san Khoa học & Phát triển thành phố Đà Nẵng, số 18 (9-2026).

## Cấu trúc PDF
| Trang PDF (1-indexed) | Nội dung |
|---|---|
| 1 | Bìa số 18, chủ đề Quốc khánh 2-9 |
| 2 | Phóng sự ảnh hội thảo quốc tế |
| 3 | Lời thưa |
| 4 | Mục lục |
| 5–133 | 24 nội dung chính, 6 chuyên mục |
| 134 | Thông tin xuất bản và liên hệ |
| 135–136 | Trang phụ/giới thiệu tổ chức, hoạt động |

### Chuyên mục số 18
1. TRÍ THỨC, KHOA HỌC VÀ TỔ CHỨC HỘI
2. ĐÀ NẴNG TRÊN ĐƯỜNG PHÁT TRIỂN
3. NHÂN VẬT, LỊCH SỬ VÀ VĂN HÓA
4. Ý KIẾN - TRAO ĐỔI
5. NHÌN RA THẾ GIỚI
6. THÔNG TIN

Trích xuất mục lục dùng các text block ở trang 4, sau đó lấy số trang in. Trong mẫu này số trang in trùng PDF index 1-based. Trong ấn phẩm khác cần mapping riêng. Bài có thể là nghiên cứu, tin, danh sách, thư ngỏ; dữ liệu không giống mô hình blog đơn giản.

## Kiến trúc số hóa

- Mục lục/metadata được tạo tự động và có thể xuất bản để độc giả tìm bài trong PDF.
- Raw extracted text **không được xem là toàn văn biên tập chính thức**. Bố cục PDF hai cột, bảng, hình ảnh và chú thích có thể không được tái tạo chính xác.
- Admin có thể xem raw text, mở PDF cùng vị trí để đối chiếu, sửa body HTML và đánh dấu `full_text_verified`.
- Chỉ bài được hiệu đính mới hiển thị body HTML ở public API.
- Phần bìa/phóng sự ảnh/trang phụ vẫn bảo tồn trong PDF, không ép thành bài trong mục lục.

## Phạm vi prototype frontend

Trang chủ, kho số, chi tiết số, chi tiết bài, search, PDF Reader, CMS dashboard, CRUD cơ bản. Đây là **UI mới dựa trên nhận diện và chức năng mẫu**, không phải trích xuất pixel-perfect của HTML.
