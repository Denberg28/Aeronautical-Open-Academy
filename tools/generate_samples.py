#!/usr/bin/env python3
"""Content — generate the one-subject catalog/PDFs from subject-template.json.
Edit the canonical JSON for lessons and assessments, then run this script.
Standard library only; --check verifies committed generated files without writing.
"""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'app/src/main/assets'

def wrap(text):
    lines = []
    for paragraph in text.split('\n'):
        line = ''
        for word in paragraph.split():
            if line and len(line) + len(word) + 1 > 86:
                lines.append(line)
                line = word
            else:
                line += (' ' if line else '') + word
        lines.append(line)
    return lines

def pdf(text):
    # PDF — fixed geometry (points). Keep ASCII text for the built-in Helvetica font.
    lines = wrap(text)
    pages = [lines[i:i+48] for i in range(0, len(lines), 48)]
    objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    kids = []
    escape = lambda value: value.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    for number, page in enumerate(pages, 1):
        page_id = len(objects) + 1
        kids.append(f'{page_id} 0 R')
        stream = 'BT\n/F1 10 Tf\n14 TL\n46 785 Td\n'
        stream += ''.join('(' + escape(line) + ') Tj\nT*\n' for line in page)
        stream += f'ET\nBT\n/F1 9 Tf\n46 35 Td\n(Original Academy practice template | Page {number}) Tj\nET\n'
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {page_id+1} 0 R >>')
        objects.append(f'<< /Length {len(stream.encode("ascii"))} >>\nstream\n{stream}endstream')
    objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
    objects[1] = f'<< /Type /Pages /Count {len(pages)} /Kids [{" ".join(kids)}] >>'
    result = '%PDF-1.4\n'
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(result.encode('ascii')))
        result += f'{number} 0 obj\n{obj}\nendobj\n'
    xref = len(result.encode('ascii'))
    result += f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'
    result += ''.join(f'{offset:010d} 00000 n \n' for offset in offsets[1:])
    result += f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'
    return result.encode('ascii')

def entry_text(entry):
    result = entry['title'] + '\n\n' + entry['body']
    if entry['kind'] == 'quiz':
        result += '\n' + '\n'.join(chr(65+i) + '. ' + option for i, option in enumerate(entry['options']))
    return result

def outputs():
    subject = json.loads((ASSETS / 'subject-template.json').read_text())
    groups = [('a-guide', 'Course guide', 'Course overview', 2,
               'a-learning-guide.pdf', entry_text(subject['overview']))]
    for period in subject['periods']:
        text = subject['title'] + '\n' + period['name'] + ' | Weeks ' + period['weeks'] + '\n'
        text += 'Original classroom practice template; not an approved syllabus.\n\n'
        text += '\n\n'.join(entry_text(entry) for entry in period['entries'])
        groups.append(('a-'+period['key']+'-guide', period['name']+' - learning and assessments',
                       period['name'], 1, 'a-'+period['key']+'-guide.pdf', text))
    generated, resources = {}, []
    for rid, title, module, revision, name, text in groups:
        raw = pdf(text)
        generated[ASSETS / 'materials' / name] = raw
        source = 'asset://materials/' + name
        resources.append(dict(id=rid, title=title, module=module,
            description='Read the lessons and assessment prompts. Submit work in the signed-in local test subject.',
            source=source, downloadUrl=source, downloadable=True, mimeType='application/pdf',
            revision=revision, sha256=hashlib.sha256(raw).hexdigest(),
            license='Original Academy practice content - CC BY 4.0', text=text))
    catalog = dict(schemaVersion=1, version=2, title='Aeronautical Open Academy - Subject Template',
        subjects=[dict(id='a', code='A', title=subject['title'], description=subject['description'],
                       resources=resources)])
    generated[ASSETS / 'catalog.json'] = (json.dumps(catalog, indent=2)+'\n').encode()
    return generated

def main():
    check = '--check' in sys.argv
    for path, expected in outputs().items():
        if check:
            assert path.is_file() and path.read_bytes() == expected, 'Regenerate: ' + str(path)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(expected)
    print('PASS: single-subject catalog and five handouts are current' if check else
          'Generated one subject, four periods and five matching PDF handouts.')

if __name__ == '__main__':
    main()
