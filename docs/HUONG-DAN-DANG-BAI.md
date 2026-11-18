# Hướng dẫn đăng số đặc san và mục lục lên website

Dành cho biên tập viên. Mọi thao tác thực hiện tại trang quản trị: **`https://<tên-miền>/admin`**.

## 1. Đăng nhập

1. Mở `/admin`, nhập email và mật khẩu do quản trị viên cấp.
2. Đăng nhập xong sẽ thấy các thẻ: **Số đặc san, Bài gửi, Chuyên mục, Hoạt động, Thông báo, Tư liệu, Người dùng, Cấu hình site, Đăng ký email** (mỗi người chỉ thấy các thẻ đúng với vai trò của mình, xem mục 8).
3. Hết phiên (khoảng 12 giờ) hoặc đăng nhập sai quá 8 lần sẽ bị yêu cầu thử lại sau. Dùng nút **Đăng xuất** khi xong việc.

## 2. Quy trình đăng một số mới (làm theo thứ tự)

Mô hình: một **số đặc san** có một **mục lục** gồm nhiều dòng (chuyên mục, tác giả, tiêu đề, trang in). Mục lục được quản lý ngay trong số đặc san, không có mục “Bài viết” riêng. Dòng nào có thêm **toàn văn** thì người đọc đọc được trên web; không thì hiện “chỉ có trong bản in”.

### Bước 1. Thêm số đặc san mới
Vào thẻ **Số đặc san** → **+ Thêm số đặc san mới**:

| Ô | Điền gì |
|---|---|
| Số đặc san * | Số thứ tự, ví dụ `18` (không được trùng số đã có) |
| Ngày đăng * | Ngày công bố số. Hệ thống tự tạo nhãn hiển thị từ hai ô này, ví dụ `Số 18 (8-2026)` |
| Chủ đề * | Chủ đề chính của số |
| Giới thiệu | 2–3 câu mô tả số |
| Ảnh bìa | Chọn tệp ảnh (jpg, png, webp) |
| File PDF | Chọn tệp PDF bản in (tối đa 50MB) |
| Số trang | Ví dụ `136` |
| Công bố trên website | **Chỉ tick khi đã sẵn sàng công bố.** Chưa tick thì số và mục lục của số không hiện ra ngoài |

Bấm **Lưu**. Nếu bìa/PDF chưa có, có thể bổ sung sau bằng nút **Sửa**.

### Bước 1b. Tạo mục lục tự động từ file PDF (khuyến nghị)
Sau khi đã tải **File PDF** lên cho số đặc san:

1. Ở thẻ **Số đặc san**, bấm **Mục lục** ở dòng của số đó, rồi bấm **Tạo mục lục từ PDF**.
2. Hệ thống đọc mục lục trong PDF (ưu tiên bookmark của PDF, nếu không có thì đọc trang "Mục lục" dạng chữ) và hiện bảng đề xuất: chuyên mục, tác giả, tiêu đề, số trang.
3. **Kiểm tra và sửa trực tiếp trong bảng** (tác giả in hoa được tự đổi thành chữ thường đầu từ; tiêu đề nhiều dòng được nối lại). Bỏ tick các dòng không muốn thêm.
4. Bấm **Thêm … dòng vào mục lục**. Chuyên mục chưa có sẽ được tạo mới; tên chuyên mục khớp với chuyên mục đã có (không phân biệt dấu) thì dùng lại.

Lưu ý: chức năng chỉ lấy **mục lục**, không lấy nội dung bài. Bấm lại lần nữa không tạo trùng các dòng đã có. Nếu báo "Không nhận diện được mục lục" thì PDF không có bookmark và trang mục lục không đúng dạng dòng "Tiêu đề … số trang"; khi đó hãy nhập từng dòng ở Bước 3.

### Bước 2. Kiểm tra chuyên mục
Thẻ **Chuyên mục** liệt kê các chuyên mục và thứ tự hiển thị (số nhỏ hiện trước). Thêm chuyên mục mới nếu cần, ví dụ "Khoa học đời sống".

### Bước 3. Chỉnh mục lục của số
Ở thẻ **Số đặc san**, bấm **Mục lục** ở dòng của số đó. Tại đây bạn có thể **+ Thêm dòng mục lục**, **Sửa**, **Xóa** từng dòng:

