// Server component: gọi thẳng backend trong mạng Docker. Trình duyệt: gọi same-origin /api (Next rewrite).
function base() {
  return typeof window === 'undefined' ? process.env.API_INTERNAL_URL || 'http://localhost:8000' : '';
}

export async function get<T = any>(path: string): Promise<T> {
  const r = await fetch(`${base()}/api/v1/public${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`API ${r.status}: ${path}`);
  return r.json();
}

export async function getOrNull<T = any>(path: string): Promise<T | null> {
  const r = await fetch(`${base()}/api/v1/public${path}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`API ${r.status}: ${path}`);
  return r.json();
}

export function fmtDate(iso?: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
