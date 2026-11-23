'use client';
import { useEffect } from 'react';
import { track, type TrackKind } from '@/lib/track';

/** Đặt trong trang (server component) để báo một lượt xem/đọc khi trang mở. Không hiển thị gì. */
export default function TrackView({ kind, issue, article }: { kind: TrackKind; issue: string; article?: string }) {
  useEffect(() => { track(kind, issue, article); }, [kind, issue, article]);
  return null;
}
