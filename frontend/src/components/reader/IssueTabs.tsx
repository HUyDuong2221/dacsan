'use client';
import { useState } from 'react';
import { ArticleCard } from './Parts';

const STEP = 4;

// "Trong số này" (trang /issues): lọc theo chuyên mục, hiện 4 bài đầu,
// bấm "Xem thêm" hiện thêm 4 bài.
export default function IssueTabs({ articles, fields }: { articles: any[]; fields: string[] }) {
  const [f, setF] = useState('Tất cả');
  const [shown, setShown] = useState(STEP);
  const list = f === 'Tất cả' ? articles : articles.filter((a) => a.field === f);
  return (
    <>
      <div className="chips">
        {['Tất cả', ...fields].map((x) => (
          <button key={x} className={`chip ${x === f ? 'on' : ''}`} onClick={() => { setF(x); setShown(STEP); }}>{x}</button>
        ))}
      </div>
      <div className="cards iss-cards">
        {list.slice(0, shown).map((a) => <ArticleCard key={a.slug} a={a} />)}
      </div>
      {list.length > shown && (
        <button type="button" className="iss-more" onClick={() => setShown(shown + STEP)}>
          Xem thêm <span aria-hidden="true">↓</span>
        </button>
      )}
    </>
  );
}
