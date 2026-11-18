'use client';
import Link from 'next/link';
import { useState } from 'react';
import { fmtDate } from '@/lib/api';

const TONE: Record<string, string> = {
  new: '#5a6b76', reviewing: '#1f4bb8', revision: '#b26a00', accepted: '#0e7a4b', rejected: '#c8372d',
};

export default function TheoDoi() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function look(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setRes(null); setBusy(true);
    try {
      const r = await fetch('/api/v1/public/submissions/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setRes(d); else setErr(typeof d.detail === 'string' ? d.detail : 'Không tra cứu được.');
    } catch { setErr('Không kết nối được máy chủ.'); }
    setBusy(false);
  }

  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Gửi bài</div>
        <h1>Tra cứu tình trạng bài gửi</h1>
      </div>
      <form onSubmit={look} className="form" style={{ maxWidth: 560, gridTemplateColumns: '1fr' }}>
        <label>Email đã dùng khi gửi bài<input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Mã tra cứu<input className="input mono" required value={code} onChange={(e) => setCode(e.target.value)} maxLength={16} style={{ letterSpacing: '.15em', textTransform: 'uppercase' }} /></label>
        {err && <div className="err">{err}</div>}
        <div className="row"><button className="btn" disabled={busy}>Tra cứu</button><Link href="/gui-bai" className="btn ghost">Gửi bài mới</Link></div>
      </form>
      {res && (
        <div className="box" style={{ maxWidth: 560 }}>
          <div className="mono muted" style={{ fontSize: 12 }}>MÃ {res.code}</div>
          <h3 style={{ margin: '6px 0 12px' }}>{res.title}</h3>
          <div style={{ marginBottom: 12 }}>
            Tình trạng:{' '}
            <b style={{ color: TONE[res.status] || 'inherit' }}>{res.status_label}</b>
          </div>
          {res.note && (
            <div className="leadbox" style={{ margin: '0 0 12px', padding: 16 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Phản hồi của ban biên tập</div>
              <p style={{ fontStyle: 'normal', fontFamily: 'var(--sans)', fontSize: 15 }}>{res.note}</p>
            </div>
          )}
          <div className="muted">Gửi ngày {fmtDate(res.created_at)} · Cập nhật {fmtDate(res.updated_at)}</div>
        </div>
      )}
    </div>
  );
}
