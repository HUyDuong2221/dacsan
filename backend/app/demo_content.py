"""NỘI DUNG MẪU (giả định) để xem giao diện trên máy dev/staging.

Toàn bộ bài viết, tác giả và số liệu trong file này là do nhóm phát triển tự soạn để minh họa bố cục,
KHÔNG phải bài thật đã đăng trên Đặc san và không trích từ ấn phẩm nào khác. Chỉ được nạp bởi seed()
khi DB còn trống và SEED_DEMO=true. Không dùng trên site thật.
"""

# Chuyên mục của số (Issue.theme = Field.name): khối "Chuyên mục" ở trang chủ lọc theo các tên này.
ISSUE_FIELDS = [
    "Khoa học – Công nghệ",
    "Chuyển đổi số",
    "Đổi mới sáng tạo",
    "Môi trường – Phát triển bền vững",
    "Giáo dục – Nhân lực",
    "Y tế – Cộng đồng",
]

# Chuyên mục bài trong mục lục (TocEntry.field_id), dùng thêm cho các số mẫu.
SECTION_RESEARCH = "Nghiên cứu – Trao đổi"
SECTION_LIFE = "Khoa học & Đời sống"
EXTRA_SECTIONS = [SECTION_RESEARCH, SECTION_LIFE]

# số -> (chuyên mục của số, tên số, giới thiệu)
ISSUE_META = {
    16: ("Khoa học – Công nghệ", "Khoa học công nghệ phục vụ tăng trưởng hai con số",
         "Các góc nhìn về vai trò của khoa học công nghệ trong mục tiêu tăng trưởng cao: năng suất, dữ liệu, thể chế thử nghiệm và nguồn lực xã hội cho nghiên cứu."),
    15: ("Chuyển đổi số", "Chuyển đổi số trong quản trị đô thị",
         "Từ trung tâm điều hành thông minh đến dữ liệu mở: những bài học triển khai, giới hạn kỹ thuật và điều kiện để chính quyền số phục vụ người dân tốt hơn."),
    14: ("Giáo dục – Nhân lực", "Nguồn nhân lực chất lượng cao cho công nghệ",
         "Đào tạo kỹ sư bán dẫn, AI và dữ liệu: liên kết nhà trường – doanh nghiệp, học tập suốt đời và chính sách thu hút chuyên gia."),
    13: ("Môi trường – Phát triển bền vững", "Môi trường và phát triển bền vững vùng ven biển",
         "Xói lở bờ biển, chất lượng nước vịnh và đô thị thích ứng khí hậu: dữ liệu quan trắc và các giải pháp dựa vào thiên nhiên."),
    12: ("Đổi mới sáng tạo", "Đổi mới sáng tạo trong doanh nghiệp địa phương", ""),
    11: ("Y tế – Cộng đồng", "Y tế cơ sở và sức khỏe cộng đồng", ""),
    10: ("Khoa học – Công nghệ", "Khoa học công nghệ với nông nghiệp đô thị", ""),
    9: ("Chuyển đổi số", "Hạ tầng dữ liệu và chính quyền số", ""),
    8: ("Giáo dục – Nhân lực", "Trí thức xứ Quảng với sự nghiệp phát triển", ""),
    7: ("Môi trường – Phát triển bền vững", "Bảo tồn đa dạng sinh học bán đảo Sơn Trà", ""),
    6: ("Giáo dục – Nhân lực", "Giáo dục và đào tạo nhân lực kỹ thuật", ""),
    5: ("Môi trường – Phát triển bền vững", "Năng lượng tái tạo cho đô thị ven biển", ""),
}

R, L, N, T = SECTION_RESEARCH, SECTION_LIFE, "Nhân vật", "Thông tin"

