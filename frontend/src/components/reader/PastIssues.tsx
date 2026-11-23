'use client';
import { useState } from 'react';
import IssueTile, { IssueTileData } from './IssueTile';

const STEP = 4;

// "Các số trước" (trang /issues): tab theo năm phát hành (giống khối "Kho lưu trữ"
// trang chủ), mỗi năm hiện 4 số mới nhất, bấm "Xem thêm" hiện thêm 4 số.
export default function PastIssues({ issues }: { issues: (IssueTileData & { year: string })[] }) {
  const years = Array.from(new Set(issues.map((i) => i.year || 'Khác')));
  const [year, setYear] = useState(years[0]);
  const [shown, setShown] = useState(STEP);
  const list = issues.filter((i) => (i.year || 'Khác') === year);

  return (
    <section className="iss-sec">
      <div className="sec-head iss-past-head">
        <h2>Các số trước</h2>
        {years.length > 1 && (
          <div className="iss-years" role="tablist" aria-label="Năm phát hành">
            {years.map((y) => (
              <button key={y} type="button" role="tab" aria-selected={y === year} className={y === year ? 'on' : ''}
                onClick={() => { setYear(y); setShown(STEP); }}>{y}</button>
            ))}
          </div>
        )}
      </div>
      <div className="itile-grid">
        {list.slice(0, shown).map((s) => <IssueTile key={s.slug} s={s} />)}
      </div>
      {list.length > shown && (
        <button type="button" className="iss-more" onClick={() => setShown(shown + STEP)}>
          Xem thêm <span aria-hidden="true">↓</span>
        </button>
      )}
    </section>
  );
}
