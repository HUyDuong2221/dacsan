export default function Footer({ site }: { site: Record<string, string> }) {
  return (
    <footer className="footer">
      <div className="wrap cols">
        <div>
          <div className="serif" style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 12, lineHeight: 1.3 }}>
            Đặc san Khoa học &amp; Phát triển thành phố Đà Nẵng
          </div>
          <div>Cơ quan chủ quản: {site.org_name}</div>
        </div>
        <div>
          <h4>LÃNH ĐẠO LIÊN HIỆP HỘI (2026–2031)</h4>
          <div className="prewrap">{site.leaders}</div>
        </div>
        <div>
          <h4>LIÊN HỆ</h4>
          <div className="prewrap">{site.contact}</div>
        </div>
        <div>
          <h4>GIẤY PHÉP</h4>
          <div>{site.license}</div>
          <div>ISSN {site.issn}</div>
        </div>
      </div>
      <div className="legal">
        <div className="wrap">
          <span>© {new Date().getFullYear()} {site.org_name}</span>
          <span>{site.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
