'use client';
import { useMemo, useRef, useState } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor, Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough, Subscript, Superscript,
  RemoveFormat, Font, Alignment, Link, AutoLink, LinkImage, List, Indent, IndentBlock, BlockQuote, HorizontalLine,
  Table, TableToolbar, TableProperties, TableCellProperties, Undo, SourceEditing,
  Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageTextAlternative, ImageUpload, ImageInsert, FileRepository,
  PasteFromOffice, Autoformat,
} from 'ckeditor5';
import viTranslations from 'ckeditor5/translations/vi.js';
import 'ckeditor5/ckeditor5.css';

// CKEditor 5 (bản miễn phí, giấy phép GPL). Nạp động ở phía trình duyệt, xem ResourceManager.
// Dữ liệu là HTML (editor.getData()). Ảnh tải lên kho chung /media qua API admin /upload.

function uploadPlugin(token: string) {
  return function UploadAdapter(editor: any) {
    editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => ({
      async upload() {
        const file: File = await loader.file;
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch('/api/v1/admin/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Tải ảnh lên thất bại');
        return { default: d.url };
      },
      abort() {},
    });
  };
}

const IMG_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

async function uploadImage(token: string, blob: Blob, ext: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', new File([blob], `word.${ext}`, { type: blob.type }));
  const r = await fetch('/api/v1/admin/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof d.detail === 'string' ? d.detail : 'Tải ảnh lên thất bại');
  return d.url;
}

// .docx -> HTML (mammoth, chạy ngay trong trình duyệt); ảnh nhúng trong tệp được tải lên /media.
async function docxToHtml(file: File, token: string): Promise<string> {
  const mammoth: any = await import('mammoth/mammoth.browser');
  const res = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (img: any) => {
        const ext = IMG_EXT[img.contentType];
        if (!ext) return { src: '' }; // định dạng ảnh không hỗ trợ (emf, wmf, gif...): bỏ qua
        const bytes = Uint8Array.from(atob(await img.read('base64')), (c) => c.charCodeAt(0));
        return { src: await uploadImage(token, new Blob([bytes], { type: img.contentType }), ext) };
      }),
    },
  );
  return String(res.value).replace(/<img[^>]*src=""[^>]*>/g, '');
}

export default function RichText({ value, onChange, token }: { value: string; onChange: (html: string) => void; token: string }) {
  const editorRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function importWord(file: File) {
    setNote(null);
    if (!/\.docx$/i.test(file.name)) { setNote({ ok: false, text: 'Chỉ nhập được tệp .docx. Tệp .doc cũ: mở bằng Word, lưu thành .docx rồi thử lại (hoặc dùng ô Tệp đính kèm).' }); return; }
    const editor = editorRef.current;
    if (!editor) return;
    setBusy(true);
    try {
      const html = await docxToHtml(file, token);
      if (!html.trim()) throw new Error('Tệp không có nội dung văn bản');
      editor.model.change((writer: any) => {
        const fragment = editor.data.toModel(editor.data.processor.toView(html));
        editor.model.insertContent(fragment, writer.createPositionAt(editor.model.document.getRoot(), 'end'));
      });
      setNote({ ok: true, text: `Đã nhập “${file.name}” vào cuối nội dung. Có thể hoàn tác bằng Undo.` });
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || 'Không đọc được tệp Word' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const config = useMemo(() => ({
    licenseKey: 'GPL' as const,
    language: 'vi',
    translations: [viTranslations],
    plugins: [
      Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough, Subscript, Superscript, RemoveFormat, Font, Alignment,
      Link, AutoLink, LinkImage, List, Indent, IndentBlock, BlockQuote, HorizontalLine, Table, TableToolbar, TableProperties, TableCellProperties,
      Undo, SourceEditing, PasteFromOffice, Autoformat,
      Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageTextAlternative, ImageUpload, ImageInsert, FileRepository,
    ],
    extraPlugins: [uploadPlugin(token)],
    toolbar: {
      items: [
        'undo', 'redo', '|', 'heading', '|', 'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|',
        'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'removeFormat', '|',
        'alignment', '|', 'bulletedList', 'numberedList', 'outdent', 'indent', '|',
        'link', 'insertImage', 'insertTable', 'blockQuote', 'horizontalLine', '|', 'sourceEditing',
      ],
      shouldNotGroupWhenFull: true,
    },
    heading: {
      options: [
        { model: 'paragraph' as const, title: 'Đoạn văn', class: 'ck-heading_paragraph' },
        { model: 'heading2' as const, view: 'h2', title: 'Tiêu đề 2', class: 'ck-heading_heading2' },
        { model: 'heading3' as const, view: 'h3', title: 'Tiêu đề 3', class: 'ck-heading_heading3' },
        { model: 'heading4' as const, view: 'h4', title: 'Tiêu đề 4', class: 'ck-heading_heading4' },
      ],
    },
    fontSize: { options: [12, 14, 'default', 18, 20, 24, 28, 32] as any },
    image: {
      toolbar: ['imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|', 'toggleImageCaption', 'imageTextAlternative', '|', 'linkImage'],
      insert: { type: 'auto' as const, integrations: ['upload', 'url'] as any },
      resizeUnit: '%' as const,
      resizeOptions: [
        { name: 'resizeImage:original', value: null, label: 'Gốc' },
        { name: 'resizeImage:50', value: '50', label: '50%' },
        { name: 'resizeImage:75', value: '75', label: '75%' },
      ],
    },
    table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties'] },
    link: { defaultProtocol: 'https://', addTargetToExternalLinks: true },
  }), [token]);

  return (
    <div className="rte">
      <div className="rte-bar">
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Đang nhập…' : 'Nhập từ Word (.docx)'}</button>
        <input ref={fileRef} type="file" hidden accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => e.target.files?.[0] && importWord(e.target.files[0])} />
        {note && <span className={note.ok ? 'rte-ok' : 'rte-err'} role="status">{note.text}</span>}
      </div>
      <CKEditor editor={ClassicEditor} data={value} config={config as any} onReady={(editor) => { editorRef.current = editor; }} onChange={(_, editor) => onChange(editor.getData())} />
    </div>
  );
}
