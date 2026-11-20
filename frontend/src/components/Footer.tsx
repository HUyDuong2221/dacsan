import './footer.css';

// Footer dùng chung mọi trang (kiểu trang chủ v7). Nội dung lấy từ Cài đặt trang trong admin.
export default function Footer({ site }: { site: Record<string, string> }) {
  return (
    <footer className="v7-foot">
      <div className="v7f-w">
        <div className="v7-foot-row">
          <div className="v7-foot-brand">
            <div className="t">Đặc san Khoa học &amp; Phát triển<small>THÀNH PHỐ ĐÀ NẴNG</small></div>
            {site.org_name && <p>Cơ quan chủ quản: {site.org_name}</p>}
          </div>
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
          <span>© {new Date().getFullYear()} Đặc san Khoa học &amp; Phát triển thành phố Đà Nẵng</span>
          {site.copyright && <span>{site.copyright}</span>}
        </div>
      </div>
    </footer>
  );
}
