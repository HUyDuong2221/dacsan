"""Dữ liệu mẫu lấy từ giao diện thiết kế. Chỉ chạy khi DB chưa có số nào."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Activity, TocEntry, Document, Field, Issue, Notice, Setting
from .util import slugify

FIELDS = ["Đại hội đại biểu LHH Đà Nẵng lần thứ I", "Nhân vật", "Câu chuyện văn hóa", "Câu chuyện quốc tế", "Thông tin"]
G1 = FIELDS[0]

# (chuyên mục, tác giả, tiêu đề, trang)
ARTICLES = [
    (G1, "KH&PT thành phố Đà Nẵng", "Lời thưa", "7"),
    (G1, "Đặc san Khoa học & Phát triển", "Lãnh đạo, Ban Chấp hành Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng (nhiệm kỳ 2026–2031)", "8"),
    (G1, "Phạm Ngọc Linh", "Xứng đáng là trí thức mới của xứ Quảng", "13"),
    (G1, "Nguyễn Đình Vĩnh", "Lan tỏa tinh thần trí thức phụng sự đất nước, phục vụ nhân dân", "17"),
    (G1, "Võ Công Trí", "Dấu ấn một nhiệm kỳ", "22"),
    (G1, "Lê Văn Trung", "Một số định hướng phát triển thành phố Đà Nẵng trong bối cảnh hiện nay", "25"),
    (G1, "Nguyễn Thị Hoài Nam", "Đưa khoa học – kỹ thuật vào đời sống", "32"),
    (G1, "Võ Duy Khương", "Thúc đẩy mô hình SAAS cho doanh nghiệp vừa và nhỏ: Động lực mới cho tăng trưởng kinh tế số tại Đà Nẵng", "36"),
    (G1, "Đặng Việt Dũng", "Tái cấu trúc năng suất lao động trên nền tảng khoa học công nghệ, đổi mới sáng tạo và chuyển đổi số: Con đường tăng trưởng hai con số của Đà Nẵng", "41"),
    (G1, "Bùi Văn Ga", "Phát triển nguồn nhân lực chất lượng cao về khoa học công nghệ cho thành phố Đà Nẵng", "48"),
    (G1, "Lê Tùng Lâm", "Đà Nẵng cần làm gì để áp dụng BIM?", "56"),
    (G1, "Nguyễn Hữu Hiếu", "Trường Đại học Bách khoa – Đại học Đà Nẵng: Trụ cột đào tạo nhân lực công nghệ cao", "59"),
    (G1, "Võ Văn Minh", "Tổ chức không gian đô thị ven biển, ven sông theo hướng xanh, thích ứng và bền vững tại thành phố Đà Nẵng", "64"),
    (G1, "Bùi Văn Tiếng", "Để phát triển giáo dục và đào tạo thành phố Đà Nẵng ngang tầm với đòi hỏi của kỷ nguyên mới", "67"),
    (G1, "Phan Cao Thọ", "Bản sao số thế hệ 2: Chìa khóa thành công cho chuyển đổi số đô thị và mô hình Đà Nẵng AI city", "73"),
    (G1, "Nguyễn Gia Như", "Từ thành phố đáng sống đến thành phố thông minh dựa trên AI", "81"),
    (G1, "Ngô Thị Kim Yến", "Định hướng phát triển y tế thành phố Đà Nẵng trong giai đoạn mới", "91"),
    ("Nhân vật", "Mai Đức Lộc", "Vũ Ngọc Hoàng, người nghĩ trước", "96"),
    ("Câu chuyện văn hóa", "Lê Minh Hùng", "Đà Nẵng tháng hoa cùng pháo hoa", "100"),
    ("Câu chuyện văn hóa", "Huỳnh Văn Mười", "Hồn biển", "111"),
    ("Câu chuyện văn hóa", "Mai Đức Lộc", "Gặp chủ nhân Nobel Kinh tế", "119"),
    ("Câu chuyện quốc tế", "Út Phan", "Cuộc cách mạng không người lái và sự thay đổi của chiến tranh hiện đại", "113"),
    ("Thông tin", "P.V", "Đại hội đại biểu Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng lần thứ I, nhiệm kỳ 2026–2031", "123"),
    ("Thông tin", "P.V", "Thông tin khoa học công nghệ", "127"),
    ("Thông tin", "P.V", "Đà Nẵng 100 ngày qua", "133"),
]

HERO = {  # chỉ số bài -> đoạn trích hiển thị ở slide
    2: "Phát biểu của PGS, TS Phạm Ngọc Linh – Phó Chủ tịch Liên hiệp các Hội Khoa học và Kỹ thuật Việt Nam tại Đại hội đại biểu Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng lần thứ nhất, nhiệm kỳ 2026–2031.",
    4: "Nhìn lại chặng đường của hệ thống Liên hiệp Hội qua một nhiệm kỳ nhiều biến động: đại dịch, sắp xếp tổ chức bộ máy và hợp nhất địa giới hành chính.",
    8: "Con đường tăng trưởng hai con số của Đà Nẵng nhìn từ bài toán năng suất lao động và các điều kiện để chuyển đổi số đi vào thực chất.",
    14: "Từ dữ liệu hạ tầng đến mô hình Đà Nẵng AI city: những điều kiện kỹ thuật và thể chế cần chuẩn bị cho thế hệ bản sao số tiếp theo.",
    17: "Chân dung một trí thức xứ Quảng qua những trang viết và những lần đi trước thời cuộc trong tư duy về giáo dục và phát triển.",
}
RESEARCH = {7, 8, 9, 10, 11, 12, 13, 14}

SAMPLE_LEAD = "Phát biểu của PGS, TS Phạm Ngọc Linh – Phó Chủ tịch Liên hiệp các Hội Khoa học và Kỹ thuật Việt Nam tại Đại hội đại biểu Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng lần thứ nhất, nhiệm kỳ 2026–2031."
SAMPLE_BODY = """Hôm nay, tôi rất vinh dự và vui mừng cùng đoàn đại biểu Liên hiệp các Hội Khoa học và Kỹ thuật Việt Nam về tham dự Đại hội đại biểu Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng lần thứ nhất, nhiệm kỳ 2026 – 2031.

