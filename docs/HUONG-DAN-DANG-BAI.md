# Hướng dẫn đăng số đặc san và mục lục lên website

Dành cho biên tập viên. Mọi thao tác thực hiện tại trang quản trị: **`https://<tên-miền>/admin`**.

## 1. Đăng nhập

1. Mở `/admin`, nhập email và mật khẩu do quản trị viên cấp.
2. Đăng nhập xong, menu bên trái có các nhóm: **Nội dung** (Số đặc san, Bài gửi, Chuyên mục, Trang nội dung), **Truyền thông** (Hoạt động, Loại hoạt động, Tư liệu), **Báo cáo** (Thống kê) và **Hệ thống** (Giao diện, Người dùng, Cấu hình site, Đăng ký email, Hộp thư đi, Sao lưu và bảo mật tệp, Nhật ký hoạt động). Mỗi người chỉ thấy các mục đúng với vai trò của mình (xem mục 8).
3. Hết phiên (khoảng 12 giờ) hoặc đăng nhập sai nhiều lần sẽ bị yêu cầu thử lại sau. Dùng nút **Đăng xuất** khi xong việc.
4. **Quên mật khẩu?** ở màn hình đăng nhập: nhập email, hệ thống gửi liên kết đặt mật khẩu mới (hiệu lực 60 phút, dùng một lần).
5. **Đăng ký tài khoản** ở màn hình đăng nhập: cộng tác viên tự đăng ký (họ tên, email, mật khẩu, đơn vị). Tài khoản ở trạng thái *Chờ duyệt* cho tới khi quản trị viên duyệt (xem mục 8); khi được duyệt, người đăng ký nhận email báo.

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
| Tệp PDF | Chọn tệp PDF bản in (tối đa 50MB) |
| Số trang | Ví dụ `136` |
| Công bố trên website | **Chỉ đánh dấu khi đã sẵn sàng công bố.** Chưa đánh dấu thì số và mục lục của số không hiện ra ngoài |

Bấm **Lưu**. Nếu bìa/PDF chưa có, có thể bổ sung sau bằng nút **Sửa**.

### Bước 1b. Tạo mục lục tự động từ tệp PDF (khuyến nghị)
Sau khi đã tải **Tệp PDF** lên cho số đặc san:

1. Ở thẻ **Số đặc san**, bấm **Mục lục** ở dòng của số đó, rồi bấm **Tạo mục lục từ PDF**.
2. Hệ thống đọc mục lục trong PDF (ưu tiên bookmark của PDF, nếu không có thì đọc trang "Mục lục" dạng chữ) và hiện bảng đề xuất: chuyên mục, tác giả, tiêu đề, số trang.
3. **Kiểm tra và sửa trực tiếp trong bảng** (tác giả in hoa được tự đổi thành chữ thường đầu từ; tiêu đề nhiều dòng được nối lại). Bỏ đánh dấu các dòng không muốn thêm.
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
| Thuộc "Trang đầu số" | Đánh dấu cho các mục như "Lời thưa", "Lãnh đạo Ban chấp hành". Chúng hiện ở khung "Trang đầu số" |
| Lời dẫn, Toàn văn | **Tùy chọn.** Có toàn văn thì người đọc đọc được trên web (xem mục 3). Để trống = chỉ có bản in |
| Hiện ở mục Nghiên cứu – Trao đổi | Đánh dấu nếu muốn dòng này xuất hiện ở trang Nghiên cứu – Trao đổi |
| Hiện ở slide trang chủ + Đoạn trích | Đánh dấu để dòng này nổi bật ở đầu trang chủ (nên chọn 4–6 dòng) |

Mục lục **hiện ra ngoài khi số đặc san được đánh dấu “Công bố trên website”**. Không có trạng thái nháp riêng cho từng dòng.

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