# số -> danh sách (chuyên mục bài, tác giả, tiêu đề, trang, khóa toàn văn | None)
TOC = {
    16: [
        (None, "Ban Biên tập", "Lời tòa soạn", "3", None),
        (R, "TS. Trần Minh Khoa", "Năng suất các nhân tố tổng hợp: thước đo đúng cho đóng góp của khoa học công nghệ", "5", "tfp"),
        (R, "ThS. Lê Thu Hà", "Cơ chế thử nghiệm có kiểm soát (sandbox) cho công nghệ mới ở cấp thành phố", "14", "sandbox"),
        (R, "PGS.TS. Nguyễn Quốc Bảo", "Từ đề tài nghiên cứu đến sản phẩm thương mại: những nút thắt trong khâu chuyển giao", "22", None),
        (R, "KS. Phạm Đức Long", "Ứng dụng thị giác máy tính trong kiểm tra chất lượng sản phẩm cơ khí", "31", None),
        (L, "Hoàng Anh", "Phòng thí nghiệm mở cho học sinh: khi khoa học bước ra khỏi sách giáo khoa", "40", None),
        (N, "Minh Châu", "Người kỹ sư 30 năm gắn bó với lưới điện thông minh", "47", None),
        (T, "P.V", "Thông tin khoa học công nghệ trong nước và quốc tế", "54", None),
    ],
    15: [
        (None, "Ban Biên tập", "Lời tòa soạn", "3", None),
        (R, "TS. Đỗ Hoàng Nam", "Trung tâm điều hành đô thị thông minh: từ màn hình giám sát đến ra quyết định dựa trên dữ liệu", "5", "ioc"),
        (R, "ThS. Vũ Thị Lan", "Dữ liệu mở của chính quyền: cần gì để doanh nghiệp thực sự sử dụng?", "15", "opendata"),
        (R, "TS. Ngô Văn Thành", "An toàn thông tin cho hệ thống dịch vụ công trực tuyến cấp phường", "24", None),
        (R, "KS. Trịnh Bảo Ngọc", "Bản đồ số ngập lụt đô thị từ dữ liệu cảm biến và phản ánh của người dân", "33", None),
        (L, "Thanh Tâm", "Người cao tuổi và khoảng cách số: những lớp học điện thoại thông minh ở khu dân cư", "41", None),
        (T, "P.V", "Chuyển đổi số: điểm tin hai tháng", "48", None),
    ],
    14: [
        (None, "Ban Biên tập", "Lời tòa soạn", "3", None),
        (R, "PGS.TS. Lương Thị Mai", "Đào tạo kỹ sư thiết kế vi mạch: kinh nghiệm quốc tế và lộ trình cho các trường địa phương", "5", "chip"),
        (R, "TS. Hồ Quang Vinh", "Mô hình học kỳ doanh nghiệp: sinh viên học gì khi làm việc thật?", "16", "coop"),
        (R, "ThS. Phan Ngọc Ánh", "Kỹ năng dữ liệu cho cán bộ không chuyên công nghệ thông tin", "25", None),
        (R, "TS. Đinh Công Sơn", "Chính sách thu hút chuyên gia công nghệ: nhìn từ chi phí sống và môi trường làm việc", "32", None),
        (N, "Bảo Trân", "Cô giáo dạy robot ở trường làng", "41", None),
        (T, "P.V", "Thông tin tuyển sinh và học bổng khoa học kỹ thuật", "47", None),
    ],
    13: [
        (None, "Ban Biên tập", "Lời tòa soạn", "3", None),
        (R, "TS. Nguyễn Hải Đăng", "Xói lở bờ biển: đọc hiện tượng qua chuỗi ảnh vệ tinh mười năm", "5", "erosion"),
        (R, "ThS. Tôn Nữ Thảo", "Giải pháp dựa vào thiên nhiên cho đô thị ven biển: rừng phi lao, đụn cát và thảm cỏ biển", "15", "nbs"),
        (R, "TS. Lâm Quốc Huy", "Quan trắc chất lượng nước vịnh bằng trạm tự động: kết quả và giới hạn", "25", None),
        (R, "KS. Trương Mỹ Linh", "Thu gom và tái chế rác nhựa ở các làng chài: thử nghiệm mô hình đặt cọc", "34", None),
        (L, "Hải Yến", "Một ngày cùng nhóm tình nguyện nhặt rác đáy biển", "42", None),
        (T, "P.V", "Môi trường: điểm tin hai tháng", "49", None),
    ],
}

