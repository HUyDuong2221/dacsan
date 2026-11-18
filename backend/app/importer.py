"""Conservative PDF importer: TOC metadata is usable; extracted full text remains unverified.

In particular, reading order on two-column pages is a heuristic. It must never be
published as editorially verified content without human review.
"""
from __future__ import annotations
import hashlib
import html
import re
import shutil
import unicodedata
from pathlib import Path
import fitz
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core import settings
from app.models import Article, Issue, Section, utc_now

SECTION_NAMES = [
    'TRÍ THỨC, KHOA HỌC VÀ TỔ CHỨC HỘI',
    'ĐÀ NẴNG TRÊN ĐƯỜNG PHÁT TRIỂN',
    'NHÂN VẬT, LỊCH SỬ VÀ VĂN HÓA',
    'Ý KIẾN - TRAO ĐỔI',
    'NHÌN RA THẾ GIỚI',
    'THÔNG TIN',
]


def slugify(value: str) -> str:
    value = value.replace('Đ', 'D').replace('đ', 'd')
    value = unicodedata.normalize('NFKD', value)
    value = ''.join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r'[^a-z0-9]+', '-', value.lower())
    return value.strip('-')[:140] or 'untitled'


def parse_toc(doc: fitz.Document) -> list[dict]:
    """Read numbered TOC entries from a single sample-style table-of-contents page.

    Fails closed: an unknown layout raises an error rather than silently
    claiming an accurate full issue extraction.
    """
    page = doc[3] if len(doc) > 3 else doc[0]
    result = []
    category = None
    for block in sorted(page.get_text('blocks'), key=lambda b: (b[1], b[0])):
        text = block[4].strip()
        if not text or block[1] < 125:
            continue
        stripped = ' '.join(text.split())
        if stripped in SECTION_NAMES:
            category = stripped
            continue
        if not category or stripped.startswith('Lời thưa'):
            continue
        lines = text.splitlines()
        buffer: list[str] = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            trailing = re.match(r'^(.*?)\s*[\t]+\s*(\d{1,3})$', line)
            if trailing:
                if trailing.group(1).strip():
                    buffer.append(trailing.group(1).strip())
                page_num = int(trailing.group(2))
            elif re.fullmatch(r'\d{1,3}', line):
                page_num = int(line)
            else:
                buffer.append(line)
                continue
            combined = ' '.join(buffer).strip()
            buffer.clear()
            if not combined or not 1 <= page_num <= len(doc):
                continue
            parts = re.split(r'\s+-\s+', combined, maxsplit=1)
            if len(parts) == 2:
                author, title = parts
            else:
                author, title = '', combined
            if author == 'LÊ HÙNG' and title.startswith('TÔ THÚY NGA - '):
                author = 'LÊ HÙNG - TÔ THÚY NGA'
                title = title[len('TÔ THÚY NGA - '):]
            if combined.startswith('PV- '):
                author, title = 'PV', combined[len('PV- '):]
            elif author == 'PV-':
                author = 'PV'
            result.append({'section': category, 'author': author.strip(), 'title': title.strip(), 'page': page_num})
    if len(result) < 5:
        raise ValueError('Không nhận diện đủ mục lục; cần kiểm tra thủ công file PDF.')
    return result


def extract_page_reading_order(page: fitz.Page) -> str:
    """Approximate reading order, left column then right column after header.

    Preserves extracted text for review; **not** a guaranteed layout converter.
    """
    blocks = [(b[0], b[1], b[2], b[3], b[4]) for b in page.get_text('blocks') if len(b) > 4 and isinstance(b[4], str) and b[4].strip()]
    w = page.rect.width
    page_top = [b for b in blocks if b[1] < 115]
    columns = [b for b in blocks if 115 <= b[1] < page.rect.height - 36]
    left = [b for b in columns if (b[0]+b[2])/2 < w/2]
    right = [b for b in columns if (b[0]+b[2])/2 >= w/2]
    ordered = sorted(page_top, key=lambda b: (b[1],b[0])) + sorted(left, key=lambda b:(b[1],b[0])) + sorted(right,key=lambda b:(b[1],b[0]))
    return '\n\n'.join(b[4].strip() for b in ordered)