- **Hoạt động** (trang chủ, khối "Tin hoạt động", và trang Tin hoạt động): tiêu đề, loại, ngày, nội dung (có *Nhập từ Word*), tệp đính kèm, liên kết tới bài gốc. Bỏ đánh dấu *Hiển thị* để ẩn.
- **Tư liệu** (trang Tư liệu): quy định, biểu mẫu. Tải tệp lên ở ô *Tệp*; chưa có tệp thì mục hiện "Chưa có tệp". *Thứ tự* nhỏ hiện trước.
- **Cấu hình site**: nội dung chân trang. Khóa gồm `org_name`, `issn`, `contact`, `license`, `copyright`, `publisher` (chịu trách nhiệm xuất bản), `editors` (biên tập; mỗi dòng một tên). Sửa giá trị, không đổi tên khóa.
- **Đăng ký email**: danh sách người đăng ký nhận tin. Người đăng ký phải bấm liên kết trong email xác nhận (cột *Đã xác nhận*); chỉ người đã xác nhận mới nhận thư báo số mới. Mỗi thư có liên kết để người nhận tự hủy đăng ký.
- **Thư báo số mới (tự động)**: khi một số được đánh dấu **Công bố trên website** lần đầu, hệ thống tự gửi mỗi người đã xác nhận đăng ký nhận tin một thư báo số mới (tên số, giới thiệu, danh sách bài, liên kết đọc). Trước khi công bố, trang quản trị hỏi xác nhận. Mỗi số chỉ gửi một lần: sửa số, hoặc bỏ công bố rồi công bố lại, không gửi thêm. Vì vậy nên nhập xong mục lục rồi mới công bố. Kết quả gửi xem ở **Hộp thư đi**.
- **Hộp thư đi** (quản trị viên): mọi email hệ thống gửi (đặt lại mật khẩu, báo đăng ký tài khoản, duyệt tài khoản, xác nhận nhận tin, thư báo số mới), kèm trạng thái *Đã gửi / Gửi lỗi / Chưa cấu hình SMTP*, nội dung thư, nút **Gửi lại** và ô **Gửi thư thử**. Chưa cấu hình máy chủ gửi thư (SMTP) thì thư vẫn được lưu ở đây để xem và gửi tay.
- **Trang nội dung** (quản trị viên, biên tập viên): các trang Giới thiệu, Ban biên tập, Hỏi đáp… hiện tại `/trang/<đường dẫn>` và ở cột "Thông tin" dưới chân trang. Soạn bằng ô nội dung (có *Nhập từ Word*); Hỏi đáp nên để mỗi câu hỏi là một Đề mục. Bỏ đánh dấu *Hiển thị* để ẩn trang.
- **Giao diện › Banner trang chủ** (quản trị viên):
  - *Danh sách banner*: mỗi banner có ảnh, **vị trí** (đầu trang, dưới Tiêu điểm, trên Chuyên mục, trên Tin hoạt động, trên Kho lưu trữ, cuối trang), thứ tự, liên kết khi bấm (tùy chọn), mô tả ảnh. Các banner **cùng vị trí tự chạy thành slider** (có nút ‹ ›, vuốt được trên điện thoại, tự dừng khi rê chuột vào); một banner thì hiện ảnh tĩnh. Bỏ đánh dấu *Hiển thị* để ẩn tạm.
  - *Cấu hình theo vị trí*: **Hiển thị** (bỏ đánh dấu để tạm ẩn cả vị trí, mọi banner ở đó không hiện nhưng vẫn giữ nguyên; bấm *Lưu cấu hình vị trí*), chiều cao trên máy tính và điện thoại, độ rộng (theo khung nội dung hoặc tràn màn hình), cách hiện ảnh (cắt cho vừa khung hoặc hiện đủ ảnh), thời gian tự chuyển. Nên dùng ảnh cùng tỉ lệ với khung để không bị cắt mất chữ.
- **Giao diện › Menu điều hướng** (quản trị viên): thêm, đổi tên, sắp thứ tự, xóa các mục trên thanh menu. Có thể chọn nhanh các Trang nội dung, hoặc nhập liên kết tới trang web bên ngoài (`https://…`, mở ở tab mới). Bỏ đánh dấu cột *Hiển thị* để tạm ẩn một mục khỏi website mà vẫn giữ trong danh sách (cần ít nhất một mục đang hiển thị). *Dùng menu mặc định* để trở về menu ban đầu.
- **Báo cáo › Thống kê** (quản trị viên, biên tập viên): chọn kỳ (7 ngày, 30 ngày, 90 ngày, năm nay, 12 tháng hoặc tự chọn từ ngày–đến ngày).
  - *Bài gửi*: số bài nhận được, tỷ lệ chấp nhận (trên số bài đã có quyết định Chấp nhận/Từ chối), thời gian trung bình đến quyết định, thời gian phản hồi đầu tiên, số bài theo trạng thái và theo tháng.
  - *Lượt xem và lượt tải*: lượt xem trang (mục lục số và trang bài), lượt đọc PDF, lượt tải PDF; biểu đồ theo ngày (rê chuột để xem số, hoặc bấm *Xem bảng số liệu*); bài và số được xem nhiều nhất. Không tính máy tìm kiếm, số chưa công bố và lượt lặp lại của cùng người đọc trong 30 phút.
  - **Xuất Excel**: tải tệp .xlsx của kỳ đang chọn, gồm các sheet Tổng quan, Bài gửi theo tháng / theo trạng thái, danh sách Bài gửi, Lượt theo bài, Lượt theo số, Lượt theo ngày.
