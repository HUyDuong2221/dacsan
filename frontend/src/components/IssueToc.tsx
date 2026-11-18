'use client';
import { useState } from 'react';
import ResourceManager, { ResourceDef } from './ResourceManager';
import TocImport from './TocImport';

const TOC_RES: ResourceDef = {
  key: 'toc-entries',
  title: 'Mục lục',
  addLabel: 'Thêm dòng mục lục',
  editLabel: 'Sửa dòng mục lục',
  fields: [
    { key: 'sort_order', label: 'Thứ tự', type: 'number', list: true, hint: 'Theo thứ tự trong mục lục bản in: 0, 1, 2…' },
    { key: 'field_id', label: 'Chuyên mục', list: true, optionsFrom: { resource: 'fields', labelKey: 'name' } },
    { key: 'author', label: 'Tác giả', list: true },
    { key: 'title', label: 'Tiêu đề', required: true, list: true, full: true },
    { key: 'page_label', label: 'Trang in', list: true, hint: 'VD: tr. 13' },
    { key: 'is_front', label: 'Thuộc "Trang đầu số"', type: 'bool', hint: 'Lời thưa, Lãnh đạo Ban chấp hành…' },
    { key: 'lead', label: 'Lời dẫn (tùy chọn)', type: 'textarea' },
    { key: 'body', label: 'Toàn văn (tùy chọn)', type: 'textarea', hint: 'Để trống = chỉ có bản in. Đề mục: dòng bắt đầu "## ". Các đoạn cách nhau một dòng trống. Ảnh: ![chú thích](/media/anh.jpg).' },
    { key: 'is_research', label: 'Hiện ở mục Nghiên cứu – Trao đổi', type: 'bool' },
    { key: 'featured', label: 'Hiện ở slide trang chủ', type: 'bool' },
    { key: 'hero_excerpt', label: 'Đoạn trích cho slide', type: 'textarea' },
  ],
};

export default function IssueToc({ issue, token, onAuthError }: { issue: any; token: string; onAuthError: () => void }) {
  const [open, setOpen] = useState(false);
  const [ver, setVer] = useState(0);
  return (
    <>
      <button className="btn ghost sm" onClick={() => setOpen(true)}>Mục lục</button>
      {open && (
        <div className="drawer-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="drawer-bg" onClick={() => setOpen(false)} />
          <div style={{ position: 'relative', background: 'var(--bg)', width: 'min(1200px, 96vw)', maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 40px rgba(23,37,47,.25)' }}>
            <div className="row" style={{ justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div className="kicker">Mục lục của số đặc san</div>
                <div className="serif" style={{ fontSize: 20, fontWeight: 700 }}>{issue.label} — {issue.theme}</div>
              </div>
              <div className="row">
                <TocImport issue={issue} token={token} onAuthError={onAuthError} onDone={() => setVer((v) => v + 1)} />
                <button className="btn ghost sm" onClick={() => setOpen(false)}>✕ Đóng</button>
              </div>
            </div>
            <div style={{ padding: 22, overflow: 'auto' }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Mục lục hiện ra ngoài khi số đặc san được tick <b>Công bố trên website</b>. Dòng nào có <b>Toàn văn</b> thì người đọc đọc được trên web, không thì chỉ báo “có trong bản in”.
              </p>
              <ResourceManager key={ver} res={TOC_RES} token={token} onAuthError={onAuthError}
                query={`issue_id=${issue.id}`} defaults={{ issue_id: issue.id }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
