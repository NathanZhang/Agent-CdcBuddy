#!/usr/bin/env python3
"""Import the supplied category workbook without changing it or inventing subcodes."""
import argparse
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def extract(source):
    with zipfile.ZipFile(source) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheet = next(s for s in workbook.find('s:sheets', NS) if s.attrib['name'] == 'ICD-10三位类目编码表')
        rid = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.attrib['Target'] for r in relationships if r.attrib['Id'] == rid)
        name = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        entries = []
        for row in ET.fromstring(archive.read(name)).findall('.//s:row', NS):
            cells = {}
            for cell in row:
                if cell.find('s:f', NS) is not None:
                    raise ValueError('Formula in source; reviewed literal categories required')
                value = cell.find('s:v', NS)
                text = value.text if value is not None else ''.join(cell.find('s:is', NS).itertext()) if cell.find('s:is', NS) is not None else ''
                cells[re.sub(r'\d', '', cell.attrib['r'])] = strings[int(text)] if cell.attrib.get('t') == 's' else text
            code = cells.get('A', '').strip()
            if not re.fullmatch('[A-Z][0-9]{2}', code):
                continue
            if not cells.get('B'):
                raise ValueError('Missing category label: ' + code)
            entries.append({'code': code, 'label': cells['B'], 'sourceChapter': cells.get('C'),
                            'range': cells.get('D'), 'chapterLabel': cells.get('E'),
                            'sourceRow': int(row.attrib['r'])})
    if not entries or len({e['code'] for e in entries}) != len(entries):
        raise ValueError('Empty or duplicate category codes')
    return {'version': 'user-supplied-three-character-categories-v1', 'classification': 'ICD-10',
            'granularity': 'category-only', 'sourceFile': Path(source).name,
            'sourceSha256': hashlib.sha256(Path(source).read_bytes()).hexdigest(),
            'sourceSheet': sheet.attrib['name'], 'sourceEdition': 'not-specified-in-workbook',
            'limitations': ['Category labels are not the Iris/MUSE decision tables.',
                             'Source chapter numbering is preserved; U/Z chapter numbering needs source review.'],
            'entries': entries}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=Path('config/mortality/icd10-categories.json'))
    args = parser.parse_args()
    result = extract(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'entries': len(result['entries']), 'sha256': result['sourceSha256']}, ensure_ascii=False))
