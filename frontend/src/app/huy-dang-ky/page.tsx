import type { Metadata } from 'next';
import SubscriptionAction from '@/components/site/SubscriptionAction';

export const metadata: Metadata = { title: 'Hủy đăng ký nhận tin', robots: { index: false, follow: false }, referrer: 'no-referrer' };

// Mở từ link trong email thư báo số mới (link Hủy đăng ký).
export default function Page() {
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Nhận tin</div>
        <h1>Hủy đăng ký nhận tin</h1>
      </div>
      <SubscriptionAction action="unsubscribe" />
    </div>
  );
}
