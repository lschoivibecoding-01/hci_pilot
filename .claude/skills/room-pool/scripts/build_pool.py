#!/usr/bin/env python3
"""태그 파일로 pool.csv와 검색 페이지용 ZIP을 만든다.

사용: python build_pool.py <사진폴더> <작업폴더> [출력ZIP]
입력: <작업폴더>/index.json (make_sheets.py가 만든 번호→파일명)
      <작업폴더>/tags.json  ({"1": ["침실", "우드", ...], ...} 번호 또는 파일명을 키로)
      <작업폴더>/captions.csv (있으면, 2026-10-27.7) 열 file,caption,objects,flags,note — caption_guide.md 규칙으로 쓴 사진 설명문.
        file은 원래 파일명이나 번호. caption·objects는 pool.csv에 들어가 검색 보조 색인이 되고,
        flags·note는 pool_flags.csv로 따로 나간다(연구자 화면에서만 보임, 참여자 화면은 읽지 않음)
결과: <작업폴더>/pool.csv (열 file,tags,contains,caption,objects), <작업폴더>/pool_flags.csv (captions.csv가 있을 때),
      출력ZIP(기본 <작업폴더>/room_pool.zip)
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
# search_system.html의 TARGETS 이름. 짧게 적어도 받아 준다
# 타깃 요소 태그 → search_system.html의 TARGETS 이름. contains 칸은 태그에서 자동으로 채운다
TARGET_NAMES = {'식물': '식물', '러그': '러그', '스탠드': '스탠드 조명', '액자': '벽 그림', '담요': '겹친 침구·담요'}


def nfc(s):
    return unicodedata.normalize('NFC', s)


def split_list(v):
    return [t.strip() for t in (v if isinstance(v, list) else str(v).replace(';', ',').split(',')) if t.strip()]


def main(src, work, out_zip=None):
    out_zip = out_zip or os.path.join(work, 'room_pool.zip')
    index = json.load(open(os.path.join(work, 'index.json'), encoding='utf-8'))
    tags = json.load(open(os.path.join(work, 'tags.json'), encoding='utf-8'))
    vocab = {t for g in json.load(open(os.path.join(HERE, 'vocab.json'), encoding='utf-8'))['groups'] for t in g['tags']}

    by_name = {nfc(os.path.basename(p)): p for p in list_photos(src)}
    num_of = {v: k for k, v in index.items()}
    # 키가 번호든 파일명이든 받아들인다
    tag_by_name = {}
    for k, v in tags.items():
        name = index.get(str(k), nfc(k))
        tag_by_name[name] = split_list(v)
    con_by_name = {n: [TARGET_NAMES[t] for t in ts if t in TARGET_NAMES] for n, ts in tag_by_name.items()}

    # 사진 설명문 (선택). 없으면 caption·objects 칸은 비고 검색은 태그로만 된다
    cap_by_name = {}
    cap_path = os.path.join(work, 'captions.csv')
    if os.path.exists(cap_path):
        with open(cap_path, encoding='utf-8-sig', newline='') as fp:
            for r in csv.DictReader(fp):
                k = (r.get('file') or '').strip()
                if k:
                    cap_by_name[index.get(k, nfc(k))] = r
        no_cap = [n for n in index.values() if n not in cap_by_name]
        if no_cap:
            print(f'⚠ 설명문이 없는 사진 {len(no_cap)}장: ' + ', '.join(f'#{num_of[n]} {n}' for n in no_cap[:10]))

    missing = [n for n in index.values() if not tag_by_name.get(n)]
    if missing:
        print(f'⚠ 태그가 없는 사진 {len(missing)}장: ' + ', '.join(f'#{num_of[n]} {n}' for n in missing[:10]))
    unknown = sorted({t for ts in tag_by_name.values() for t in ts if t not in vocab})
    if unknown:
        print('ℹ 어휘 목록(vocab.json) 밖의 태그(한국어 그대로만 검색됨): ' + ', '.join(unknown))

    rows, used, flag_rows = [], {}, []
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
            c = cap_by_name.get(name, {})
            objs = ';'.join(o.strip() for o in (c.get('objects') or '').split(';') if o.strip())
            rows.append([jpg, ';'.join(tag_by_name.get(name, [])), ';'.join(con_by_name.get(name, [])), (c.get('caption') or '').strip(), objs])
            if (c.get('flags') or '').strip() or (c.get('note') or '').strip():
                flag_rows.append([jpg, (c.get('flags') or '').strip(), (c.get('note') or '').strip()])
        s = io.StringIO()
        w = csv.writer(s, lineterminator='\n')
        w.writerow(['file', 'tags', 'contains', 'caption', 'objects'])
        w.writerows(rows)
        csv_text = '﻿' + s.getvalue()
        z.writestr('pool.csv', csv_text.encode('utf-8'))
    with open(os.path.join(work, 'pool.csv'), 'w', encoding='utf-8', newline='') as fp:
        fp.write(csv_text)
    # 확인 표시(모델 추정: 워터마크·렌더 의심·AI 의심·저화질 …)는 pool.csv에 넣지 않고 따로 둔다 (ZIP에도 넣지 않음)
    if cap_by_name:
        with open(os.path.join(work, 'pool_flags.csv'), 'w', encoding='utf-8', newline='') as fp:
            fp.write('\ufeff')
            fw = csv.writer(fp, lineterminator='\n')
            fw.writerow(['file', 'flags', 'note'])
            fw.writerows(flag_rows)

    size = os.path.getsize(out_zip) / 1024 / 1024
    print(f'완료: 사진 {len(rows)}장 · 태그 평균 {sum(len(r[1].split(";")) for r in rows if r[1]) / max(1, len(rows)):.1f}개 · ZIP {size:.1f}MB')
    print(f'  ZIP   {out_zip}')
    print(f'  CSV   {os.path.join(work, "pool.csv")}')
    if cap_by_name:
        print(f'  설명문 {sum(1 for r in rows if r[3])}장 · 확인 표시 {sum(1 for r in flag_rows if r[1])}장 → {os.path.join(work, "pool_flags.csv")}')
    counts = {t: sum(t in r[2].split(';') for r in rows) for t in TARGET_NAMES.values()}
    print('  타깃 요소가 보이는 사진: ' + ' · '.join(f'{t} {c}' for t, c in counts.items()) + f' · 하나도 없음 {sum(not r[2] for r in rows)}')


if __name__ == '__main__':
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    main(*sys.argv[1:])
