'use client';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const RichText = dynamic(() => import('./RichText'), { ssr: false, loading: () => <div className="rte-load">Đang tải trình soạn thảo…</div> });

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'bool' | 'date' | 'select' | 'file' | 'password' | 'richtext';
  options?: { value: string; label: string }[];
  optionsFrom?: { resource: string; labelKey: string; valueKey?: string };
  list?: boolean;
  full?: boolean;
  required?: boolean;
  hint?: string;
  def?: any; // giá trị mặc định khi thêm mới
};
export type ResourceDef = { key: string; title: string; fields: FieldDef[]; readonly?: boolean; noDelete?: boolean; addLabel?: string; editLabel?: string };

export async function adm(path: string, token: string, init: RequestInit = {}) {
  const isForm = init.body instanceof FormData;
  const r = await fetch(`/api/v1/admin${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...(init.headers || {}) },
  });
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = data.detail;
    const e: any = new Error(typeof d === 'string' ? d : 'Có lỗi xảy ra');
    e.status = r.status;
    throw e;
  }
  return data;
}

export default function ResourceManager({ res, token, onAuthError, rowExtra, query, defaults }: { res: ResourceDef; token: string; onAuthError: () => void; rowExtra?: (row: any) => React.ReactNode; query?: string; defaults?: Record<string, any> }) {
  const [rows, setRows] = useState<any[]>([]);
  const [opts, setOpts] = useState<Record<string, { value: string; label: string }[]>>({});
  const [edit, setEdit] = useState<any | null>(null);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const fail = useCallback((e: any) => {
    if (e.status === 401) onAuthError();
    else setErr(e.message);
  }, [onAuthError]);

  const load = useCallback(async () => {
    try { setRows(await adm(`/${res.key}${query ? `?${query}` : ''}`, token)); setErr(''); } catch (e) { fail(e); }
  }, [res.key, token, fail]);

  useEffect(() => {
    setEdit(null); setFilter(''); setMsg('');
    load();
    res.fields.filter((f) => f.optionsFrom).forEach(async (f) => {
      try {
        const data = await adm(`/${f.optionsFrom!.resource}`, token);
        setOpts((o) => ({ ...o, [f.key]: data.map((d: any) => ({ value: String(d[f.optionsFrom!.valueKey || 'id']), label: d[f.optionsFrom!.labelKey] })) }));
      } catch (e) { fail(e); }
    });
  }, [res.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const listFields = res.fields.filter((f) => f.list);
  const show = (f: FieldDef, v: any) => {
    if (f.type === 'bool') return v ? 'Có' : '';
    if (f.optionsFrom) return opts[f.key]?.find((o) => o.value === String(v))?.label ?? v;
    if (f.options) return f.options.find((o) => o.value === String(v))?.label ?? v;
    return v == null ? '' : String(v).slice(0, 90);
  };
  const shown = filter
    ? rows.filter((r) => listFields.some((f) => String(show(f, r[f.key])).toLowerCase().includes(filter.toLowerCase())))
    : rows;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      const body = JSON.stringify(edit);
      if (edit.id) await adm(`/${res.key}/${edit.id}`, token, { method: 'PUT', body });
      else await adm(`/${res.key}`, token, { method: 'POST', body });
      setEdit(null); setMsg('Đã lưu'); load();
    } catch (e) { fail(e); }
  }

  async function remove(row: any) {
    if (!confirm('Xóa mục này? Không thể hoàn tác.')) return;
    try { await adm(`/${res.key}/${row.id}`, token, { method: 'DELETE' }); setMsg('Đã xóa'); load(); } catch (e) { fail(e); }
  }

  async function upload(key: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const d = await adm('/upload', token, { method: 'POST', body: fd });
      setEdit((x: any) => ({ ...x, [key]: d.url }));
    } catch (e) { fail(e); }
  }

  const blank = () => ({
    ...Object.fromEntries(res.fields.map((f) => [f.key, f.def !== undefined ? f.def : f.type === 'bool' ? false : f.type === 'select' && f.options ? f.options[0].value : f.key === 'sort_order' ? rows.length : ''])),
    ...(defaults || {}),
  });

  return (
    <div>
      <div className="tbar">
        <div className="tbar-search">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input className="input" type="search" aria-label="Lọc nhanh" placeholder="Lọc nhanh…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {filter && <button type="button" className="tbar-clear" aria-label="Xóa bộ lọc" onClick={() => setFilter('')}>×</button>}
        </div>
        {!res.readonly && <button className="btn" onClick={() => setEdit(blank())}>+ {res.addLabel || 'Thêm mới'}</button>}
        <span className="tbar-count" aria-live="polite">{shown.length}/{rows.length} mục</span>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      {msg && <div className="ok" role="status">{msg}</div>}

      {edit && (
        <form className="form" onSubmit={save}>
          <h3 className="full serif" style={{ fontSize: 20 }}>
            {edit.id ? res.editLabel || 'Sửa' : res.addLabel || 'Thêm mới'}
          </h3>
          {res.fields.map((f) => (
            <FieldWrap key={f.key} rich={f.type === 'richtext'} className={f.full || f.type === 'textarea' || f.type === 'richtext' ? 'full' : ''}>
              <span>{f.label}{f.required && ' *'}</span>
              {f.type === 'richtext' ? (
                <RichText key={edit.id ?? 'new'} token={token} value={edit[f.key] ?? ''} onChange={(html) => setEdit((x: any) => ({ ...x, [f.key]: html }))} />
              ) : f.type === 'textarea' ? (
                <textarea className="input" rows={f.key === 'body' ? 18 : 4} value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
              ) : f.type === 'bool' ? (
                <input type="checkbox" checked={!!edit[f.key]} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.checked })} style={{ width: 20, height: 20 }} />
              ) : f.type === 'select' || f.optionsFrom ? (
                <select className="input" required={f.required} value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })}>
                  {!f.required && <option value="">— không chọn —</option>}
                  {(f.options || opts[f.key] || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'file' ? (
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input className="input" value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} placeholder="/media/… hoặc dán liên kết" />
                  <input type="file" onChange={(e) => e.target.files?.[0] && upload(f.key, e.target.files[0])} />
                </div>
              ) : (
                <input className="input" type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'password' ? 'password' : 'text'} required={f.required}
                  autoComplete={f.type === 'password' ? 'new-password' : undefined}
                  value={edit[f.key] ?? ''} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
              )}
              {f.hint && <small className="muted">{f.hint}</small>}
            </FieldWrap>
          ))}
          <div className="full row">
            <button className="btn">Lưu</button>
            <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Hủy</button>
          </div>
        </form>
      )}

      <div className="tbl">
        <table className="t">
          <thead><tr><th>ID</th>{listFields.map((f) => <th key={f.key}>{f.label}</th>)}<th /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.id}</td>
                {listFields.map((f) => <td key={f.key}>{f.type === 'bool' ? (r[f.key] ? <span className="pill">Có</span> : '') : show(f, r[f.key])}</td>)}
                <td>
                  <div className="t-act">
                    {rowExtra && rowExtra(r)}
                    {!res.readonly && <button className="btn ghost sm" onClick={() => setEdit({ ...r })}>Sửa</button>}
                    {!res.noDelete && <button className="btn danger sm" onClick={() => remove(r)}>Xóa</button>}
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={listFields.length + 2} className="t-empty">
                <b>{rows.length ? 'Không có mục khớp bộ lọc' : 'Chưa có mục nào'}</b>
                {rows.length ? 'Thử từ khóa khác hoặc xóa bộ lọc.' : res.readonly ? '' : `Bấm “${res.addLabel || 'Thêm mới'}” để tạo mục đầu tiên.`}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Ô trình soạn thảo dùng <div>: nút trong <label> sẽ bị bấm nhầm khi click vào nhãn.
function FieldWrap({ rich, className, children }: { rich: boolean; className: string; children: React.ReactNode }) {
  return rich ? <div className={`fld ${className}`}>{children}</div> : <label className={className}>{children}</label>;
}
