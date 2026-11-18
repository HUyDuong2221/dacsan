'use client';
import { useCallback, useEffect, useState } from 'react';
import { adm } from './ResourceManager';

type Sec = { id: number; name: string; count: number };

/** Sửa tên / gộp các phần (chuyên mục) đang dùng trong mục lục của một số. */
export default function SectionsEditor({ issue, token, onAuthError, onChanged, version }: { issue: any; token: string; onAuthError: () => void; onChanged: () => void; version: number }) {
  const [secs, setSecs] = useState<Sec[]>([]);
  const [others, setOthers] = useState<{ id: number; name: string }[]>([]);
  const [names, setNames] = useState<Record<number, string>>({});
  const [target, setTarget] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const fail = useCallback((e: any) => (e.status === 401 ? onAuthError() : setErr(e.message)), [onAuthError]);

  const load = useCallback(async () => {
    try {
      const [entries, fields] = await Promise.all([adm(`/toc-entries?issue_id=${issue.id}`, token), adm('/fields', token)]);
      const used = new Map<number, { first: number; count: number }>();
      for (const e of entries) {
        if (!e.field_id) continue;
        const u = used.get(e.field_id);
        if (u) u.count++; else used.set(e.field_id, { first: e.sort_order, count: 1 });
      }
      const list: Sec[] = fields
        .filter((f: any) => used.has(f.id))
        .map((f: any) => ({ id: f.id, name: f.name, count: used.get(f.id)!.count, first: used.get(f.id)!.first }))
        .sort((a: any, b: any) => a.first - b.first);
      setSecs(list);
      setOthers(fields.map((f: any) => ({ id: f.id, name: f.name })));
      setNames(Object.fromEntries(list.map((s) => [s.id, s.name])));
    } catch (e) { fail(e); }
  }, [issue.id, token, fail]);

  useEffect(() => { load(); }, [load, version]);

  async function rename(s: Sec) {
    setErr(''); setMsg('');
    try {
      await adm(`/fields/${s.id}`, token, { method: 'PUT', body: JSON.stringify({ name: names[s.id] }) });
      setMsg('Đã đổi tên'); await load(); onChanged();
    } catch (e: any) {
      setErr(e.status === 409 ? 'Đã có chuyên mục trùng tên này. Hãy dùng “Gộp vào” để nhập chung.' : e.message);
    }
  }

  async function merge(s: Sec) {
    const to = Number(target[s.id]);
    if (!to) return;
    const dest = others.find((o) => o.id === to)?.name;
    if (!confirm(`Gộp “${s.name}” (${s.count} dòng) vào “${dest}”? Chuyên mục “${s.name}” sẽ bị xóa.`)) return;
    setErr(''); setMsg('');
    try {
      const d = await adm(`/fields/${s.id}/merge`, token, { method: 'POST', body: JSON.stringify({ target_id: to }) });
      setMsg(`Đã gộp ${d.moved} dòng`); await load(); onChanged();
    } catch (e) { fail(e); }
  }

  return (
    <details style={{ marginBottom: 18, border: '1px solid var(--line2)', background: '#fff', padding: '12px 16px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Sửa tên / gộp chuyên mục của số này ({secs.length})</summary>
      <p className="muted" style={{ margin: '10px 0' }}>
        Đổi tên áp dụng cho mọi số đang dùng chuyên mục đó. Nếu hai chuyên mục thực ra là một, dùng “Gộp vào”.
      </p>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {secs.map((s) => (
          <div key={s.id} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: '1 1 320px', width: 'auto', padding: 8 }} value={names[s.id] ?? ''}
              onChange={(e) => setNames({ ...names, [s.id]: e.target.value })} />
            <span className="muted" style={{ minWidth: 60 }}>{s.count} dòng</span>
            <button className="btn ghost sm" disabled={!names[s.id]?.trim() || names[s.id] === s.name} onClick={() => rename(s)}>Lưu tên</button>
            <select className="input" style={{ width: 220, padding: 7 }} value={target[s.id] ?? ''} onChange={(e) => setTarget({ ...target, [s.id]: e.target.value })}>
              <option value="">Gộp vào…</option>
              {others.filter((o) => o.id !== s.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button className="btn danger sm" disabled={!target[s.id]} onClick={() => merge(s)}>Gộp</button>
          </div>
        ))}
        {!secs.length && <span className="muted">Mục lục chưa có dòng nào gắn chuyên mục.</span>}
      </div>
    </details>
  );
}
