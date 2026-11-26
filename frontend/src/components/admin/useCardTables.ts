import { useEffect } from 'react';

// Cột làm dòng đầu (chữ đậm) của thẻ, xét theo thứ tự; không có cột nào khớp thì lấy ô chữ đầu tiên.
const MAIN = ['Tiêu đề', 'Tên số đặc san', 'Chuyên mục', 'Email đăng nhập', 'Email', 'Phản biện viên', 'Vị trí', 'Khối', 'Thao tác', 'Tên'];

/**
 * Điện thoại: bảng quản trị hiện thành thẻ gọn (CSS trong admin.css, lớp .t-cards), đoạn giải thích dài thu còn 2 dòng.
 * Hook gắn tên cột vào mỗi ô (data-label) cho mọi bảng .adm-main table.t, kể cả bảng trong hộp thoại (Portal),
 * nên các màn quản trị không phải khai báo lại tên cột.
 * Bảng chỉ có 1–2 cột và bảng số liệu thống kê (.st-num) giữ nguyên dạng bảng.
 */
export default function useCardTables() {
  useEffect(() => {
    const flag = (el: Element, name: string, on: boolean) => { if (el.hasAttribute(name) !== on) el.toggleAttribute(name, on); };
    const apply = () => {
      document.querySelectorAll<HTMLTableElement>('.adm-main table.t').forEach((table) => {
        const heads = Array.from(table.querySelectorAll(':scope > thead > tr > th'), (th) => th.textContent?.trim() || '');
        const cards = heads.length >= 3 && !table.querySelector('th.st-num');
        table.classList.toggle('t-cards', cards);
        if (!cards) return;
        table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr').forEach((tr) => {
          const cells = Array.from(tr.cells);
          const text = cells.map((td) => (td.querySelector('input, select, textarea, .t-act') ? '' : td.textContent?.trim() || ''));
          const usable = (i: number) => !!text[i] && text[i] !== '—' && cells[i].colSpan === 1 && !['ID', '#', 'STT'].includes(heads[i]);
          let main = -1;
          for (const name of MAIN) { main = heads.findIndex((h, i) => h === name && usable(i)); if (main >= 0) break; }
          if (main < 0) main = cells.findIndex((_, i) => usable(i));
          cells.forEach((td, i) => {
            const label = td.colSpan > 1 ? '' : heads[i] || '';
            if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label);
            flag(td, 'data-main', i === main);
            flag(td, 'data-empty', text[i] === '—');
          });
        });
      });
      // Đoạn giải thích / gợi ý dài: đánh dấu để điện thoại thu gọn, chạm vào thì mở.
      document.querySelectorAll<HTMLElement>('.adm-main p.muted, .adm-main small.muted').forEach((el) => {
        el.classList.toggle('adm-note', (el.textContent?.length || 0) > (el.tagName === 'P' ? 110 : 70));
      });
    };
    const onClick = (e: MouseEvent) => {
      const note = (e.target as HTMLElement).closest?.('.adm-note');
      if (!note || !window.matchMedia('(max-width: 860px)').matches || (e.target as HTMLElement).closest('a, button')) return;
      e.preventDefault(); // gợi ý nằm trong <label>: không đẩy tiêu điểm vào ô nhập
      note.classList.toggle('open');
    };
    apply();
    // MutationObserver đã gộp các thay đổi thành một lượt gọi; apply chỉ đổi thuộc tính nên không tự kích lại.
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('click', onClick);
    return () => { observer.disconnect(); document.removeEventListener('click', onClick); };
  }, []);
}