| Ô | Điền gì |
|---|---|
| Thứ tự | Số thứ tự theo mục lục bản in: 0, 1, 2… (số nhỏ hiện trước) |
| Chuyên mục | Chọn chuyên mục |
| Tác giả | Tên tác giả như bản in |
| Tiêu đề * | Tiêu đề trong mục lục |
| Trang in | Ví dụ `tr. 13` (giữ đúng dạng "tr. số") |
| Thuộc "Trang đầu số" | Tick cho các mục như "Lời thưa", "Lãnh đạo Ban chấp hành". Chúng hiện ở khung "Trang đầu số" |
| Lời dẫn, Toàn văn | **Tùy chọn.** Có toàn văn thì người đọc đọc được trên web (xem mục 3). Để trống = chỉ có bản in |
| Hiện ở mục Nghiên cứu – Trao đổi | Tick nếu muốn dòng này xuất hiện ở trang Nghiên cứu – Trao đổi |
| Hiện ở slide trang chủ + Đoạn trích | Tick để dòng này nổi bật ở đầu trang chủ (nên chọn 4–6 dòng) |

Mục lục **hiện ra ngoài khi số đặc san được tick “Công bố trên website”**. Không có trạng thái nháp riêng cho từng dòng.

## 3. Cách viết ô "Toàn văn" (tùy chọn)

Chỉ dùng 3 quy tắc:

```
Đoạn mở đầu viết bình thường.

Đoạn thứ hai: cách đoạn trước đúng MỘT dòng trống.

## Tên đề mục

Nội dung dưới đề mục.

![Chú thích ảnh](/media/ten-anh.jpg)
```

- **Đoạn văn**: cách nhau bằng một dòng trống. Không cần gõ xuống dòng giữa đoạn.
- **Đề mục**: dòng bắt đầu bằng `## ` (hai dấu thăng rồi dấu cách). Các đề mục tự thành mục lục bên trái bài.
- **Ảnh**: `![chú thích](đường-dẫn-ảnh)` trên một dòng riêng. Đường dẫn bắt đầu bằng `/media/` hoặc `https://`.
- Chưa hỗ trợ in đậm, in nghiêng, liên kết, bảng, danh sách. Nếu dán từ Word, hãy dán dạng văn bản thuần rồi chèn lại đề mục.
- Mẹo: soạn trước ở Word/Notepad rồi dán vào, tránh mất nội dung nếu trình duyệt tải lại.

### Lấy đường dẫn cho ảnh trong bài
Hệ thống chưa có thư viện ảnh riêng. Cách làm hiện tại:
1. Mở một biểu mẫu có ô tải tệp (ví dụ **Tư liệu → + Thêm mới → ô Tệp**), chọn ảnh.
2. Ô bên cạnh sẽ hiện đường dẫn dạng `/media/xxxx.jpg`. Sao chép nó.
3. Bấm **Hủy** (không cần lưu), quay lại bài và dán vào cú pháp ảnh ở trên.

Tệp được phép tải lên: jpg, jpeg, png, webp, pdf, doc, docx, xls, xlsx, tối đa 50MB.

## 4. Các nội dung khác

- **Hoạt động** (trang chủ, mục "Hoạt động nổi bật"): tiêu đề, loại, ngày, liên kết tới bài gốc. Bỏ tick *Hiển thị* để ẩn.
- **Thông báo** (trang Đặc san, khung "Thông báo của tòa soạn"): nhãn (THƯ MỜI, HỘI THI…), tiêu đề, ngày.
- **Tư liệu** (trang Tư liệu): quy định, biểu mẫu. Tải tệp lên ở ô *Tệp*; chưa có tệp thì mục hiện "Chưa có tệp". *Thứ tự* nhỏ hiện trước.
- **Cấu hình site**: nội dung chân trang. Khóa gồm `org_name`, `issn`, `leaders`, `contact`, `license`, `copyright`. Sửa giá trị, không đổi tên khóa.
- **Đăng ký email**: danh sách người đăng ký nhận thông báo. Hiện hệ thống chỉ lưu email, chưa tự gửi thư.

## 5. Sửa, ẩn và xóa

- **Sửa**: bấm *Sửa* ở dòng tương ứng, chỉnh rồi *Lưu*.
- **Ẩn tạm cả số và mục lục**: bỏ tick *Công bố trên website* của số (không mất dữ liệu).
- **Xóa**: nút *Xóa* sẽ xóa vĩnh viễn, không hoàn tác. **Xóa một số đặc san sẽ xóa luôn toàn bộ mục lục của số đó.** Muốn gỡ tạm, hãy bỏ tick *Công bố trên website* thay vì xóa.
- Ô **Lọc nhanh** phía trên bảng giúp tìm theo tiêu đề, tác giả, số…