def import_pdf(db: Session, source: Path, *, publish_sample: bool = False) -> Issue:
    root = Path(settings().media_root)
    root.mkdir(parents=True, exist_ok=True)
    checksum = hashlib.sha256(source.read_bytes()).hexdigest()
    existing = db.scalar(select(Issue).where(Issue.pdf_sha256 == checksum))
    if existing:
        return existing

    with fitz.open(source) as doc:
        first = doc[0].get_text('text')
        match = re.search(r'Số\s*(\d+)\s*\((\d{1,2})\s*-\s*(\d{4})\)', first, re.I)
        if not match:
            raise ValueError('Không nhận diện được số và kỳ phát hành trên bìa PDF.')
        number, month, year = (int(v) for v in match.groups())
        slug = f'so-{number}-{month}-{year}'
        if db.scalar(select(Issue).where(Issue.slug == slug)):
            raise ValueError(f'Số {slug} đã có trong database, nội dung PDF khác.')
        items = parse_toc(doc)
        pdf_key = f'issues/{checksum[:16]}.pdf'
        cover_key = f'covers/so-{number}-{year}-{checksum[:8]}.png'
        (root / 'issues').mkdir(parents=True, exist_ok=True)
        (root / 'covers').mkdir(parents=True, exist_ok=True)
        target = root / pdf_key
        if source.resolve() != target.resolve():
            shutil.copy2(source, target)
        pixmap = doc[0].get_pixmap(matrix=fitz.Matrix(1.15, 1.15), alpha=False)
        pixmap.save(str(root / cover_key))
        editorial = doc[2].get_text('text').strip() if len(doc) > 2 else ''
        imprint = doc[133].get_text('text').strip() if len(doc) > 133 else ''
        issue = Issue(number=number, month=month, year=year, slug=slug,
                      title=f'Đặc san Khoa học & Phát triển — Số {number}',
                      theme='Chào mừng Quốc khánh 2-9' if number == 18 and year == 2026 else '',
                      description=f'Đặc san Khoa học & Phát triển thành phố Đà Nẵng, số {number} ({month}-{year})',
                      editorial=editorial, imprint=imprint,
                      cover_key=cover_key, pdf_key=pdf_key, pdf_sha256=checksum,
                      page_count=len(doc), status='published' if publish_sample else 'draft',
                      published_at=utc_now() if publish_sample else None)
        db.add(issue)
        db.flush()
        by_name = {}
        for item in items:
            name = item['section']
            if name not in by_name:
                s = Section(issue_id=issue.id,name=name,slug=slugify(name),sort_order=len(by_name))
                db.add(s)
                db.flush()
                by_name[name] = s
        for idx, item in enumerate(items):
            start = item['page']
            end = items[idx+1]['page']-1 if idx+1 < len(items) else min(133,len(doc))
            end = max(start, end)
            raw = '\n\n'.join(extract_page_reading_order(doc[p-1]) for p in range(start, min(end,len(doc))+1))
            kind = 'structured_list' if item['title'].lower().startswith(('danh sách', 'đoàn chủ tịch')) else 'article'
            if item['title'].lower().startswith(('tin hoạt động','thông tin khoa học')):
                kind = 'news_digest'
            if item['title'].lower().startswith('thư ngỏ'):
                kind = 'letter'
            article = Article(issue_id=issue.id, section_id=by_name[item['section']].id,
                title=item['title'], slug=f'{slugify(item["title"])}-so-{number}-{year}-{idx+1}',
                author_display=item['author'], content_type=kind,
                raw_extracted_text=raw, full_text_verified=False,
                print_page_start=start, print_page_end=end,
                pdf_page_start=start, pdf_page_end=end,sort_order=idx,
                status='published' if publish_sample else 'draft')
            db.add(article)
        db.commit()
        db.refresh(issue)
        return issue