- **Sao lưu và bảo mật tệp** (quản trị viên): thời điểm và kết quả bản sao lưu gần nhất (tự chạy mỗi đêm), nút **Sao lưu ngay**, danh sách bản sao lưu với nút **Tải về**; trạng thái máy quét mã độc. Tệp tải lên có mã độc sẽ bị chặn và ghi vào Nhật ký. Hãy định kỳ tải một bản sao lưu về lưu ở nơi khác. Hướng dẫn khôi phục cho người quản trị máy chủ: `docs/SAO-LUU.md`.
- **Nhật ký hoạt động** (quản trị viên): mọi thao tác thêm, sửa, xóa trong trang quản trị và các lần đăng nhập (kể cả đăng nhập sai), kèm người thực hiện, thời điểm, IP. Lọc theo đối tượng, thao tác, người, ngày, từ khóa.

## 5. Sửa, ẩn và xóa

- **Sửa**: bấm *Sửa* ở dòng tương ứng, chỉnh rồi *Lưu*.
- **Ẩn tạm cả số và mục lục**: bỏ đánh dấu *Công bố trên website* của số (không mất dữ liệu).
- **Xóa**: nút *Xóa* sẽ xóa vĩnh viễn, không hoàn tác. **Xóa một số đặc san sẽ xóa luôn toàn bộ mục lục của số đó.** Muốn gỡ tạm, hãy bỏ đánh dấu *Công bố trên website* thay vì xóa.
- Ô **Lọc nhanh** phía trên bảng giúp tìm theo tiêu đề, tác giả, số…

## 6. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Đã lưu mục lục nhưng không thấy trên web | **Số đặc san chưa đánh dấu Công bố trên website** |
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
- [ ] Các mục "Lời thưa", "Lãnh đạo…" đã đánh dấu *Trang đầu số*
- [ ] Chọn 4–6 dòng nổi bật cho slide và điền đoạn trích
- [ ] Bấm **Xem trước** ở dòng số đặc san để xem số chưa công bố đúng như người đọc sẽ thấy (mục lục, trang bài, PDF; liên kết có hiệu lực 2 giờ, đầu trang có dải vàng "Bản xem trước")
- [ ] Cuối cùng mới đánh dấu **Công bố trên website** cho số (lần công bố đầu tiên sẽ tự gửi thư báo số mới tới người đăng ký nhận tin)

## 8. Người dùng và phân quyền (dành cho quản trị viên)

Thẻ **Người dùng** → **Thêm người dùng**: nhập email đăng nhập, họ tên, vai trò và mật khẩu (tối thiểu 8 ký tự), rồi gửi thông tin đăng nhập cho người đó. Người dùng tự đổi mật khẩu bằng nút **Đổi mật khẩu** ở đầu trang quản trị.

| Vai trò | Được làm gì |
|---|---|
| **Quản trị viên** | Toàn quyền: gồm quản lý người dùng, cấu hình site, danh sách đăng ký email, xóa bài gửi |
| **Biên tập viên** | Số đặc san (tạo, sửa, **công bố**, xóa), mục lục, chuyên mục, hoạt động, thông báo, tư liệu, tạo mục lục từ PDF, **xử lý bài gửi** |
| **Cộng tác viên** | Chỉ **nhập/sửa mục lục và toàn văn của số chưa công bố**. Không công bố số, không tạo/xóa số, không xóa dòng mục lục, không xem bài gửi |

Quy trình gợi ý: cộng tác viên nhập mục lục và toàn văn khi số còn ở trạng thái chưa công bố, biên tập viên kiểm tra rồi đánh dấu **Công bố trên website**. Sau khi số đã công bố, cộng tác viên không sửa được nữa.

