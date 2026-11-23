// Dải báo "bản xem trước" ở đầu trang số/bài/PDF của số chưa công bố.
export default function PreviewBar({ slug }: { slug: string }) {
  return (
    <div className="preview-bar" role="status">
      <span><b>Bản xem trước</b> · Số này chưa công bố, người đọc chưa thấy trang này.</span>
      <a href={`/xem-truoc?thoat=1&slug=${encodeURIComponent(slug)}`}>Thoát xem trước</a>
    </div>
  );
}