LEADS = {
    "tfp": "Tăng trưởng dựa vào vốn và lao động đang chạm ngưỡng. Bài viết đề xuất dùng năng suất các nhân tố tổng hợp (TFP) như thước đo chính khi đánh giá hiệu quả đầu tư cho khoa học công nghệ ở cấp thành phố.",
    "sandbox": "Nhiều công nghệ mới không có chỗ đứng trong khung pháp lý hiện hành. Cơ chế thử nghiệm có kiểm soát giúp địa phương học nhanh mà vẫn giữ an toàn cho người dân.",
    "ioc": "Một trung tâm điều hành thông minh chỉ thực sự có giá trị khi dữ liệu dẫn tới hành động. Bài viết phân tích ba tầng năng lực mà các trung tâm hiện nay còn thiếu.",
    "opendata": "Công bố dữ liệu là bước đầu; để dữ liệu được dùng, cần định dạng chuẩn, cập nhật đều và một kênh phản hồi từ người dùng.",
    "chip": "Thiết kế vi mạch đòi hỏi nền tảng toán – điện tử vững và công cụ chuyên dụng đắt tiền. Các trường địa phương có thể bắt đầu từ đâu?",
    "coop": "Một học kỳ làm việc toàn thời gian tại doanh nghiệp thay đổi cách sinh viên học, nhưng cũng đặt ra yêu cầu mới cho giảng viên và doanh nghiệp.",
    "erosion": "Chuỗi ảnh vệ tinh mười năm cho thấy xói lở không xảy ra đều dọc bờ biển mà tập trung ở một số đoạn, gắn với công trình và dòng chảy ven bờ.",
    "nbs": "Kè cứng bảo vệ tức thời nhưng tốn kém và có thể đẩy xói lở sang đoạn bên cạnh. Giải pháp dựa vào thiên nhiên là hướng bổ sung đáng cân nhắc.",
}

