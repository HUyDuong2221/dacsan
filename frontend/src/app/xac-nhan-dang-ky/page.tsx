import type { Metadata } from 'next';
import SubscriptionAction from '@/components/site/SubscriptionAction';

export const metadata: Metadata = { title: 'Xác nhận đăng ký nhận tin', robots: { index: false, follow: false }, referrer: 'no-referrer' };

// Mở từ link trong email "Xác nhận đăng ký nhận tin".
export default function Page() {
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Nhận tin</div>
        <h1>Xác nhận đăng ký nhận tin</h1>
      </div>
      <SubscriptionAction action="confirm" />
    </div>
  );
}
