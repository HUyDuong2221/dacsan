import type { Metadata } from 'next';
import ReviewForm from '@/components/site/ReviewForm';

// Link chứa token bí mật: không cho máy tìm kiếm lập chỉ mục, không gửi Referer ra ngoài.
export const metadata: Metadata = {
  title: 'Phản biện bài viết',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function PhanBien({ params }: { params: { token: string } }) {
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Phản biện</div>
        <h1>Phản biện bài viết</h1>
      </div>
      <ReviewForm token={params.token} />
    </div>
  );
}
