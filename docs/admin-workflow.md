# Chức năng quản trị đặc san

Trang quản trị phục vụ hai vai trò: biên tập viên chuẩn bị nội dung; quản trị viên kiểm tra và quyết định xuất bản. Đơn vị quản lý chính là một số đặc san, bên trong có PDF gốc, chuyên mục và bài viết.

## Những vấn đề đã xử lý

- Tách tạo số thủ công khỏi nhập PDF tự động. Đính kèm PDF vào một bản nháp không đồng nghĩa với tự động tạo mục lục.
- Chuyển các biểu mẫu rời rạc thành bốn bước có thể quay lại. Bản nháp được lưu ngay từ bước đầu.
- Hiển thị rõ tài liệu còn thiếu, số bài chưa hiệu đính và khoảng trang PDF không hợp lệ.
- Xem PDF của số nháp ngay trong quản trị, thay vì dẫn sang trang công khai chưa tồn tại.
- Giữ thông báo lưu thành công và cảnh báo khi rời biểu mẫu có thay đổi chưa lưu.
- Sửa kiểm tra trùng số phát hành: số phải duy nhất trong cùng năm, kể cả khác tháng.
- Hiển thị bài nháp mới thêm vào số đã xuất bản trong quản trị; chỉ công khai sau khi xuất bản lại.

## Chức năng đã triển khai

| Khu vực | Công việc |
| --- | --- |
| Tổng quan | Thống kê số nháp, số đã xuất bản, bài chưa hiệu đính; mở nhanh bản nháp; theo dõi lỗi nhập PDF. |
| Kho đặc san | Tìm theo số, tên, chủ đề; lọc năm và trạng thái; xem bìa và tình trạng PDF. |
| Thông tin số | Tạo, sửa số phát hành, tháng, năm, tên, chủ đề, mô tả, lời thưa và thông tin xuất bản. Sửa metadata giữ nguyên đường dẫn đã cấp. |
| PDF và ảnh bìa | Tải PDF tối đa 60 MB; tạo bìa từ trang đầu; đếm trang; đọc tài liệu tại chỗ. Thay PDF yêu cầu số ở trạng thái nháp và đặt các bài về chưa hiệu đính. |
| Mục lục | Tạo chuyên mục; thêm bài viết, tác giả; chọn chuyên mục; tìm bài và lọc tình trạng hiệu đính. |
| Biên tập bài | Sửa tiêu đề, tác giả, tóm tắt, toàn văn HTML; đổi chuyên mục; sửa riêng khoảng trang in và trang PDF; đối chiếu bản trích xuất với PDF. |
| Xuất bản | Danh sách kiểm tra PDF, chuyên mục, bài viết, khoảng trang; xác nhận trước khi công bố; công bố các bài nháp mới; xem trang công khai. |
| Thu hồi | Chỉ quản trị viên được chuyển số và bài viết về bản nháp. Dữ liệu giữ nguyên; không thu hồi file đã tải hoặc chặn đường dẫn file trực tiếp. |
| Nhập tự động | Tải PDF để nhận diện số và mục lục; tự cập nhật tiến trình mỗi 5 giây khi có tác vụ chờ/chạy; mở kết quả để kiểm tra. |

## Luồng tạo mới đề xuất

1. Chọn **Tạo đặc san** và nhập thông tin phát hành. Hệ thống lưu bản nháp.
2. Đính kèm PDF. Kiểm tra bìa và số trang được nhận diện.
3. Tạo chuyên mục và bài viết. Trang in là số trên ấn phẩm; trang PDF là vị trí thực trong file, bắt đầu từ 1.
4. Đối chiếu mục lục, toàn văn và khoảng trang. Quản trị viên xác nhận danh sách kiểm tra rồi xuất bản.

Bài chưa hiệu đính vẫn được công bố tiêu đề và liên kết PDF; toàn văn chỉ hiển thị khi được xác nhận. Sửa bài đã xuất bản có hiệu lực ngay khi lưu, vì hệ thống chưa có phiên bản biên tập độc lập.

Nếu PDF có cấu trúc phù hợp bộ nhận diện hiện tại, có thể chọn **Nhập PDF tự động** ngay từ đầu, không tạo số thủ công trước. PDF scan hoặc mục lục khác mẫu có thể cần nhập thủ công. Tác vụ nhập cần backend, Redis và worker hoạt động.

## Các chức năng nên triển khai tiếp

- Đổi tên, sắp xếp và xóa chuyên mục/bài viết với kiểm tra liên kết, xác nhận và khả năng khôi phục.
- Trình soạn thảo trực quan và quản lý hình ảnh trong bài.
- Quy trình gửi duyệt, trả bài, phân công và lịch sử phiên bản trước khi thay nội dung đang công khai.
- Quản lý tài khoản, trạng thái tài khoản và nhật ký thao tác trên giao diện.
- Ảnh bìa tùy chỉnh, lịch xuất bản và OCR cho PDF scan.

Các mục trên là phần mở rộng đề xuất, chưa phải chức năng đã triển khai trong lần chỉnh sửa này. Không cần thay đổi cấu trúc bảng hay chạy migration cho các thay đổi hiện tại.
