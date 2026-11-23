import type { Metadata } from 'next';
import Link from 'next/link';
import { get } from '@/lib/api';
import { ArticleCard } from '@/components/reader/Parts';
import './search.css';

export const metadata: Metadata = { title: 'Tìm bài báo' };

type SP = { q?: string; issue?: string; field?: string; author?: string; year?: string };
type Options = { issues: { slug: string; label: string }[]; fields: string[]; years: number[] };

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const q = (searchParams.q || '').trim();
  const author = (searchParams.author || '').trim();
  const issue = searchParams.issue || '';
  const field = searchParams.field || '';
  const year = /^\d{4}$/.test(searchParams.year || '') ? searchParams.year! : '';
  const opts: Options = await get('/search/options').catch(() => ({ issues: [], fields: [], years: [] }));

  const tooShort = (q && q.length < 2) || (author && author.length < 2);
  const any = q || author || issue || field || year;
  let res: any = null;
  let err = '';
  if (any && !tooShort) {
    const qs = new URLSearchParams(Object.entries({ q, author, issue, field, year }).filter(([, v]) => v) as [string, string][]);
    try { res = await get(`/search?${qs}`); } catch { err = 'Không tìm được, vui lòng thử lại.'; }
  }
  const issueLabel = opts.issues.find((i) => i.slug === issue)?.label || issue;
  const chips = [
    q && `Từ khóa: “${q}”`, author && `Tác giả: ${author}`, field && `Chuyên mục: ${field}`,
    year && `Năm ${year}`, issue && issueLabel,
  ].filter(Boolean) as string[];

  return (
    <div className="wrap page srch">
      <div className="pagehead">
        <div className="kicker">Tìm kiếm</div>
        <h1>Tìm bài báo</h1>
      </div>

      <form className="form srch-form" action="/search" method="get" role="search">
        <label className="full">Từ khóa
          <input className="input" type="search" name="q" defaultValue={q} maxLength={100}
            placeholder="Tiêu đề, tác giả, nội dung (không cần gõ dấu)" />
        </label>
        <label>Tác giả
          <input className="input" name="author" defaultValue={author} maxLength={100} placeholder="VD: Nguyễn Văn A" />
        </label>
        <label>Chuyên mục
          <select className="input" name="field" defaultValue={field}>
            <option value="">Tất cả chuyên mục</option>
            {opts.fields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label>Năm
          <select className="input" name="year" defaultValue={year}>
            <option value="">Tất cả các năm</option>
            {opts.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label>Số đặc san
          <select className="input" name="issue" defaultValue={issue}>
            <option value="">Tất cả các số</option>
            {opts.issues.map((i) => <option key={i.slug} value={i.slug}>{i.label}</option>)}
          </select>
        </label>
        <div className="full row">
          <button className="btn">Tìm kiếm</button>
          {any && <Link href="/search" className="btn ghost">Xóa bộ lọc</Link>}
        </div>
      </form>

      {tooShort && <p className="err">Từ khóa và tên tác giả cần ít nhất 2 ký tự.</p>}
      {err && <p className="err">{err}</p>}
      {res && (
        <>
          <div className="srch-sum">
            <span>
              <b>{res.total}</b> kết quả
              {res.total > res.count && <> · hiển thị {res.count} kết quả mới nhất, hãy thu hẹp bộ lọc</>}
            </span>
            <span className="srch-chips">{chips.map((c) => <span key={c} className="srch-chip">{c}</span>)}</span>
          </div>
          {res.results.length ? (
            <div className="cards">{res.results.map((a: any) => <ArticleCard key={a.slug} a={a} />)}</div>
          ) : (
            <p className="muted">Không có bài nào khớp. Thử bỏ bớt bộ lọc hoặc dùng từ khóa ngắn hơn.</p>
          )}
        </>
      )}
      {!any && <p className="muted">Nhập từ khóa hoặc chọn ít nhất một bộ lọc.</p>}
    </div>
  );
}