Đây là sự kiện có ý nghĩa lịch sử, đánh dấu cột mốc đặc biệt quan trọng đối với đội ngũ trí thức khoa học và công nghệ Đà Nẵng. Đại hội diễn ra sau khi tỉnh Quảng Nam và thành phố Đà Nẵng được hợp nhất, mở ra một không gian phát triển mới, đồng thời triển khai mô hình chính quyền địa phương hai cấp.

## Một nhiệm kỳ nhiều dấu ấn

Nhiệm kỳ vừa qua là một giai đoạn có nhiều biến động lớn lao và những thách thức chưa từng có: đại dịch Covid-19 ảnh hưởng nặng nề đến mọi mặt của đời sống kinh tế – xã hội, cùng với đó là quá trình sắp xếp tổ chức bộ máy, tinh gọn các hội quần chúng và hợp nhất địa giới hành chính.

Nhìn lại chặng đường đã qua, hệ thống Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng đã khẳng định được bản lĩnh, tinh thần chủ động, đoàn kết, vượt khó và hoàn thành xuất sắc các mục tiêu, nhiệm vụ đề ra.

## Về tư vấn, phản biện và giám định xã hội

Đây thực sự là điểm sáng lớn của Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng trong nhiệm kỳ qua. Hoạt động tư vấn, phản biện đã tập hợp được tiếng nói của đội ngũ trí thức, đóng góp nhiều ý kiến quan trọng cho các chương trình, đề án phát triển của địa phương.

Sau khi có chủ trương hợp nhất, bước chuyển quan trọng của tổ chức đã được thực hiện một cách bài bản, nhịp nhàng. Hệ thống nhanh chóng được kiện toàn, tư tưởng của cán bộ, hội viên và người lao động được ổn định.

