'use client';
import { useState } from 'react';

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/v1/public/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setState(r.ok ? 'ok' : 'err');
    if (r.ok) setEmail('');
  }
  return (
    <form onSubmit={submit}>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" style={{ flex: '1 1 180px', width: 'auto', background: '#fcfcfa', padding: '12px 14px', fontSize: 14.5 }}
          type="email" required placeholder="Địa chỉ email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn ghost" style={{ padding: '12px 18px', borderColor: 'var(--blue)' }}>Đăng ký</button>
      </div>
      {state === 'ok' && <div className="ok">Đã đăng ký. Cảm ơn bạn!</div>}
      {state === 'err' && <div className="err">Email không hợp lệ.</div>}
    </form>
  );
}
