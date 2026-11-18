'use client';
import Link from 'next/link';
import { useState } from 'react';

type Msg = { from: 'u' | 'b'; text: string; link?: string | null; articles?: any[] };
const CHIPS = ['Bài trong số 17', 'Tìm theo tác giả', 'Thể lệ gửi bài'];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'b', text: 'Bạn cần tìm bài theo tác giả, chuyên mục hay số phát hành? Nhập câu hỏi bên dưới.' },
  ]);

  async function send(text: string) {
    text = text.trim();
    if (text.length < 2 || busy) return;
    setMsgs((m) => [...m, { from: 'u', text }]);
    setQ('');
    setBusy(true);
    try {
      const r = await fetch('/api/v1/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      const d = await r.json();
      setMsgs((m) => [...m, { from: 'b', text: d.answer || 'Xin lỗi, có lỗi xảy ra.', link: d.link, articles: d.articles }]);
    } catch {
      setMsgs((m) => [...m, { from: 'b', text: 'Không kết nối được máy chủ.' }]);
    }
    setBusy(false);
  }

  return (
    <>
      {open && (
        <div className="chat" role="dialog" aria-label="Trợ lý Đặc san">
          <header>
            <div>
              <div className="serif" style={{ fontSize: 16.5, fontWeight: 600 }}>Trợ lý Đặc san</div>
              <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.08em', color: '#8fe1ff' }}>HỖ TRỢ TRA CỨU BÀI BÁO</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, color: '#fff', fontSize: 18 }}>✕</button>
          </header>
          <div className="msgs">
            {msgs.map((m, i) =>
              m.from === 'u' ? (
                <div key={i} className="msg-u">{m.text}</div>
              ) : (
                <div key={i} className="msg-b">
                  {m.text}
                  {m.link && <div><Link href={m.link} onClick={() => setOpen(false)}>Mở trang →</Link></div>}
                  {m.articles?.map((a) => (
                    <Link key={a.slug} href={`/articles/${a.slug}`} onClick={() => setOpen(false)}>
                      {a.title}
                      <div className="muted">{a.author} · {a.issue.label}</div>
                    </Link>
                  ))}
                </div>
              ),
            )}
          </div>
          <div style={{ padding: '0 16px 12px' }} className="row">
            {CHIPS.map((c) => (
              <button key={c} className="chip" onClick={() => send(c)}>{c}</button>
            ))}
          </div>
          <form
            className="row"
            style={{ padding: '0 16px 16px', flexWrap: 'nowrap' }}
            onSubmit={(e) => { e.preventDefault(); send(q); }}
          >
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nhập câu hỏi của bạn" maxLength={200} />
            <button className="btn" disabled={busy}>Gửi</button>
          </form>
        </div>
      )}
      <div className="bubbles">
        <button className="main" title="Trợ lý Đặc san" onClick={() => setOpen(!open)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8Z" />
          </svg>
        </button>
        <button title="Về đầu trang" onClick={() => window.scrollTo({ top: 0 })}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1f4bb8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V6" /><path d="M6 12l6-6 6 6" />
          </svg>
        </button>
      </div>
    </>
  );
}