BODIES = {
    "tfp": """Trong nhiều năm, tăng trưởng của các đô thị chủ yếu dựa vào mở rộng vốn đầu tư và bổ sung lao động. Khi quỹ đất, nguồn vốn công và lao động giá rẻ đều thu hẹp, câu hỏi đặt ra là phần tăng trưởng còn lại đến từ đâu. Kinh tế học gọi phần đó là năng suất các nhân tố tổng hợp (TFP): những gì giúp cùng một lượng vốn và lao động tạo ra nhiều giá trị hơn.

## Vì sao không chỉ đếm đề tài và bằng sáng chế

Số đề tài nghiệm thu hay số bằng sáng chế là chỉ số đầu vào và đầu ra trung gian. Chúng dễ thống kê nhưng không cho biết công nghệ đã thực sự đi vào sản xuất hay chưa. TFP đo trực tiếp kết quả cuối cùng, nên phù hợp hơn khi đánh giá chính sách ở tầm thành phố.

## Ba điều kiện để đo được TFP ở địa phương

Thứ nhất, cần số liệu giá trị tăng thêm theo ngành đủ chi tiết và nhất quán qua nhiều năm. Thứ hai, cần ước lượng được vốn tích lũy, điều thường bị bỏ qua trong thống kê địa phương. Thứ ba, kết quả cần được diễn giải cùng các chỉ số bổ trợ như tỷ lệ doanh nghiệp đổi mới công nghệ, để tránh quy toàn bộ phần dư cho khoa học công nghệ.

## Gợi ý chính sách

Thành phố có thể bắt đầu bằng một bộ chỉ số nhỏ, công bố hằng năm, gắn TFP với ba đến năm ngành ưu tiên. Khi có chuỗi số liệu đủ dài, việc phân bổ ngân sách khoa học công nghệ sẽ dựa trên bằng chứng thay vì cảm tính.""",
    "ioc": """Các trung tâm điều hành đô thị thông minh thường gây ấn tượng bằng những bức tường màn hình hiển thị camera, bản đồ giao thông và biểu đồ thời gian thực. Tuy vậy, giá trị của trung tâm không nằm ở số màn hình mà ở số quyết định được đưa ra nhanh hơn, đúng hơn nhờ dữ liệu.

## Tầng thứ nhất: kết nối dữ liệu

Nhiều sở, ngành vẫn lưu dữ liệu ở hệ thống riêng, định dạng khác nhau. Trước khi nói đến phân tích, cần một lớp chuẩn hóa và danh mục dữ liệu dùng chung, kèm quy định rõ ai chịu trách nhiệm cập nhật.

## Tầng thứ hai: phân tích và cảnh báo

Từ dữ liệu đã kết nối, trung tâm cần các quy tắc cảnh báo đơn giản trước khi nghĩ đến mô hình phức tạp: mực nước vượt ngưỡng, ùn tắc kéo dài, số phản ánh tăng đột biến ở một khu vực.

## Tầng thứ ba: quy trình xử lý

Một cảnh báo chỉ có ý nghĩa khi đi kèm quy trình: ai nhận, trong bao lâu phải phản hồi, kết quả được ghi nhận lại ra sao. Đây là tầng thường bị xem nhẹ nhưng quyết định hiệu quả thực tế của cả hệ thống.""",
    "chip": """Thiết kế vi mạch được xem là khâu có giá trị gia tăng cao nhất trong chuỗi bán dẫn, đồng thời là khâu phù hợp nhất với các địa phương chưa có nhà máy chế tạo. Nhu cầu kỹ sư thiết kế đang tăng nhanh, nhưng số lượng được đào tạo bài bản vẫn còn ít.

## Nền tảng trước, công cụ sau

Kinh nghiệm từ các chương trình đào tạo ở nước ngoài cho thấy sinh viên cần nền tảng vững về mạch số, kiến trúc máy tính và xử lý tín hiệu trước khi làm quen với công cụ thiết kế chuyên dụng. Công cụ thay đổi theo thời gian, nền tảng thì không.

## Chia sẻ hạ tầng giữa các trường

Bản quyền phần mềm thiết kế và máy chủ mô phỏng có chi phí lớn. Một trung tâm dùng chung giữa nhiều trường, có doanh nghiệp tham gia đặt hàng đề bài, giúp giảm chi phí và đưa bài toán thực tế vào lớp học.

## Lộ trình ba năm

Năm đầu tập trung bồi dưỡng giảng viên và xây dựng học phần nền tảng; năm thứ hai mở chuyên ngành hẹp với đồ án do doanh nghiệp hướng dẫn; năm thứ ba đánh giá đầu ra dựa trên tỷ lệ sinh viên được tuyển đúng chuyên môn.""",
    "erosion": """Xói lở bờ biển là mối quan tâm thường trực của các đô thị ven biển, nhất là sau mỗi mùa mưa bão. Thay vì chỉ dựa vào quan sát tại chỗ, nhóm tác giả đã sử dụng chuỗi ảnh vệ tinh độ phân giải trung bình trong mười năm để theo dõi biến động đường bờ.

## Phương pháp

Đường bờ được xác định trên từng ảnh bằng chỉ số phân biệt nước và đất, sau đó so sánh dọc theo các mặt cắt vuông góc với bờ cách nhau 50 m. Kết quả cho phép tính tốc độ bồi hoặc xói trung bình của từng đoạn.

## Kết quả chính

Xói lở không xảy ra đồng đều. Phần lớn chiều dài bờ biển tương đối ổn định, trong khi một số đoạn ngắn có tốc độ lùi bờ đáng kể, thường nằm cạnh các công trình nhô ra biển hoặc cửa sông.

## Ý nghĩa cho quy hoạch

Bản đồ biến động đường bờ giúp ưu tiên nguồn lực cho đúng đoạn cần bảo vệ, đồng thời là cơ sở để đánh giá tác động trước khi xây dựng công trình mới sát biển.""",
}


def demo_entries(num: int):
    """Trả về danh sách dict TocEntry mẫu cho số `num` (rỗng nếu không có)."""
    out = []
    for i, (section, author, title, page, key) in enumerate(TOC.get(num, [])):
        out.append({
            "section": section, "author": author, "title": title, "page": page, "sort_order": i,
            "is_front": section is None, "is_research": section == SECTION_RESEARCH,
            "lead": LEADS.get(key) if key else None, "body": BODIES.get(key) if key else None,
        })
    return out
