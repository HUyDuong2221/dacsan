'use client';
import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/api';

/** Trang cho phản biện viên (không cần tài khoản, xác thực bằng token trong link). */
export default function ReviewForm({ token }: { token: string }) {
  const base = `/api/v1/public/reviews/${encodeURIComponent(token)}`;
  const [d, setD] = useState<any>(null);
  const [loadErr, setLoadErr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState('');
  const [ca, setCa] = useState('');
  const [ce, setCe] = useState('');

  useEffect(() => {
    fetch(base)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok) setD(j); else setLoadErr(typeof j.detail === 'string' ? j.detail : 'Không mở được trang phản biện.');
      })
      .catch(() => setLoadErr('Không kết nối được máy chủ.'));
  }, [base]);

  async function post(path: string, body: object) {
    setErr(''); setBusy(true);
    try {
      const r = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setD(j); else setErr(typeof j.detail === 'string' ? j.detail : 'Không gửi được, vui lòng thử lại.');
    } catch { setErr('Không kết nối được máy chủ.'); }
    setBusy(false);
  }

  if (loadErr) return <div className="box" style={{ maxWidth: 640 }}><p className="err" style={{ margin: 0 }}>{loadErr}</p></div>;
  if (!d) return <p className="muted">Đang tải…</p>;

  const s = d.submission;
  const recLabel = d.recommendations.find((x: any) => x.value === d.recommendation)?.label;

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="box" style={{ marginBottom: 20 }}>
        <p style={{ marginTop: 0 }}>Kính gửi <b>{d.reviewer_name}</b>, ban biên tập trân trọng mời Quý vị phản biện bài viết dưới đây. Hạn gửi đánh giá: <b>{fmtDate(d.due_date)}</b>{d.status === 'overdue' && <b style={{ color: '#c8372d' }}> (đã quá hạn)</b>}.</p>
        <h3 style={{ margin: '6px 0 4px' }}>{s.title}</h3>
        {s.field_name && <div className="muted" style={{ marginBottom: 12 }}>Chuyên mục đề xuất: {s.field_name}</div>}
        <div className="leadbox" style={{ margin: '0 0 14px', padding: 16, maxWidth: 'none' }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Tóm tắt</div>
          <p style={{ fontStyle: 'normal', fontFamily: 'var(--sans)', fontSize: 15, whiteSpace: 'pre-wrap' }}>{s.abstract}</p>
        </div>
        {d.status !== 'declined' && <a className="btn ghost" href={`${base}/file`}>Tải bản thảo</a>}
        <p className="muted" style={{ marginBottom: 0 }}>Bài được phản biện kín: thông tin tác giả không hiển thị. Vui lòng không chia sẻ liên kết này.</p>
      </div>

      {d.status === 'submitted' && (
        <div className="box tint">
          <div className="kicker" style={{ marginBottom: 8 }}>Đã nhận đánh giá</div>
          <p style={{ marginTop: 0 }}>Cảm ơn Quý vị. Ban biên tập đã nhận phiếu đánh giá lúc {fmtDate(d.submitted_at)}.</p>
          <p style={{ marginBottom: 0 }}>Khuyến nghị: <b>{recLabel}</b></p>
        </div>
      )}

      {d.status === 'declined' && (
        <div className="box"><p style={{ margin: 0 }}>Quý vị đã từ chối phản biện bài này. Cảm ơn Quý vị đã phản hồi.</p></div>
      )}

      {d.status === 'invited' && !d.closed && (
        <div className="box">
          <p style={{ marginTop: 0 }}>Quý vị có nhận phản biện bài này không?</p>
          {err && <div className="err">{err}</div>}
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => post('/respond', { accept: true })}>Nhận phản biện</button>
            <button className="btn ghost" disabled={busy} onClick={() => confirm('Từ chối phản biện bài này?') && post('/respond', { accept: false })}>Từ chối</button>
          </div>
        </div>
      )}

      {['accepted', 'overdue'].includes(d.status) && d.closed && (
        <div className="box"><p style={{ margin: 0 }}>Bài đã có quyết định cuối cùng, ban biên tập không nhận thêm đánh giá. Cảm ơn Quý vị.</p></div>
      )}

      {['accepted', 'overdue'].includes(d.status) && !d.closed && (
        <form className="form" style={{ gridTemplateColumns: '1fr' }} onSubmit={(e) => {
          e.preventDefault();
          if (!rec) return setErr('Vui lòng chọn khuyến nghị');
          post('/submit', { recommendation: rec, comments_author: ca, comments_editor: ce });
        }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>Khuyến nghị *</legend>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {d.recommendations.map((o: any) => (
                <label key={o.value} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: '10px 14px', border: `1px solid ${rec === o.value ? 'var(--blue)' : 'var(--line2)'}`, cursor: 'pointer' }}>
                  <input type="radio" name="rec" value={o.value} checked={rec === o.value} onChange={() => setRec(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label>Nhận xét gửi tác giả * <small className="muted">(tác giả sẽ được đọc; tối thiểu 10 ký tự)</small>
            <textarea className="input" rows={8} required minLength={10} maxLength={20000} value={ca} onChange={(e) => setCa(e.target.value)} />
          </label>
          <label>Ý kiến riêng cho ban biên tập <small className="muted">(không gửi tác giả)</small>
            <textarea className="input" rows={4} maxLength={20000} value={ce} onChange={(e) => setCe(e.target.value)} />
          </label>
          {err && <div className="err">{err}</div>}
          <div className="row">
            <button className="btn" disabled={busy}>{busy ? 'Đang gửi…' : 'Nộp đánh giá'}</button>
            <span className="muted">Sau khi nộp sẽ không sửa được.</span>
          </div>
        </form>
      )}
    </div>
  );
}