- Đổi vai trò hoặc **khóa tài khoản** (bỏ đánh dấu *Đang hoạt động*) có hiệu lực **ngay lập tức**, kể cả khi người đó đang đăng nhập.
- Quên mật khẩu: người dùng tự bấm **Quên mật khẩu?** ở màn hình đăng nhập (cần đã cấu hình email), hoặc quản trị viên mở **Sửa** người dùng và nhập mật khẩu mới (để trống ô mật khẩu = giữ nguyên).
- **Duyệt tài khoản tự đăng ký**: số cạnh mục *Người dùng* là số tài khoản *Chờ duyệt* (quản trị viên cũng nhận email báo). Mở **Sửa**, kiểm tra thông tin, chọn vai trò, đánh dấu **Đang hoạt động** rồi Lưu: tài khoản được duyệt và người đăng ký nhận email. Không hợp lệ thì **Xóa**.
- Hệ thống không cho tự xóa/tự hạ quyền/tự khóa mình, và luôn giữ ít nhất một quản trị viên đang hoạt động.

## 9. Bài gửi từ tác giả

Người ngoài gửi bản thảo tại trang **/gui-bai** (nút **Gửi bài** trên thanh menu), không cần tài khoản: họ điền họ tên, email, tiêu đề, tóm tắt, chọn chuyên mục đề xuất, tải bản thảo (Word, PDF hoặc .odt, tối đa 20MB) và đánh dấu cam kết bản quyền. Sau khi gửi, tác giả nhận một **mã tra cứu** 8 ký tự và dùng mã cùng email để xem tình trạng tại **/gui-bai/theo-doi**.

Ban biên tập xử lý ở thẻ **Bài gửi** (quản trị viên và biên tập viên):
1. Bấm **Xử lý** ở dòng bài gửi để xem thông tin tác giả, tóm tắt và **tải bản thảo**.
2. Đổi trạng thái bằng nút **Quyết định biên tập**: chọn quyết định và nhập **ghi chú (bắt buộc)**. Thứ tự xử lý: Mới nhận → Đang xét duyệt → Phân công phản biện → Chấp nhận / Yêu cầu sửa / Từ chối → Đã nhận đăng. Hộp thoại chỉ hiện các bước được phép từ trạng thái hiện tại.
3. Thẻ **Phản biện**: bấm **+ Phân công phản biện**, nhập họ tên, email và hạn. Hệ thống tạo một **liên kết phản biện** và chỉ hiện liên kết này một lần: hãy sao chép và gửi cho phản biện viên (hệ thống chưa tự gửi email). Mất liên kết thì bấm **Liên kết mới** (liên kết cũ hết hiệu lực). **Nhắc hạn** ghi nhận lần nhắc; việc liên hệ phản biện viên vẫn làm thủ công. Khi phản biện viên nộp phiếu, bấm **Xem phiếu** để đọc khuyến nghị (Chấp nhận đăng / Sửa nhỏ / Sửa lớn / Từ chối) và nhận xét.
4. Phản biện viên mở liên kết, nhận hoặc từ chối phản biện, tải bản thảo và nộp phiếu. Họ không cần tài khoản và không thấy thông tin tác giả.
5. Thẻ **Lịch sử**: mọi lần đổi trạng thái, phân công, nhắc hạn, nộp phiếu, kèm thời điểm, người thực hiện và ghi chú.
6. Viết **Phản hồi gửi tác giả** (tác giả thấy khi tra cứu) và **Ghi chú nội bộ** (chỉ ban biên tập thấy) ở thẻ **Thông tin**.
7. Bài **Đã nhận đăng**: ở thẻ **Thông tin**, bấm **Đưa vào mục lục**, chọn một số **chưa công bố**, chuyên mục (tự chọn sẵn nếu trùng tên chuyên mục tác giả đề xuất) và số trang (có thể để trống). Hệ thống tạo sẵn dòng mục lục với tiêu đề và tên tác giả, ghi vào lịch sử bài. Sau đó liên hệ tác giả lấy bản cuối, vào mục lục của số để bổ sung số trang, tóm tắt, toàn văn (Bước 3). Bài chỉ hiện trên trang công khai khi số được công bố. Mỗi bài chỉ đưa vào mục lục một lần; nếu xóa dòng mục lục đó thì nút xuất hiện lại.

Lưu ý: hệ thống **chưa tự gửi email** cho tác giả; hãy liên hệ qua email trong thông tin bài gửi hoặc nhắn tác giả vào trang tra cứu. Bản thảo được lưu riêng, không có đường dẫn công khai, chỉ người có quyền tải được. Xóa bài gửi (chỉ quản trị viên) sẽ xóa cả bản thảo.

