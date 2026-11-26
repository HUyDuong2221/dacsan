'use client';
import { useEffect, useRef, useState } from 'react';
import { adm } from './ResourceManager';

type Props = {
  token: string;
  onAuthError: () => void;
  settingKey: string;
  label: string;
  hint: string;
  doneText: string;
  resetLabel: string;
  kind: 'logo'; // mỗi loại ảnh giao diện có kho riêng
};

export default function ImageSetting({ token, onAuthError, settingKey: KEY, label, hint, doneText, resetLabel, kind }: Props) {
  const contain = kind === 'logo';
  const [row, setRow] = useState<any>(null);
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<any[]>([]);

  function fail(e: any) {
    if (e.status === 401) return onAuthError();
    setErr(e.message || 'Có lỗi xảy ra');
    setMsg('');
  }

  async function load() {
    try {
      const rows: any[] = await adm('/settings', token);
      const r = rows.find((x) => x.key === KEY) || null;
      setRow(r);
      setUrl(r?.value || '');
    } catch (e) { fail(e); }
  }
  async function loadMedia() {
    try { setMedia(await adm(`/media?kind=${kind}`, token)); } catch (e) { fail(e); }
  }
  useEffect(() => { load(); loadMedia(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function upload(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const d = await adm(`/upload?kind=${kind}`, token, { method: 'POST', body: fd });
      setUrl(d.url);
      setErr('');
      loadMedia();
    } catch (e) { fail(e); }
  }

  async function save() {
    setBusy(true);
    try {
      const body = JSON.stringify({ key: KEY, value: url.trim() });
      if (row) await adm(`/settings/${row.id}`, token, { method: 'PUT', body });
      else await adm('/settings', token, { method: 'POST', body });
      setMsg(doneText); setErr('');
      await load();
      loadMedia();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  async function removeMedia(m: any) {
    if (!confirm('Xóa vĩnh viễn ảnh này khỏi máy chủ?')) return;
    try {
      await adm(`/media/${kind}/${m.name}`, token, { method: 'DELETE' });
      if (url === m.url) setUrl('');
      setMsg('Đã xóa ảnh'); setErr('');
      loadMedia();
    } catch (e) { fail(e); }
  }

  async function reset() {
    setBusy(true);
    try {
      if (row) await adm(`/settings/${row.id}`, token, { method: 'DELETE' });
      setUrl(''); setRow(null);
      setMsg('Đã trở về mặc định.'); setErr('');
      loadMedia();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  return (
    <div className="form" style={{ gridTemplateColumns: '1fr' }}>
      <label>{label}
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/media/… hoặc dán liên kết ảnh" />
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <small className="muted">{hint}</small>
      </label>
      <div>
        <div className="muted" style={{ marginBottom: 6 }}>Xem trước đúng như hiển thị trên trang chủ</div>
        <Scaled width={1280} height={84}>
          <HeaderMock url={url.trim()} />
        </Scaled>
      </div>
      <div>
        <div className="muted" style={{ marginBottom: 6 }}>
          Kho ảnh logo ({media.length}) — bấm để chọn, bấm × để xóa ảnh chưa dùng
        </div>
        {media.length === 0 ? (
          <span className="muted">Chưa có ảnh nào trong kho này.</span>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, maxHeight: 340, overflowY: 'auto' }}>
            {media.map((m) => (
              <div key={m.url} style={{ position: 'relative' }}>
                <button type="button" onClick={() => setUrl(m.url)} title={m.used_by?.length ? `Đang dùng: ${m.used_by.join(', ')}` : m.name} aria-pressed={url === m.url}
                  style={{ padding: 0, width: '100%', border: url === m.url ? '3px solid #0B4F9C' : '1px solid #DCE5F0', borderRadius: 6, overflow: 'hidden', background: '#fff', cursor: 'pointer', aspectRatio: '16/10', display: 'block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: contain ? 'contain' : 'cover', display: 'block' }} />
                </button>
                {m.used_by?.length > 0 ? (
                  <span style={{ position: 'absolute', left: 4, bottom: 4, background: 'rgba(11,79,156,.9)', color: '#fff', fontSize: 11, padding: '1px 6px', borderRadius: 4 }}>Đang dùng</span>
                ) : (
                  <button type="button" onClick={() => removeMedia(m)} aria-label={`Xóa ảnh ${m.name}`} title="Xóa ảnh"
                    style={{ position: 'absolute', right: 4, top: 4, width: 26, height: 26, borderRadius: '50%', border: 0, background: 'rgba(160,30,30,.92)', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      <div className="row">
        <button type="button" className="btn" disabled={busy || !url.trim()} onClick={save}>Lưu</button>
        <button type="button" className="btn ghost" disabled={busy || !row} onClick={reset}>{resetLabel}</button>
      </div>
    </div>
  );
}

/* Thu nhỏ khung 1280px vừa bề rộng khung xem trước, giữ nguyên tỉ lệ thật của trang chủ */
function Scaled({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setK(el.clientWidth / width));
    ro.observe(el);
    setK(el.clientWidth / width);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} style={{ width: '100%', height: height * k, overflow: 'hidden', border: '1px solid #DCE5F0', borderRadius: 8, background: '#fff', position: 'relative' }}>
      <div style={{ width, height, transform: `scale(${k})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>{children}</div>
    </div>
  );
}

const NAVTXT = ['Trang chủ', 'Tiêu điểm', 'Đặc san', 'Nghiên cứu – Trao đổi', 'Tin hoạt động'];
const TNR = '"Times New Roman",Times,serif';

function LogoMock({ url }: { url: string }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={{ display: 'block', height: 56, width: 'auto', maxWidth: 300, objectFit: 'contain' }} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, color: '#0B3C7A', minWidth: 250, fontFamily: TNR }}>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em' }}>ĐẶC SAN</span>
      <span style={{ fontStyle: 'italic', fontSize: 30, fontWeight: 700, margin: '4px 0 2px' }}>Khoa học &amp; Phát triển</span>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textAlign: 'center' }}>THÀNH PHỐ ĐÀ NẴNG</span>
    </div>
  );
}

function NavMock({ url }: { url: string }) {
  return (
    <div style={{ height: 84, display: 'flex', alignItems: 'center', gap: 32, padding: '0 48px', background: '#fff', borderBottom: '1px solid #DCE5F0', boxSizing: 'border-box', fontFamily: TNR }}>
      <LogoMock url={url} />
      <div style={{ display: 'flex', gap: 28, flex: 1, fontSize: 18, color: '#0B2F5E' }}>
        {NAVTXT.map((t, i) => <span key={t} style={{ fontWeight: i === 0 ? 700 : 500, borderBottom: i === 0 ? '2px solid #0B4F9C' : 0, paddingBottom: 4 }}>{t}</span>)}
      </div>
      <span style={{ background: '#0B4F9C', color: '#fff', fontWeight: 700, fontSize: 17, padding: '12px 28px', borderRadius: 6 }}>Gửi bài</span>
    </div>
  );
}

function HeaderMock({ url }: { url: string }) {
  return <NavMock url={url} />;
}

