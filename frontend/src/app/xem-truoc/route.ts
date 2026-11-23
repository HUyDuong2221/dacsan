import { NextRequest, NextResponse } from 'next/server';
import { PREVIEW_COOKIE } from '@/lib/preview';

// /xem-truoc?token=...&slug=...      đặt cookie xem trước (2 giờ) rồi mở trang số đặc san.
// /xem-truoc?thoat=1&slug=...        tắt chế độ xem trước.
// Token do backend ký (POST /admin/issues/{id}/preview-link) và chỉ mở được đúng số đó; backend kiểm tra token.
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slug = p.get('slug') || '';
  const dest = /^[a-z0-9-]{1,120}$/.test(slug) ? `/issues/${slug}` : '/issues';
  // Location tương đối: trong Docker req.url mang host nội bộ (0.0.0.0:3000), không dùng để chuyển hướng.
  const res = new NextResponse(null, { status: 307, headers: { Location: dest, 'Referrer-Policy': 'no-referrer' } });
  if (p.get('thoat')) {
    res.cookies.delete(PREVIEW_COOKIE);
    return res;
  }
  const token = p.get('token') || '';
  if (token && token.length < 2000) {
    res.cookies.set(PREVIEW_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 2 * 60 * 60 });
  }
  return res;
}
