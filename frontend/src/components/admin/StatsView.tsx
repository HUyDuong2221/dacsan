'use client';
import { useEffect, useMemo, useState } from 'react';
import { adm } from './ResourceManager';

// Màu trạng thái bài gửi: dùng lại đúng màu chữ của mục Bài gửi (chỉ tô chữ, luôn kèm nhãn)
const STATUS_TONE: Record<string, string> = {
  new: '#5a6b76', reviewing: '#0B4F9C', in_review: '#5b3fa8', approved: '#0a6f80', revision: '#b26a00', rejected: '#c8372d', accepted: '#0e7a4b',
};
const KIND_LABEL = { view: 'Lượt xem trang', read: 'Lượt đọc PDF', download: 'Lượt tải PDF' } as const;
type Kind = keyof typeof KIND_LABEL;

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}
const PRESETS = [
  { key: '7', label: '7 ngày', from: () => daysAgo(6) },
  { key: '30', label: '30 ngày', from: () => daysAgo(29) },
  { key: '90', label: '90 ngày', from: () => daysAgo(89) },
  { key: 'year', label: 'Năm nay', from: () => `${new Date().getFullYear()}-01-01` },
  { key: '365', label: '12 tháng', from: () => daysAgo(364) },
];
const fmtD = (s: string) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
const fmtN = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('vi-VN'));

