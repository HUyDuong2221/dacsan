import type { Metadata } from 'next';
import { fmtDate, get } from '@/lib/api';

export const metadata: Metadata = { title: 'Tư liệu – Văn bản pháp quy' };

export default async function Docs() {
  const docs = await get('/documents');
  return (
    <div className="wrap page">
      <div className="pagehead">
        <div className="kicker">Tư liệu – Văn bản pháp quy</div>
        <h1>Quy định xuất bản, hướng dẫn gửi bài và đạo đức công bố</h1>
      </div>
      <div className="cards">
        {docs.map((d: any) => {
          const inner = (
            <>
              <div className="tag">{d.doc_type}</div>
              <h3>{d.title}</h3>
              <div className="meta">Cập nhật {fmtDate(d.updated)}{d.file_url ? ' · Mở tệp' : ' · Chưa có tệp'}</div>
            </>
          );
          return d.file_url
            ? <a key={d.id} className="card" href={d.file_url} target="_blank" rel="noopener noreferrer">{inner}</a>
            : <div key={d.id} className="card">{inner}</div>;
        })}
      </div>
    </div>
  );
}
