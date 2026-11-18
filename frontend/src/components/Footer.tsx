function Lines({ text }: { text?: string }) {
  return (
    <>
      {(text || '').split('\n').map((ln, i) => {
        const m = ln.match(/^(Chủ tịch:)\s*(.*)$/);
        return <div key={i}>{m ? <>{m[1]} <strong>{m[2]}</strong></> : ln}</div>;
      })}
    </>
  );
}

export default function Footer({ site }: { site: Record<string, string> }) {
  return (
    <footer className="footer">
      <div className="wrap cols">
        <div>
          <div className="t">Đặc san Khoa học &amp; Phát triển thành phố Đà Nẵng</div>
          <p>Cơ quan chủ quản: {site.org_name}.</p>
        </div>
        <div className="blk">
          <h4>LÃNH ĐẠO LIÊN HIỆP HỘI (2026–2031)</h4>
          <Lines text={site.leaders} />
        </div>
        <div className="blk">
          <h4>LIÊN HỆ</h4>
          <Lines text={site.contact} />
        </div>
        <div className="blk">
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
