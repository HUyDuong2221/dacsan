'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Xác nhận đăng ký nhận tin (tự chạy khi mở link) hoặc hủy đăng ký (cần bấm nút, để trình quét link
 * trong hộp thư không tự hủy hộ). Token lấy từ ?token= và được bỏ khỏi thanh địa chỉ.
 */
export default function SubscriptionAction({ action }: { action: 'confirm' | 'unsubscribe' }) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [text, setText] = useState('');

  async function run(t: string) {
    setState('busy');
    try {
      const r = await fetch(`/api/v1/public/${action === 'confirm' ? 'subscribe/confirm' : 'unsubscribe'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setState('ok');
        setText(action === 'confirm'
          ? `Đã xác nhận. Email ${d.email} sẽ nhận thư báo khi Đặc san phát hành số mới.`
          : `Đã hủy đăng ký. Email ${d.email} sẽ không nhận thư báo số mới nữa.`);
      } else {
        setState('err');
        setText(typeof d.detail === 'string' ? d.detail : 'Không thực hiện được, vui lòng thử lại.');
      }
    } catch {
      setState('err'); setText('Không kết nối được máy chủ.');
    }
  }

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    if (!t) { setToken((x) => x ?? ''); return; }
    setToken(t);
    window.history.replaceState(null, '', window.location.pathname);
    if (action === 'confirm') run(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="box" style={{ maxWidth: 560 }}>
      {token === '' && <p className="err" style={{ margin: 0 }}>Thiếu mã trong liên kết. Hãy mở đúng liên kết trong email.</p>}
      {token && action === 'unsubscribe' && state === 'idle' && (
        <>
          <p style={{ marginTop: 0 }}>Bạn muốn ngừng nhận thư báo khi Đặc san phát hành số mới?</p>
          <button className="btn" onClick={() => run(token)}>Hủy đăng ký</button>
        </>
      )}
      {state === 'busy' && <p className="muted" style={{ margin: 0 }}>Đang xử lý…</p>}
      {state === 'ok' && <p style={{ margin: 0 }} role="status">{text}</p>}
      {state === 'err' && <p className="err" style={{ margin: 0 }} role="alert">{text}</p>}
      {(state === 'ok' || state === 'err') && <p style={{ marginBottom: 0 }}><Link href="/">← Về trang chủ</Link></p>}
    </div>
  );
}
