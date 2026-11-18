'use client';
import { useState } from 'react';
import { ArticleCard } from './Parts';

export default function IssueTabs({ articles, fields }: { articles: any[]; fields: string[] }) {
  const [f, setF] = useState('Tất cả');
  const shown = (f === 'Tất cả' ? articles : articles.filter((a) => a.field === f)).slice(0, 6);
  return (
    <>
      <div className="chips">
        {['Tất cả', ...fields].map((x) => (
          <button key={x} className={`chip ${x === f ? 'on' : ''}`} onClick={() => setF(x)}>{x}</button>
        ))}
      </div>
      <div className="cards">
        {shown.map((a) => <ArticleCard key={a.slug} a={a} />)}
      </div>
    </>
  );
}
