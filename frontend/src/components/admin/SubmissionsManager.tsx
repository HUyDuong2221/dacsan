'use client';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { adm } from './ResourceManager';
import Portal from '../ui/Portal';

// Thứ tự xử lý: Mới nhận → Đang xét duyệt → Phân công phản biện → Chấp nhận / Yêu cầu sửa / Từ chối → Đã nhận đăng
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'Mới nhận', color: '#5a6b76' },
  reviewing: { label: 'Đang xét duyệt', color: '#0B4F9C' },
  in_review: { label: 'Phân công phản biện', color: '#5b3fa8' },
  approved: { label: 'Chấp nhận', color: '#0a6f80' },
  revision: { label: 'Yêu cầu sửa', color: '#b26a00' },
  rejected: { label: 'Từ chối', color: '#c8372d' },
  accepted: { label: 'Đã nhận đăng', color: '#0e7a4b' },
};

const REVIEW_TONE: Record<string, string> = {
  invited: '#5a6b76', accepted: '#0B4F9C', declined: '#8a8f98', submitted: '#0e7a4b', overdue: '#c8372d',
};
const REC_TONE: Record<string, string> = { accept: '#0e7a4b', minor: '#0a6f80', major: '#b26a00', reject: '#c8372d' };

type Fail = (e: any) => void;
type TocDraft = { issues: any[]; fields: any[]; issue_id: number | ''; field_id: number | ''; page_label: string };

// so tên chuyên mục không phân biệt hoa thường/dấu (giống slugify ở backend)
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

