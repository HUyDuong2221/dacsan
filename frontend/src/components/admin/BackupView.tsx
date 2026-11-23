'use client';
import { useEffect, useRef, useState } from 'react';
import { adm } from './ResourceManager';

function fmtDT(iso?: string | null) {
  if (!iso) return '—';
  const t = new Date(iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')); // "+0700" -> "+07:00"
  if (isNaN(t.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`;
}
function fmtSize(b: number) {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(b / 1024)).toLocaleString('vi-VN')} KB`;
}

/** Hệ thống › Sao lưu: trạng thái sao lưu định kỳ, sao lưu ngay, tải bản sao lưu; trạng thái máy quét mã độc. */
export default function BackupView({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function fail(e: any) {
    if (e.status === 401) return onAuthError();
    setErr(e.message || 'Có lỗi xảy ra'); setMsg('');
  }
  async function load() {
    try { const x = await adm('/backups', token); setD(x); return x; } catch (e) { fail(e); }
  }
  useEffect(() => {
    load();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runNow() {
    setErr(''); setMsg('');
    try {
      await adm('/backups/run', token, { method: 'POST' });
      const before = d?.status?.time;
      setWaiting(true);
      setMsg('Đã gửi yêu cầu. Sao lưu bắt đầu trong vòng 20 giây; trang tự cập nhật khi xong.');
      let n = 0;
      timer.current = setInterval(async () => {
        n += 1;
        const x = await load();
        if ((x?.status?.time && x.status.time !== before) || n > 60) {
          if (timer.current) clearInterval(timer.current);
          setWaiting(false);
          setMsg(x?.status?.time !== before ? (x.status.ok ? 'Sao lưu xong.' : 'Sao lưu lỗi, xem thông báo bên trên.') : 'Chưa thấy kết quả. Kiểm tra container backup có đang chạy không.');
        }
      }, 5000);
    } catch (e) { fail(e); }
  }

  async function download(name: string) {
    setErr('');
    try {
      const r = await adm(`/backups/${encodeURIComponent(name)}/download-link`, token, { method: 'POST' });
      window.location.href = r.url; // trình duyệt tải thẳng (tệp lớn), link hết hạn sau 5 phút
    } catch (e) { fail(e); }
  }

  if (!d) return err ? <div className="err">{err}</div> : <p className="muted">Đang tải…</p>;
  const st = d.status;
  const sc = d.scanner;

  return (
    <div>
      <div className="st-tiles">
        <div className="st-tile">
          <span className="st-tl">Bản sao lưu gần nhất</span>
          <b className="st-tv" style={{ fontSize: 22 }}>{st ? fmtDT(st.time) : 'Chưa có'}</b>
          <span className="st-tn">
            {st ? (st.ok ? <span style={{ color: '#0e7a4b', fontWeight: 600 }}>✓ Thành công · {fmtSize(st.size)}</span> : <span style={{ color: 'var(--c-red)', fontWeight: 600 }}>✕ Lỗi</span>) : 'Container backup chưa chạy lần nào'}
          </span>
        </div>
        <div className="st-tile">
          <span className="st-tl">Số bản đang lưu</span>
          <b className="st-tv">{d.files.length}</b>
          <span className="st-tn">Tự sao lưu hằng ngày lúc 02:00, giữ các bản mới nhất (cấu hình BACKUP_AT, BACKUP_KEEP)</span>
        </div>
        <div className="st-tile">
          <span className="st-tl">Quét mã độc tệp tải lên</span>
          <b className="st-tv" style={{ fontSize: 22, color: !sc.enabled ? 'var(--c-mute)' : sc.online ? '#0e7a4b' : 'var(--c-red)' }}>
            {!sc.enabled ? 'Đang tắt' : sc.online ? 'Đang hoạt động' : 'Không kết nối được'}
          </b>
          <span className="st-tn">
            {!sc.enabled ? 'Chưa đặt CLAMAV_HOST: tệp tải lên không được quét.'
              : sc.online ? 'ClamAV quét mọi tệp admin tải lên và bản thảo tác giả gửi.'
              : sc.fail_open ? 'Máy quét lỗi: tệp vẫn được nhận nhưng KHÔNG được quét (CLAMAV_FAIL_OPEN=true).'
              : 'Máy quét đang khởi động hoặc lỗi: mọi tệp tải lên bị từ chối cho tới khi máy quét hoạt động lại.'}
          </span>
        </div>
      </div>

      {!d.enabled && <div className="err">Backend chưa được gắn thư mục sao lưu (volume <code>backups</code>). Cập nhật tệp docker compose rồi khởi động lại.</div>}
      {d.enabled && d.stale && <div className="err" role="alert">Hơn 30 giờ chưa có bản sao lưu nào. Kiểm tra container <code>backup</code> (docker compose ps / logs backup).</div>}
      {st && !st.ok && <div className="err" role="alert">Lần sao lưu {fmtDT(st.time)} lỗi: {st.message}</div>}
      {err && <div className="err" role="alert">{err}</div>}
      {msg && <div className="ok" role="status">{msg}</div>}

      <div className="tbar">
        <button className="btn" disabled={waiting || !d.enabled || d.requested} onClick={runNow}>
          {waiting || d.requested ? 'Đang chờ sao lưu…' : 'Sao lưu ngay'}
        </button>
        <span className="tbar-count">{d.files.length} bản</span>
      </div>
      <div className="tbl">
        <table className="t">
          <thead><tr><th>Bản sao lưu</th><th>Thời điểm</th><th className="st-num">Dung lượng</th><th className="t-actcell" /></tr></thead>
          <tbody>
            {d.files.map((f: any) => (
              <tr key={f.name}>
                <td className="mono">{f.name}</td>
                <td>{fmtDT(f.created_at)}</td>
                <td className="st-num">{fmtSize(f.size)}</td>
                <td className="t-actcell"><div className="t-act"><button className="btn ghost sm" onClick={() => download(f.name)}>Tải về</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.files.length && <p className="muted" style={{ padding: 16 }}>Chưa có bản sao lưu nào.</p>}
      </div>
      <p className="muted st-note">
        Mỗi bản gồm cơ sở dữ liệu, ảnh/PDF đã tải lên và bản thảo tác giả gửi (không công khai), nên chứa dữ liệu nhạy cảm: chỉ tải về máy tin cậy, lưu ở nơi an toàn.
        Bản sao lưu nằm cùng máy chủ với dữ liệu; hãy định kỳ tải một bản về nơi khác. Hướng dẫn khôi phục: docs/SAO-LUU.md. Mọi lần tải đều được ghi vào Nhật ký hoạt động.
      </p>
    </div>
  );
}
