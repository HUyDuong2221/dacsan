'use client';
import { useState } from 'react';
import ResourceManager, { ResourceDef } from './ResourceManager';
import TocImport from './TocImport';
import SectionsEditor from './SectionsEditor';
import Portal from '../ui/Portal';

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

export default function IssueToc({ issue, token, onAuthError, role }: { issue: any; token: string; onAuthError: () => void; role: string }) {
  const [open, setOpen] = useState(false);
  const [ver, setVer] = useState(0);
  const canEdit = role === 'admin' || role === 'editor';
  return (
    <>
      <button className="btn ghost sm" onClick={() => setOpen(true)}>Mục lục</button>
      {open && (
        <Portal>
        <div className="drawer-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="drawer-bg" onClick={() => setOpen(false)} />
          <div className="modal-card" style={{ position: 'relative', background: 'var(--bg)', width: 'min(1200px, 96vw)', maxHeight: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 40px rgba(23,37,47,.25)' }}>
            <div className="row" style={{ justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div className="kicker">Mục lục của số đặc san</div>
                <div className="serif" style={{ fontSize: 20, fontWeight: 700 }}>{issue.label} — {issue.theme}</div>
              </div>
              <div className="row">
                {canEdit && <TocImport issue={issue} token={token} onAuthError={onAuthError} onDone={() => setVer((v) => v + 1)} />}
                <button className="btn ghost sm" onClick={() => setOpen(false)}>✕ Đóng</button>
              </div>
            </div>
            <div className="adm-main" style={{ padding: 22, overflow: 'auto' }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Mục lục hiện ra ngoài khi số đặc san được đánh dấu <b>Công bố trên website</b>.{!canEdit && <> Bạn là cộng tác viên: chỉ nhập/sửa được mục lục của số <b>chưa công bố</b>, không xóa được.</>} Dòng nào có <b>Toàn văn</b> thì người đọc đọc được trên web, không thì chỉ báo “có trong bản in”.
              </p>
              {canEdit && <SectionsEditor version={ver} issue={issue} token={token} onAuthError={onAuthError} onChanged={() => setVer((v) => v + 1)} />}
              <ResourceManager key={ver} res={canEdit ? TOC_RES : { ...TOC_RES, noDelete: true }} token={token} onAuthError={onAuthError}
                query={`issue_id=${issue.id}`} defaults={{ issue_id: issue.id }} />
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