function fmtD(iso?: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtDT(iso?: string | null) {
  if (!iso) return '—';
  const t = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

function inDays(n: number) {
  const t = new Date();
  t.setDate(t.getDate() + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export default function SubmissionsManager({ token, role, onAuthError }: { token: string; role: string; onAuthError: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [sel, setSel] = useState<any | null>(null);
  const [tab, setTab] = useState<'info' | 'reviews' | 'history'>('info');
  const [dec, setDec] = useState<{ status: string; note: string } | null>(null);
  const [toc, setToc] = useState<TocDraft | null>(null);
  const [ver, setVer] = useState(0); // tăng để tải lại tab Phản biện/Lịch sử sau khi trạng thái đổi
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const fail = useCallback((e: any) => (e.status === 401 ? onAuthError() : setErr(e.message)), [onAuthError]);
  const load = useCallback(async () => {
    try { setRows(await adm(`/submissions${filter ? `?status=${filter}` : ''}`, token)); setErr(''); } catch (e) { fail(e); }
  }, [filter, token, fail]);
  useEffect(() => { load(); }, [load]);

  function open(s: any) { setSel({ ...s }); setTab('info'); setDec(null); setToc(null); setErr(''); setMsg(''); }

  async function openToc() {
    setErr(''); setMsg('');
    try {
      const [issues, fields] = await Promise.all([adm('/issues', token), adm('/fields', token)]);
      const open = issues.filter((i: any) => !i.published);
      const match = fields.find((f: any) => norm(f.name) === norm(sel.field_name || ''));
      setToc({ issues: open, fields, issue_id: open[0]?.id ?? '', field_id: match?.id ?? '', page_label: '' });
    } catch (e) { fail(e); }
  }

  async function addToToc() {
    if (!toc?.issue_id) return setErr('Vui lòng chọn số đặc san');
    setErr('');
    try {
      const s = await adm(`/submissions/${sel.id}/toc-entry`, token, {
        method: 'POST',
        body: JSON.stringify({ issue_id: Number(toc.issue_id), field_id: toc.field_id === '' ? null : Number(toc.field_id), page_label: toc.page_label }),
      });
      setSel((cur: any) => ({ ...cur, toc_entry: s.toc_entry }));
      setToc(null); setVer((v) => v + 1); setMsg(`Đã đưa vào mục lục ${s.toc_entry.issue_label}`); load();
    } catch (e) { fail(e); }
  }

  // Phân công phản biện có thể đổi trạng thái bài: lấy lại bài từ danh sách mới
  const refreshSel = useCallback(async () => {
    try {
      const list = await adm('/submissions', token);
      const cur = list.find((x: any) => x.id === sel?.id);
      if (cur) setSel((s: any) => s && ({ ...s, status: cur.status, status_label: cur.status_label, next_statuses: cur.next_statuses }));
      load();
    } catch (e) { fail(e); }
  }, [token, sel?.id, load, fail]);

  async function save() {
    setErr(''); setMsg('');
    try {
      await adm(`/submissions/${sel.id}`, token, {
        method: 'PUT', body: JSON.stringify({ note_public: sel.note_public || '', note_internal: sel.note_internal || '' }),
      });
      setMsg('Đã lưu'); setSel(null); load();
    } catch (e) { fail(e); }
  }

  async function decide() {
    if (!dec) return;
    if (!dec.status) return setErr('Vui lòng chọn quyết định');
    if (!dec.note.trim()) return setErr('Vui lòng nhập ghi chú cho quyết định');
    setErr('');
    try {
      const s = await adm(`/submissions/${sel.id}/decision`, token, { method: 'POST', body: JSON.stringify(dec) });
      setSel((cur: any) => ({ ...cur, ...s, note_public: cur.note_public, note_internal: cur.note_internal }));
      setDec(null); setVer((v) => v + 1); setMsg(`Đã chuyển sang “${s.status_label}”`); load();
    } catch (e) { fail(e); }
  }

  async function remove(s: any) {
    if (!confirm(`Xóa vĩnh viễn bài gửi “${s.title}” và bản thảo đính kèm?`)) return;
    try { await adm(`/submissions/${s.id}`, token, { method: 'DELETE' }); setSel(null); setMsg('Đã xóa'); load(); } catch (e) { fail(e); }
  }

  async function download(s: any) {
    const r = await fetch(`/api/v1/admin/submissions/${s.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return setErr('Không tải được bản thảo');
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url; a.download = s.file_name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const nexts: { value: string; label: string }[] = sel?.next_statuses || [];

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <select className="input" style={{ maxWidth: 240 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="muted">{rows.length} bài gửi</span>
      </div>
      {!sel && err && <div className="err">{err}</div>}
      {msg && !sel && <div className="ok">{msg}</div>}
      <div className="tbl">
        <table className="t">
          <thead><tr><th>Ngày gửi</th><th>Mã</th><th>Tác giả</th><th>Tiêu đề</th><th>Chuyên mục đề xuất</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{(s.created_at || '').slice(0, 10)}</td>
                <td className="mono">{s.code}</td>
                <td>{s.name}<div className="muted">{s.email}</div></td>
                <td>{s.title}</td>
                <td>{s.field_name}</td>
                <td><b style={{ color: STATUS[s.status]?.color }}>{s.status_label}</b></td>
                <td><button className="btn ghost sm" onClick={() => open(s)}>Xử lý</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="muted">Chưa có bài gửi.</p>}
      </div>

      {sel && (
        <Portal>
          <div className="drawer-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="drawer-bg" onClick={() => setSel(null)} />
            <div className="modal-card adm-main" style={{ position: 'relative', background: 'var(--bg)', width: 'min(960px, 96vw)', maxHeight: '94vh', overflow: 'auto', padding: 24, boxShadow: '0 0 40px rgba(23,37,47,.25)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="kicker">Bài gửi · mã {sel.code}</div>
                <button className="btn ghost sm" onClick={() => setSel(null)}>✕ Đóng</button>
              </div>
              <h2 className="serif" style={{ fontSize: 24, margin: '8px 0 12px' }}>{sel.title}</h2>
              <div className="row sub-status" style={{ marginBottom: 16 }}>
                <span className="muted">Trạng thái:</span>
                <span className="sub-badge" style={{ color: STATUS[sel.status]?.color, borderColor: STATUS[sel.status]?.color }}>{sel.status_label}</span>
                <button className="btn sm" style={{ marginLeft: 'auto' }} disabled={!nexts.length}
                  title={nexts.length ? '' : 'Bài đã ở trạng thái cuối'}
                  onClick={() => { setErr(''); setDec({ status: nexts[0]?.value || '', note: '' }); }}>
                  Quyết định biên tập
                </button>
              </div>

              <div className="sub-tabs" role="tablist">
                {([['info', 'Thông tin'], ['reviews', 'Phản biện'], ['history', 'Lịch sử']] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setErr(''); setMsg(''); }}>{l}</button>
                ))}
              </div>
              {err && !dec && !toc && <div className="err">{err}</div>}
              {msg && <div className="ok">{msg}</div>}

              {tab === 'info' && (
                <>
                  <p className="muted" style={{ lineHeight: 1.7 }}>
                    <b>{sel.name}</b> · <a href={`mailto:${sel.email}`}>{sel.email}</a>{sel.phone && ` · ${sel.phone}`}<br />
                    {sel.organization && <>Đơn vị: {sel.organization}<br /></>}
                    Chuyên mục đề xuất: {sel.field_name || '—'} · Gửi lúc {(sel.created_at || '').replace('T', ' ').slice(0, 16)}
                  </p>
                  <div className="leadbox" style={{ maxWidth: 'none', padding: 16 }}>
                    <div className="kicker" style={{ marginBottom: 8 }}>Tóm tắt</div>
                    <p style={{ fontStyle: 'normal', fontFamily: 'var(--sans)', fontSize: 15, whiteSpace: 'pre-wrap' }}>{sel.abstract}</p>
                  </div>
                  <div className="row" style={{ margin: '0 0 16px' }}>
                    <button className="btn" onClick={() => download(sel)}>Tải bản thảo ({sel.file_name})</button>
                  </div>
                  {sel.status === 'accepted' && (
                    <div className={`sub-toc${sel.toc_entry ? ' done' : ''}`}>
                      {sel.toc_entry ? (
                        <div>
                          <b>Đã có trong mục lục {sel.toc_entry.issue_label}</b>
                          {sel.toc_entry.page_label && <> · {sel.toc_entry.page_label}</>}
                          <div className="muted">
                            {sel.toc_entry.issue_published
                              ? 'Số đã công bố: bài đang hiện trên trang công khai.'
                              : 'Số chưa công bố. Nhập số trang, tóm tắt, toàn văn ở mục lục của số, rồi công bố số.'}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <b>Bài đã nhận đăng nhưng chưa có trong mục lục.</b>
                            <div className="muted">Tạo sẵn một dòng mục lục (tiêu đề, tác giả, chuyên mục) trong một số chưa công bố.</div>
                          </div>
                          <button className="btn sm" onClick={openToc}>Đưa vào mục lục</button>
                        </>
                      )}
                    </div>
                  )}
                  <div className="form" style={{ gridTemplateColumns: '1fr', padding: 16 }}>
                    <label>Phản hồi gửi tác giả <small className="muted">(tác giả thấy khi tra cứu bằng mã; hệ thống chưa tự gửi email)</small>
                      <textarea className="input" rows={3} value={sel.note_public || ''} onChange={(e) => setSel({ ...sel, note_public: e.target.value })} />
                    </label>
                    <label>Ghi chú nội bộ <small className="muted">(chỉ ban biên tập thấy)</small>
                      <textarea className="input" rows={3} value={sel.note_internal || ''} onChange={(e) => setSel({ ...sel, note_internal: e.target.value })} />
                    </label>
                  </div>
                  <div className="row">
                    <button className="btn" onClick={save}>Lưu</button>
                    <button className="btn ghost" onClick={() => setSel(null)}>Hủy</button>
                    {role === 'admin' && <button className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => remove(sel)}>Xóa bài gửi</button>}
                  </div>
                </>
              )}
              {tab === 'reviews' && <ReviewsTab key={`r${ver}`} sub={sel} token={token} fail={fail} onChanged={refreshSel} />}
              {tab === 'history' && <HistoryTab key={`h${ver}`} sid={sel.id} token={token} fail={fail} />}
            </div>

            {dec && (
              <div className="drawer-wrap" style={{ alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
                <div className="drawer-bg" onClick={() => setDec(null)} />
                <div className="adm-main sub-dialog" role="dialog" aria-modal="true" aria-labelledby="sub-dec-h">
                  <h3 id="sub-dec-h" className="serif">Quyết định biên tập</h3>
                  <p className="muted" style={{ margin: '0 0 14px' }}>
                    Hiện tại: <b style={{ color: STATUS[sel.status]?.color }}>{sel.status_label}</b>. Quyết định và ghi chú được lưu vào lịch sử của bài.
                  </p>
                  <div className="sub-choices" role="radiogroup" aria-label="Chọn quyết định">
                    {nexts.map((n) => (
                      <label key={n.value} className={dec.status === n.value ? 'on' : ''}>
                        <input type="radio" name="sub-dec" value={n.value} checked={dec.status === n.value} onChange={() => setDec({ ...dec, status: n.value })} />
                        <span style={{ color: STATUS[n.value]?.color }}>{n.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="form" style={{ gridTemplateColumns: '1fr', padding: 16, marginBottom: 14 }}>
                    <label>Ghi chú * <small className="muted">(bắt buộc; lý do hoặc căn cứ của quyết định)</small>
                      <textarea className="input" rows={4} autoFocus value={dec.note} onChange={(e) => setDec({ ...dec, note: e.target.value })} />
                    </label>
                  </div>
                  {err && <div className="err">{err}</div>}
                  <div className="row">
                    <button className="btn" onClick={decide} disabled={!dec.status || !dec.note.trim()}>Xác nhận</button>
                    <button className="btn ghost" onClick={() => setDec(null)}>Hủy</button>
                  </div>
                </div>
              </div>
            )}

            {toc && (
              <div className="drawer-wrap" style={{ alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
                <div className="drawer-bg" onClick={() => setToc(null)} />
                <div className="adm-main sub-dialog" role="dialog" aria-modal="true" aria-labelledby="sub-toc-h">
                  <h3 id="sub-toc-h" className="serif">Đưa vào mục lục</h3>
                  <p className="muted" style={{ margin: '0 0 14px' }}>
                    Tạo dòng mục lục “{sel.title}”, tác giả {sel.name}. Chỉ chọn được số <b>chưa công bố</b>; bài hiện trên trang công khai khi số được công bố.
                  </p>
                  {toc.issues.length ? (
                    <div className="form" style={{ gridTemplateColumns: '1fr', padding: 16, marginBottom: 14 }}>
                      <label>Số đặc san *
                        <select className="input" value={toc.issue_id} onChange={(e) => setToc({ ...toc, issue_id: e.target.value ? Number(e.target.value) : '' })}>
                          {toc.issues.map((i: any) => <option key={i.id} value={i.id}>{i.label}{i.title ? ` · ${i.title}` : ''}</option>)}
                        </select>
                      </label>
                      <label>Chuyên mục <small className="muted">(đề xuất của tác giả: {sel.field_name || '—'})</small>
                        <select className="input" value={toc.field_id} onChange={(e) => setToc({ ...toc, field_id: e.target.value ? Number(e.target.value) : '' })}>
                          <option value="">— Chưa xếp chuyên mục —</option>
                          {toc.fields.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </label>
                      <label>Trang <small className="muted">(tùy chọn, ví dụ “tr. 45”; có thể nhập sau)</small>
                        <input className="input" maxLength={40} value={toc.page_label} onChange={(e) => setToc({ ...toc, page_label: e.target.value })} />
                      </label>
                    </div>
                  ) : (
                    <div className="err">Chưa có số đặc san nào chưa công bố. Hãy tạo số mới ở mục Số đặc san trước.</div>
                  )}
                  {err && <div className="err">{err}</div>}
                  <div className="row">
                    <button className="btn" onClick={addToToc} disabled={!toc.issue_id}>Tạo dòng mục lục</button>
                    <button className="btn ghost" onClick={() => setToc(null)}>Hủy</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Portal>
      )}
    </div>
  );
}

function ReviewsTab({ sub, token, fail, onChanged }: { sub: any; token: string; fail: Fail; onChanged: () => void }) {
  const [list, setList] = useState<any[] | null>(null);
  const [form, setForm] = useState<{ reviewer_name: string; reviewer_email: string; due_date: string } | null>(null);
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const base = `/submissions/${sub.id}/reviews`;
  const canAssign = ['new', 'reviewing', 'in_review'].includes(sub.status);

  const load = useCallback(async () => {
    try { setList(await adm(base, token)); } catch (e) { fail(e); }
  }, [base, token, fail]);
  useEffect(() => { load(); }, [load]);

  function showLink(r: any) {
    setLink({ name: r.reviewer_name, url: `${window.location.origin}${r.review_url}` });
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setNote('');
    try {
      const r = await adm(base, token, { method: 'POST', body: JSON.stringify(form) });
      setForm(null); showLink(r); load(); onChanged();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  async function remind(r: any) {
    setNote('');
    try {
      const d = await adm(`${base}/${r.id}/remind`, token, { method: 'POST' });
      setNote(`Đã ghi nhận lần nhắc thứ ${d.reminder_count} cho ${r.reviewer_name} (chưa gửi email tự động, vui lòng liên hệ trực tiếp).`);
      load();
    } catch (e) { fail(e); }
  }

  async function relink(r: any) {
    if (!confirm(`Tạo liên kết phản biện mới cho ${r.reviewer_name}? Liên kết cũ sẽ không dùng được nữa.`)) return;
    try { showLink(await adm(`${base}/${r.id}/link`, token, { method: 'POST' })); } catch (e) { fail(e); }
  }

  const isOpen = (r: any) => ['invited', 'accepted', 'overdue'].includes(r.status);

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="muted">{list ? `${list.length} phản biện viên` : 'Đang tải…'}</span>
        {!form && (
          <button className="btn sm" style={{ marginLeft: 'auto' }} disabled={!canAssign}
            title={canAssign ? '' : 'Chỉ phân công khi bài đang Mới nhận, Đang xét duyệt hoặc Phân công phản biện'}
            onClick={() => { setLink(null); setForm({ reviewer_name: '', reviewer_email: '', due_date: inDays(21) }); }}>
            + Phân công phản biện
          </button>
        )}
      </div>

      {form && (
        <form className="form" onSubmit={assign} style={{ padding: 16 }}>
          <label>Họ tên phản biện viên *
            <input className="input" required minLength={2} maxLength={200} value={form.reviewer_name} onChange={(e) => setForm({ ...form, reviewer_name: e.target.value })} />
          </label>
          <label>Email *
            <input className="input" type="email" required maxLength={255} value={form.reviewer_email} onChange={(e) => setForm({ ...form, reviewer_email: e.target.value })} />
          </label>
          <label>Hạn phản biện *
            <input className="input" type="date" required min={inDays(0)} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </label>
          <div className="full row">
            <button className="btn" disabled={busy}>{busy ? 'Đang phân công…' : 'Phân công'}</button>
            <button type="button" className="btn ghost" onClick={() => setForm(null)}>Hủy</button>
          </div>
        </form>
      )}

      {link && (
        <div className="sub-link">
          <div><b>Link phản biện cho {link.name}</b> <small className="muted">(chỉ hiện một lần; hệ thống chưa tự gửi email, hãy gửi liên kết này cho phản biện viên)</small></div>
          <div className="row">
            <input className="input mono" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn sm" onClick={() => navigator.clipboard?.writeText(link.url).then(() => setNote('Đã sao chép liên kết'))}>Sao chép</button>
            <button className="btn ghost sm" onClick={() => setLink(null)}>Ẩn</button>
          </div>
        </div>
      )}
      {note && <div className="ok">{note}</div>}

      {list && list.length > 0 && (
        <div className="tbl">
          <table className="t">
            <thead><tr><th>Phản biện viên</th><th>Mời ngày</th><th>Hạn</th><th>Trạng thái</th><th>Khuyến nghị</th><th>Đã nhắc</th><th className="t-actcell" /></tr></thead>
            <tbody>
              {list.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td>{r.reviewer_name}<div className="muted">{r.reviewer_email}</div></td>
                    <td>{fmtD(r.invited_at)}</td>
                    <td style={{ color: r.status === 'overdue' ? REVIEW_TONE.overdue : undefined }}>{fmtD(r.due_date)}</td>
                    <td><b style={{ color: REVIEW_TONE[r.status] }}>{r.status_label}</b></td>
                    <td>{r.recommendation_label ? <b style={{ color: REC_TONE[r.recommendation] }}>{r.recommendation_label}</b> : <span className="muted">—</span>}</td>
                    <td>{r.reminder_count ? <>{r.reminder_count} lần<div className="muted">{fmtDT(r.last_reminded_at)}</div></> : <span className="muted">—</span>}</td>
                    <td className="t-actcell">
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        {r.status === 'submitted' && (
                          <button className="btn ghost sm" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Ẩn phiếu' : 'Xem phiếu'}</button>
                        )}
                        {isOpen(r) && <button className="btn ghost sm" onClick={() => remind(r)}>Nhắc hạn</button>}
                        {isOpen(r) && <button className="btn ghost sm" onClick={() => relink(r)}>Liên kết mới</button>}
                      </div>
                    </td>
                  </tr>
                  {open === r.id && (
                    <tr className="sub-review-row">
                      <td colSpan={7}>
                        <div className="sub-review">
                          <div className="muted">Nộp lúc {fmtDT(r.submitted_at)}</div>
                          <div className="kicker">Nhận xét gửi tác giả</div>
                          <p>{r.form_data?.comments_author || '—'}</p>
                          <div className="kicker">Ý kiến riêng cho ban biên tập</div>
                          <p>{r.form_data?.comments_editor || '—'}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list && !list.length && !form && <p className="muted">Chưa phân công phản biện viên nào.</p>}
    </div>
  );
}

function HistoryTab({ sid, token, fail }: { sid: number; token: string; fail: Fail }) {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => {
    adm(`/submissions/${sid}/history`, token).then(setList).catch(fail);
  }, [sid, token, fail]);
  if (!list) return <p className="muted">Đang tải…</p>;
  if (!list.length) return <p className="muted">Chưa có lịch sử (bài gửi trước khi có chức năng này).</p>;
  return (
    <ol className="sub-hist">
      {[...list].reverse().map((h) => {
        const changed = h.from_status !== h.to_status;
        const who = h.changed_by_name || (h.from_status ? 'Phản biện viên' : 'Tác giả');
        return (
          <li key={h.id} className={changed ? 'chg' : ''}>
            <div className="sub-hist-top">
              <span className="mono">{fmtDT(h.changed_at)}</span>
              <span className="muted">· {who}</span>
            </div>
            {changed && (
              <div className="sub-hist-st">
                {h.from_label && <><span style={{ color: STATUS[h.from_status]?.color }}>{h.from_label}</span> → </>}
                <b style={{ color: STATUS[h.to_status]?.color }}>{h.to_label}</b>
              </div>
            )}
            {h.note && <p>{h.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
