import './footer.css';

const ORG = 'Liên hiệp các Hội Khoa học và Kỹ thuật thành phố Đà Nẵng';

// Footer dùng chung mọi trang (kiểu trang chủ v7). Nội dung lấy từ Cài đặt trang trong admin.
export default function Footer({ site }: { site: Record<string, string> }) {
  const org = site.org_name || ORG;
  const publisher = site.publisher ?? 'VÕ CÔNG TRÍ';
  const editors = site.editors ?? 'MAI ĐỨC LỘC – LÊ MINH HÙNG';
  return (
    <footer className="v7-foot">
      <div className="v7f-w">
        <div className="v7-foot-row">
          <div className="v7-foot-brand">
            <div className="v7-foot-logo" aria-label="Đặc san Khoa học & Phát triển thành phố Đà Nẵng">
              <span className="a">ĐẶC SAN</span>
              <span className="b">Khoa học &amp; Phát triển</span>
              <span className="c">THÀNH PHỐ ĐÀ NẴNG</span>
            </div>
            <p>Cơ quan chủ quản: {org}.</p>
          </div>
          {(publisher || editors) && (
            <div className="v7-foot-staff">
              {publisher && (
                <>
                  <h4>CHỊU TRÁCH NHIỆM XUẤT BẢN</h4>
                  {publisher.split('\n').map((l, i) => <div key={i} className="nm">{l}</div>)}
                </>
              )}
              {editors && (
                <>
                  <h4>BIÊN TẬP</h4>
                  {editors.split('\n').map((l, i) => <div key={i} className="nm">{l}</div>)}
                </>
              )}
            </div>
          )}
          {site.contact && (
            <div>
              <h4>LIÊN HỆ</h4>
              {site.contact.split('\n').map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
          {(site.license || site.issn) && (
            <div>
              <h4>GIẤY PHÉP</h4>
              {site.license && <div>{site.license}</div>}
              {site.issn && <div>ISSN {site.issn}</div>}
            </div>
          )}
        </div>
        <div className="v7-foot-bot">
          <span>© {new Date().getFullYear()} {org}</span>
          {site.copyright && <span>{site.copyright}</span>}
        </div>
      </div>
    </footer>
  );
}
