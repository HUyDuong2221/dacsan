import type { Metadata } from 'next';
import Link from 'next/link';
import { get } from '@/lib/api';
import SubmitForm from '@/components/SubmitForm';

export const metadata: Metadata = { title: 'Gửi bài cho Đặc san' };

export default async function GuiBai() {
  let fields: string[] = [];
  try {
    fields = (await get('/home')).fields || [];
  } catch {}
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Gửi bài</div>
        <h1>Gửi bài cho Đặc san</h1>
        <p style={{ color: 'var(--ink2)', fontSize: 16.5, maxWidth: '68ch', lineHeight: 1.65 }}>
          Bản thảo nhận liên tục. Điền thông tin và tải bản thảo lên, ban biên tập sẽ xem xét và phản hồi qua email.
          Bạn có thể tra cứu tình trạng bài bằng mã nhận được sau khi gửi. Xem{' '}
          <Link href="/docs">thể lệ gửi bài, quy định xuất bản và đạo đức công bố</Link> trước khi gửi.
        </p>
      </div>
      <SubmitForm fields={fields} />
    </div>
  );
}