## 6. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Đã lưu mục lục nhưng không thấy trên web | **Số đặc san chưa tick Công bố trên website** |
| Báo "Dữ liệu trùng hoặc tham chiếu không hợp lệ" | Số đặc san bị trùng số thứ tự, hoặc tên chuyên mục bị trùng |
| Báo "Thiếu trường: …" | Chưa điền ô có dấu `*` |
| Bài hiện "Chưa có toàn văn" | Ô *Toàn văn* đang để trống |
| Đề mục không thành chữ lớn | Thiếu dấu cách sau `##`, hoặc `##` không nằm đầu dòng |
| Ảnh trong toàn văn không hiện | Đường dẫn sai hoặc không bắt đầu bằng `/media/` hay `https://` |
| Báo "Định dạng không được phép" / "Tệp vượt quá 50MB" | Nén bớt PDF hoặc đổi sang định dạng được phép |
| Bị đẩy ra màn hình đăng nhập | Phiên hết hạn, đăng nhập lại (nội dung chưa lưu sẽ mất) |

## 7. Danh sách kiểm tra trước khi công bố một số

- [ ] Số đặc san có ngày đăng, bìa, PDF, số trang, chủ đề đúng
- [ ] Mọi dòng mục lục đúng chuyên mục, *Thứ tự* và *Trang in* khớp bản in
- [ ] Các mục "Lời thưa", "Lãnh đạo…" đã tick *Trang đầu số*
- [ ] Chọn 4–6 dòng nổi bật cho slide và điền đoạn trích
- [ ] Đã mở thử trang bài, mục lục số và tìm kiếm
- [ ] Cuối cùng mới tick **Công bố trên website** cho số

## 8. Người dùng và phân quyền (dành cho quản trị viên)

Thẻ **Người dùng** → **Thêm người dùng**: nhập email đăng nhập, họ tên, vai trò và mật khẩu (tối thiểu 8 ký tự), rồi gửi thông tin đăng nhập cho người đó. Người dùng tự đổi mật khẩu bằng nút **Đổi mật khẩu** ở đầu trang quản trị.

| Vai trò | Được làm gì |
|---|---|
| **Quản trị viên** | Toàn quyền: gồm quản lý người dùng, cấu hình site, danh sách đăng ký email, xóa bài gửi |
| **Biên tập viên** | Số đặc san (tạo, sửa, **công bố**, xóa), mục lục, chuyên mục, hoạt động, thông báo, tư liệu, tạo mục lục từ PDF, **xử lý bài gửi** |
| **Cộng tác viên** | Chỉ **nhập/sửa mục lục và toàn văn của số chưa công bố**. Không công bố số, không tạo/xóa số, không xóa dòng mục lục, không xem bài gửi |

Quy trình gợi ý: cộng tác viên nhập mục lục và toàn văn khi số còn ở trạng thái chưa công bố, biên tập viên kiểm tra rồi tick **Công bố trên website**. Sau khi số đã công bố, cộng tác viên không sửa được nữa.

- Đổi vai trò hoặc **khóa tài khoản** (bỏ tick *Đang hoạt động*) có hiệu lực **ngay lập tức**, kể cả khi người đó đang đăng nhập.
- Quên mật khẩu: quản trị viên mở **Sửa** người dùng và nhập mật khẩu mới (để trống ô mật khẩu = giữ nguyên).
- Hệ thống không cho tự xóa/tự hạ quyền/tự khóa mình, và luôn giữ ít nhất một quản trị viên đang hoạt động.

## 9. Bài gửi từ tác giả

Người ngoài gửi bản thảo tại trang **/gui-bai** (nút "Gửi bài ngay" ở trang chủ), không cần tài khoản: họ điền họ tên, email, tiêu đề, tóm tắt, chọn chuyên mục đề xuất, tải bản thảo (Word, PDF hoặc .odt, tối đa 20MB) và tick cam kết bản quyền. Sau khi gửi, tác giả nhận một **mã tra cứu** 8 ký tự và dùng mã cùng email để xem tình trạng tại **/gui-bai/theo-doi**.

Ban biên tập xử lý ở thẻ **Bài gửi** (quản trị viên và biên tập viên):
1. Bấm **Xử lý** ở dòng bài gửi để xem thông tin tác giả, tóm tắt và **tải bản thảo**.
2. Đổi **trạng thái**: Mới nhận → Đang xét duyệt → Cần chỉnh sửa → Đã nhận đăng / Không phù hợp.
3. Viết **Phản hồi gửi tác giả** (tác giả thấy khi tra cứu) và **Ghi chú nội bộ** (chỉ ban biên tập thấy).
4. Bài được nhận đăng: liên hệ tác giả qua email, rồi nhập vào mục lục của số tương ứng (Bước 3).

Lưu ý: hệ thống **chưa tự gửi email** cho tác giả; hãy liên hệ qua email trong thông tin bài gửi hoặc nhắn tác giả vào trang tra cứu. Bản thảo được lưu riêng, không có đường dẫn công khai, chỉ người có quyền tải được. Xóa bài gửi (chỉ quản trị viên) sẽ xóa cả bản thảo.

