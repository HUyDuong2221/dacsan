// Toàn văn bài: markdown-lite ("## Đề mục", đoạn cách nhau một dòng trống, "![chú thích](/media/...)").
export type Block = { t: 'h'; text: string; id: string } | { t: 'p'; text: string } | { t: 'img'; alt: string; src: string };

export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  let h = 0;
  for (const raw of body.split(/\n{2,}/)) {
    const block = raw.trim();
    if (!block) continue;
    const lines = block.split('\n');
    if (lines[0].startsWith('## ')) {
      out.push({ t: 'h', text: lines[0].slice(3).trim(), id: `h-${h++}` });
      const rest = lines.slice(1).join(' ').trim();
      if (rest) out.push({ t: 'p', text: rest });
      continue;
    }
    const m = block.match(/^!\[(.*)\]\((.+)\)$/);
    if (m && (m[2].startsWith('/') || m[2].startsWith('https://'))) out.push({ t: 'img', alt: m[1], src: m[2] });
    else out.push({ t: 'p', text: lines.join(' ') });
  }
  return out;
}
