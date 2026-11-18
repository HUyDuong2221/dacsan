"""Verify reference PDF content without requiring PostgreSQL or Redis.
Run in backend environment: python ../scripts/check_sample.py
"""
from pathlib import Path
import sys
import fitz

backend = Path(__file__).resolve().parents[1]/'backend'
sys.path.insert(0,str(backend))
from app.importer import parse_toc

source=Path(__file__).resolve().parents[1]/'sample'/'KHPT_2-11.pdf'
with fitz.open(source) as doc:
    toc=parse_toc(doc)
    sections=list(dict.fromkeys(x['section'] for x in toc))
    print(f'{len(doc)} PDF pages; {len(sections)} sections; {len(toc)} content items')
    assert len(doc)==136
    assert len(sections)==6
    assert len(toc)==24
    assert toc[0]['page']==5 and toc[-1]['page']==124
print('PASS')