## Kỳ vọng nhiệm kỳ mới

Đà Nẵng sau hợp nhất đang đứng trước thời cơ lớn để bứt phá, nhưng cũng không ít thách thức. Sự phát triển sẽ không thể bền vững nếu không dựa trên nền tảng khoa học – công nghệ và chuyển đổi số. Chính vì vậy, sự đóng góp của đội ngũ trí thức trong việc kiến tạo tri thức mới, ứng dụng công nghệ hiện đại và thúc đẩy đổi mới sáng tạo sẽ là yếu tố quyết định."""

OLD_ISSUES = [  # (số, kỳ, năm, chủ đề, số bài, số trang)
    (16, "4-2026", 2026, "Khoa học công nghệ phục vụ tăng trưởng hai con số", 22, 128),
    (15, "2-2026", 2026, "Chuyển đổi số trong quản trị đô thị", 20, 124),
    (14, "12-2025", 2025, "Nguồn nhân lực chất lượng cao cho công nghệ", 21, 132),
    (13, "10-2025", 2025, "Môi trường và phát triển bền vững vùng ven biển", 19, 120),
    (12, "8-2025", 2025, "Đổi mới sáng tạo trong doanh nghiệp địa phương", 20, 126),
    (11, "6-2025", 2025, "Y tế cơ sở và sức khỏe cộng đồng", 18, 118),
    (10, "4-2025", 2025, "Khoa học công nghệ với nông nghiệp đô thị", 19, 116),
    (9, "2-2025", 2025, "Hạ tầng dữ liệu và chính quyền số", 20, 122),
    (8, "12-2024", 2024, "Trí thức xứ Quảng với sự nghiệp phát triển", 18, 114),
    (7, "10-2024", 2024, "Bảo tồn đa dạng sinh học bán đảo Sơn Trà", 17, 112),
    (6, "8-2024", 2024, "Giáo dục và đào tạo nhân lực kỹ thuật", 19, 118),
    (5, "6-2024", 2024, "Năng lượng tái tạo cho đô thị ven biển", 18, 110),
]

SETTINGS = {
    "hero_intro": "Toàn văn đọc trực tiếp trên web, không cần tải PDF. Mục lục giữ đúng thứ tự chuyên mục của bản in, kèm số trang để đối chiếu.",
    "org_name": "Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng",
    "issn": "2734-9098",
    "leaders": "Chủ tịch: TS Võ Công Trí\nPhó Chủ tịch: ThS Lê Văn Trung\nPhó Chủ tịch: ThS Nguyễn Thị Hoài Nam\nTổng Thư ký: ThS Huỳnh Phạm Duy Hoàng",
    "contact": "[Số nhà, đường], phường [...], thành phố Đà Nẵng\nĐiện thoại: 0236 [......]\nEmail: [email]@dusta.org.vn",
    "license": "Giấy phép xuất bản số [.../GP-...] do [cơ quan cấp] cấp ngày [..../..../....]",
    "copyright": "Bản quyền nội dung theo giấy phép CC BY-NC 4.0",
}


def seed(db: Session) -> None:
    for k, v in SETTINGS.items():
        if not db.scalars(select(Setting).where(Setting.key == k)).first():
            db.add(Setting(key=k, value=v))
    db.commit()

    if db.scalars(select(Issue)).first():
        return

    fields = {}
    for n, name in enumerate(FIELDS):
        f = Field(name=name, sort_order=n)
        db.add(f)
        fields[name] = f

    for num, period, year, theme, n_art, pages in OLD_ISSUES:
        label = f"Số {num:02d} ({period})"
        month = int(period.split("-")[0])
        db.add(Issue(slug=slugify(label), number=num, label=label, year=year, theme=theme, published_at=date(year, month, 1),
                     printed_articles=n_art, page_count=pages, published=True))

    issue = Issue(
        slug="so-17-6-2026", number=17, label="Số 17 (6-2026)", year=2026, published_at=date(2026, 6, 1),
        theme="Đại hội đại biểu Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng lần thứ I",
        summary="Số đặc biệt dành trọn cho Đại hội lần thứ I, nhiệm kỳ 2026–2031: tham luận và bài viết chọn lọc về khoa học công nghệ, đổi mới sáng tạo và chuyển đổi số của thành phố.",
        page_count=136, published=True,
    )
    db.add(issue)
    db.flush()

    used: set[str] = set()
    for i, (field, author, title, page) in enumerate(ARTICLES):
        slug = slugify(title)
        if slug in used:
            slug = f"{slug}-{i}"
        used.add(slug)
        db.add(TocEntry(
            slug=slug, issue_id=issue.id, field_id=fields[field].id, title=title, author=author,
            page_label=f"tr. {page}", sort_order=i, is_front=i < 2, is_research=i in RESEARCH,
            featured=i in HERO, hero_excerpt=HERO.get(i),
            lead=SAMPLE_LEAD if i == 2 else None, body=SAMPLE_BODY if i == 2 else None,
        ))

    d = date
    for t, k, dt in [
        ("Hội thảo khoa học “Đô thị biển thích ứng khí hậu: dữ liệu, hạ tầng và thể chế”", "Hội thảo · Liên hiệp Hội chủ trì", d(2026, 9, 5)),
        ("Công bố kết quả Giải thưởng Sáng tạo Khoa học Kỹ thuật thành phố Đà Nẵng lần thứ XVIII", "Giải thưởng khoa học", d(2026, 8, 28)),
        ("Ký kết hợp tác phổ biến kiến thức khoa học giữa Liên hiệp Hội và bốn trường đại học trên địa bàn", "Hợp tác", d(2026, 8, 14)),
        ("Tập huấn phản biện chính sách cho hội viên các hội thành viên năm 2026", "Đào tạo – tập huấn", d(2026, 8, 2)),
        ("Đoàn công tác Liên hiệp Hội làm việc với các hội thành viên khu vực phía Nam thành phố", "Hoạt động hội", d(2026, 7, 21)),
    ]:
        db.add(Activity(title=t, kind=k, event_date=dt, url="https://lhh.danang.gov.vn/chi-tiet-tin-tuc?danhmuc=1"))

    for tag, dt, t in [
        ("THƯ MỜI", d(2026, 9, 8), "Thư mời viết bài cho Đặc san Khoa học & Phát triển số 18 (8-2026)"),
        ("HỘI THI", d(2026, 9, 1), "Phát động Hội thi Sáng tạo Kỹ thuật thành phố Đà Nẵng lần thứ 19 (2026–2027)"),
        ("GIẢI THƯỞNG", d(2026, 8, 22), "Hướng dẫn nộp hồ sơ tham dự Giải thưởng Sáng tạo Khoa học Kỹ thuật thành phố"),
        ("TẬP HUẤN", d(2026, 8, 15), "Đăng ký tập huấn kỹ năng phản biện chính sách cho hội viên các hội thành viên"),
        ("THÔNG BÁO", d(2026, 8, 4), "Kế hoạch tổ chức Ngày Khoa học và Công nghệ Việt Nam 18-5 trên địa bàn thành phố"),
    ]:
        db.add(Notice(tag=tag, title=t, notice_date=dt))

    for n, (t, ty) in enumerate([
        ("Quy định về xuất bản Đặc san Khoa học và Công nghệ", "QUY ĐỊNH"),
        ("Hướng dẫn thể lệ gửi bài và định dạng bản thảo", "HƯỚNG DẪN"),
        ("Quy tắc đạo đức công bố khoa học và xử lý vi phạm", "QUY TẮC"),
        ("Quy trình phản biện kín hai chiều", "QUY TRÌNH"),
        ("Mẫu bản thảo và mẫu cam kết bản quyền", "BIỂU MẪU"),
    ]):
        db.add(Document(title=t, doc_type=ty, sort_order=n))

    db.commit()
