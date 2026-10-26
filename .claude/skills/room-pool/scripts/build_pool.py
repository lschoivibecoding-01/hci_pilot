#!/usr/bin/env python3
"""태그 파일로 pool.csv와 검색 페이지용 ZIP을 만든다.

사용: python build_pool.py <사진폴더> <작업폴더> [출력ZIP]
입력: <작업폴더>/index.json (make_sheets.py가 만든 번호→파일명)
      <작업폴더>/tags.json  ({"1": ["침실", "우드", ...], ...} 번호 또는 파일명을 키로)
      <작업폴더>/flags.json (선택: {"12": "식물이 보임", ...} 확인이 필요한 사진)
결과: <작업폴더>/pool.csv, 출력ZIP(기본 <작업폴더>/room_pool.zip)
      ZIP 안: pool.csv + photos/*.jpg (긴 변 1600px JPEG). search_system.html의 "풀 불러오기"로 바로 넣는다.
"""
import csv
import io
import json
import os
import sys
import unicodedata
import zipfile

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from make_sheets import list_photos  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_EDGE = 1600


def nfc(s):
    return unicodedata.normalize('NFC', s)


def main(src, work, out_zip=None):
    out_zip = out_zip or os.path.join(work, 'room_pool.zip')
    index = json.load(open(os.path.join(work, 'index.json'), encoding='utf-8'))
    tags = json.load(open(os.path.join(work, 'tags.json'), encoding='utf-8'))
    flags_path = os.path.join(work, 'flags.json')
    flags = json.load(open(flags_path, encoding='utf-8')) if os.path.exists(flags_path) else {}
    vocab = {t for g in json.load(open(os.path.join(HERE, 'vocab.json'), encoding='utf-8'))['groups'] for t in g['tags']}

    by_name = {nfc(os.path.basename(p)): p for p in list_photos(src)}
    num_of = {v: k for k, v in index.items()}
    # 키가 번호든 파일명이든 받아들인다
    tag_by_name = {}
    for k, v in tags.items():
        name = index.get(str(k), nfc(k))
        tag_by_name[name] = [t.strip() for t in (v if isinstance(v, list) else str(v).replace(';', ',').split(',')) if t.strip()]

    missing = [n for n in index.values() if not tag_by_name.get(n)]
    if missing:
        print(f'⚠ 태그가 없는 사진 {len(missing)}장: ' + ', '.join(f'#{num_of[n]} {n}' for n in missing[:10]))
    unknown = sorted({t for ts in tag_by_name.values() for t in ts if t not in vocab})
    if unknown:
        print('ℹ 어휘 목록(vocab.json) 밖의 태그(한국어 그대로만 검색됨): ' + ', '.join(unknown))

    rows, used = [], {}
    buf = io.BytesIO()
    with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for n in sorted(index, key=lambda x: int(x)):
            name = index[n]
            path = by_name.get(name)
            if not path:
                print(f'⚠ 파일을 찾지 못함 #{n} {name}')
                continue
            stem = os.path.splitext(name)[0]
            jpg = stem + '.jpg'
            if jpg in used:  # a.png 와 a.jpg 가 함께 있을 때
                jpg = f'{stem}_{n}.jpg'
            used[jpg] = 1
            im = Image.open(path).convert('RGB')
            im.thumbnail((MAX_EDGE, MAX_EDGE))
            b = io.BytesIO()
            im.save(b, 'JPEG', quality=86)
            z.writestr('photos/' + jpg, b.getvalue())
            rows.append([jpg, ';'.join(tag_by_name.get(name, [])), ''])
        s = io.StringIO()
        w = csv.writer(s)
        w.writerow(['file', 'tags', 'contains'])
        w.writerows(rows)
        csv_text = '﻿' + s.getvalue()
        z.writestr('pool.csv', csv_text.encode('utf-8'))
    with open(os.path.join(work, 'pool.csv'), 'w', encoding='utf-8', newline='') as fp:
        fp.write(csv_text)

    size = os.path.getsize(out_zip) / 1024 / 1024
    print(f'완료: 사진 {len(rows)}장 · 태그 평균 {sum(len(r[1].split(";")) for r in rows if r[1]) / max(1, len(rows)):.1f}개 · ZIP {size:.1f}MB')
    print(f'  ZIP   {out_zip}')
    print(f'  CSV   {os.path.join(work, "pool.csv")}')
    if flags:
        print(f'⚠ 확인이 필요한 사진 {len(flags)}장 (타깃 요소가 보이는 듯함):')
        for k, why in flags.items():
            print(f'  #{k} {index.get(str(k), k)} — {why}')


if __name__ == '__main__':
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    main(*sys.argv[1:])