/** Báo cáo và thống kê: bài gửi, lượt xem/đọc/tải; xuất Excel. */
export default function StatsView({ token, onAuthError }: { token: string; onAuthError: () => void }) {
  const [preset, setPreset] = useState('30');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(iso(new Date()));
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [xls, setXls] = useState(false);

  function fail(e: any) {
    if (e.status === 401) return onAuthError();
    setErr(e.message || 'Có lỗi xảy ra');
  }

  async function load(f = from, t = to) {
    setBusy(true); setErr('');
    try { setD(await adm(`/stats?date_from=${f}&date_to=${t}`, token)); } catch (e) { fail(e); }
    setBusy(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(key: string) {
    const p = PRESETS.find((x) => x.key === key)!;
    const f = p.from(), t = iso(new Date());
    setPreset(key); setFrom(f); setTo(t); load(f, t);
  }

  async function exportXlsx() {
    setXls(true); setErr('');
    try {
      const r = await fetch(`/api/v1/admin/stats/export?date_from=${from}&date_to=${to}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) return onAuthError();
      if (!r.ok) throw new Error('Không xuất được tệp Excel');
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url; a.download = `thong-ke-dac-san_${from}_${to}.xlsx`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { fail(e); }
    setXls(false);
  }

  const s = d?.submissions;
  const tr = d?.traffic;

  return (
    <div className="st">
      <div className="form st-filter" style={{ padding: 16 }}>
        <div className="st-presets" role="group" aria-label="Khoảng thời gian">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className={preset === p.key ? 'on' : ''} aria-pressed={preset === p.key} onClick={() => pick(p.key)}>{p.label}</button>
          ))}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); setPreset(''); load(); }}>
          <label className="st-date">Từ<input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="st-date">Đến<input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn ghost sm" disabled={busy}>Xem</button>
          <button type="button" className="btn sm" style={{ marginLeft: 'auto' }} disabled={xls || !d} onClick={exportXlsx}>{xls ? 'Đang xuất…' : 'Xuất Excel'}</button>
        </form>
      </div>
      {err && <div className="err">{err}</div>}
      {!d && !err && <p className="muted">Đang tải…</p>}

      {d && (
        <>
          <p className="muted st-period">Kỳ báo cáo {fmtD(d.range.from)} – {fmtD(d.range.to)}{busy && ' · đang cập nhật…'}</p>

          <h3 className="st-h">Bài gửi</h3>
          <div className="st-tiles">
            <Tile label="Bài gửi nhận được" value={fmtN(s.total)} />
            <Tile label="Tỷ lệ chấp nhận" value={s.acceptance_rate == null ? '—' : `${s.acceptance_rate.toLocaleString('vi-VN')}%`}
              note={s.decided ? `${s.accepted}/${s.decided} bài đã quyết định` : 'Chưa có bài được quyết định'} />
            <Tile label="Thời gian đến quyết định" value={s.avg_decision_days == null ? '—' : `${s.avg_decision_days.toLocaleString('vi-VN')} ngày`}
              note={s.median_decision_days == null ? 'trung bình' : `trung bình · trung vị ${s.median_decision_days.toLocaleString('vi-VN')} ngày`} />
            <Tile label="Phản hồi đầu tiên" value={s.avg_first_response_days == null ? '—' : `${s.avg_first_response_days.toLocaleString('vi-VN')} ngày`}
              note="trung bình, từ lúc gửi đến thao tác đầu tiên của ban biên tập" />
          </div>
          <div className="st-two">
            <div className="tbl">
              <table className="t">
                <caption className="st-cap">Theo trạng thái hiện tại</caption>
                <thead><tr><th>Trạng thái</th><th className="st-num">Số bài</th></tr></thead>
                <tbody>
                  {s.by_status.map((x: any) => (
                    <tr key={x.status}><td><b style={{ color: STATUS_TONE[x.status] }}>{x.label}</b></td><td className="st-num">{fmtN(x.count)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tbl">
              <table className="t">
                <caption className="st-cap">Theo tháng gửi</caption>
                <thead><tr><th>Tháng</th><th className="st-num">Bài gửi</th><th className="st-num">Chấp nhận</th><th className="st-num">Từ chối</th></tr></thead>
                <tbody>
                  {s.by_month.map((m: any) => (
                    <tr key={m.month}><td>{m.month.slice(5)}/{m.month.slice(0, 4)}</td><td className="st-num">{fmtN(m.total)}</td><td className="st-num">{fmtN(m.accepted)}</td><td className="st-num">{fmtN(m.rejected)}</td></tr>
                  ))}
                </tbody>
              </table>
              {!s.by_month.length && <p className="muted" style={{ padding: 16 }}>Không có bài gửi trong kỳ.</p>}
            </div>
          </div>
          <p className="muted st-note">Thời gian xử lý tính từ ngày gửi đến quyết định Chấp nhận/Từ chối đầu tiên trong lịch sử bài; bài gửi trước khi có lịch sử không có số liệu thời gian.</p>

          <h3 className="st-h">Lượt xem và lượt tải</h3>
          <div className="st-tiles">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <Tile key={k} label={KIND_LABEL[k]} value={fmtN(tr.totals[k])} />)}
          </div>
          <DailyChart daily={tr.daily} />
          <div className="st-two">
            <TopTable title="Bài được xem nhiều nhất" rows={tr.top_articles} article />
            <TopTable title="Số được xem nhiều nhất" rows={tr.top_issues} />
          </div>
          <p className="muted st-note">
            Lượt xem trang = mở trang mục lục của số hoặc trang bài; lượt đọc PDF = mở trình đọc PDF toàn màn hình; lượt tải = bấm Tải về trong trình đọc.
            Mỗi người đọc chỉ được đếm một lần cho cùng một mục trong 30 phút; không tính máy tìm kiếm và số chưa công bố. Số liệu bắt đầu từ ngày có chức năng này.
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="st-tile">
      <span className="st-tl">{label}</span>
      <b className="st-tv">{value}</b>
      {note && <span className="st-tn">{note}</span>}
    </div>
  );
}

function TopTable({ title, rows, article }: { title: string; rows: any[]; article?: boolean }) {
  return (
    <div className="tbl">
      <table className="t">
        <caption className="st-cap">{title}</caption>
        <thead><tr><th>{article ? 'Bài' : 'Số'}</th><th className="st-num">Xem</th><th className="st-num">Đọc PDF</th><th className="st-num">Tải</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {r.slug ? <a href={article ? `/articles/${r.slug}` : `/issues/${r.slug}`} target="_blank" rel="noopener noreferrer">{r.name}</a> : <span className="muted">{r.name}</span>}
                {article && r.issue && <div className="muted">{[r.author, r.issue].filter(Boolean).join(' · ')}</div>}
              </td>
              <td className="st-num">{fmtN(r.view)}</td><td className="st-num">{fmtN(r.read)}</td><td className="st-num">{fmtN(r.download)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="muted" style={{ padding: 16 }}>Chưa có lượt nào trong kỳ.</p>}
    </div>
  );
}

/** Cột theo ngày, một chuỗi (lượt xem trang). Rê chuột/focus vào cột để xem số; có bảng số liệu thay thế. */
function DailyChart({ daily }: { daily: { day: string; view: number; read: number; download: number }[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = useMemo(() => Math.max(1, ...daily.map((x) => x.view)), [daily]);
  const nice = useMemo(() => {
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / step) * step;
  }, [max]);
  const n = daily.length;
  const W = 900, H = 200, PL = 40, PB = 22, PT = 10;
  const bw = (W - PL) / n;
  const barW = Math.max(1, Math.min(28, bw - 2)); // 2px khoảng cách giữa các cột
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const every = Math.ceil(n / 8); // nhãn ngày thưa để không chồng chữ
  const h = hi != null ? daily[hi] : null;

  return (
    <div className="st-chart">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="st-cap" style={{ padding: 0 }}>Lượt xem trang theo ngày</span>
        <button type="button" className="btn ghost sm" aria-pressed={table} onClick={() => setTable(!table)}>{table ? 'Xem biểu đồ' : 'Xem bảng số liệu'}</button>
      </div>
      {table ? (
        <div className="tbl" style={{ maxHeight: 320, overflow: 'auto' }}>
          <table className="t">
            <thead><tr><th>Ngày</th><th className="st-num">Xem trang</th><th className="st-num">Đọc PDF</th><th className="st-num">Tải PDF</th></tr></thead>
            <tbody>{daily.map((x) => <tr key={x.day}><td>{fmtD(x.day)}</td><td className="st-num">{fmtN(x.view)}</td><td className="st-num">{fmtN(x.read)}</td><td className="st-num">{fmtN(x.download)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="st-plot" onMouseLeave={() => setHi(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Biểu đồ cột lượt xem trang theo ngày, cao nhất ${max} lượt`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PL} x2={W} y1={y(t)} y2={y(t)} className="st-grid" />
                <text x={PL - 6} y={y(t) + 4} textAnchor="end" className="st-ax">{t.toLocaleString('vi-VN')}</text>
              </g>
            ))}
            {daily.map((x, i) => {
              const cx = PL + i * bw + bw / 2;
              const top = y(x.view), base = y(0);
              const hgt = Math.max(0, base - top);
              const r = Math.min(4, barW / 2, hgt);
              return (
                <g key={x.day}>
                  {/* vùng rê chuột rộng hơn cột */}
                  <rect x={PL + i * bw} y={PT} width={bw} height={H - PT - PB} fill="transparent" onMouseEnter={() => setHi(i)} />
                  {hgt > 0 && (
                    <path className={`st-bar${hi === i ? ' on' : ''}`} pointerEvents="none"
                      d={`M${cx - barW / 2},${base} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top} H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${base} Z`} />
                  )}
                  {(i % every === 0 || i === n - 1) && (
                    <text x={cx} y={H - 6} textAnchor="middle" className="st-ax">{x.day.slice(8, 10)}/{x.day.slice(5, 7)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {h && hi != null && (
            <div className="st-tip" style={{ left: `${((PL + hi * bw + bw / 2) / W) * 100}%` }} role="status">
              <b>{fmtD(h.day)}</b>
              <span>Xem trang: {fmtN(h.view)}</span>
              <span>Đọc PDF: {fmtN(h.read)}</span>
              <span>Tải PDF: {fmtN(h.download)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
