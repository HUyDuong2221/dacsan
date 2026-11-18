'use client';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Vẽ nội dung ra document.body để cửa sổ/ngăn kéo không bị header hay các lớp chồng khác che. */
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return mounted ? createPortal(children, document.body) : null;
}
