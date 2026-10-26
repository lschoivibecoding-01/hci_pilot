#!/usr/bin/env python3
"""사진 폴더를 6장씩 묶은 확인용 시트(contact sheet)로 만든다.

사용: python make_sheets.py <사진폴더> <작업폴더>
결과: <작업폴더>/sheets/sheet_01.jpg ... 와 <작업폴더>/index.json ({"1": "파일명", ...})
파일명은 맥에서 온 한글도 맞도록 NFC로 정규화해서 기록한다.
"""
import json
import os
import sys
import unicodedata

from PIL import Image, ImageDraw, ImageFont

EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.avif')
W, H, PER = 600, 400, 6


def list_photos(root):
    out = []
    for dp, dn, fn in os.walk(root):
        dn[:] = [d for d in dn if d != '__MACOSX' and not d.startswith('.')]
        for f in fn:
            if f.startswith('._') or f.startswith('.'):
                continue
            if f.lower().endswith(EXTS):
                out.append(os.path.join(dp, f))
    return sorted(out, key=lambda p: unicodedata.normalize('NFC', os.path.basename(p)))


def font(size):
    for path in ['/System/Library/Fonts/AppleSDGothicNeo.ttc', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
                 'C:/Windows/Fonts/malgun.ttf']:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def main(src, work):
    photos = list_photos(src)
    if not photos:
        sys.exit(f'사진이 없습니다: {src}')
    names = [unicodedata.normalize('NFC', os.path.basename(p)) for p in photos]
    dup = {n for n in names if names.count(n) > 1}
    if dup:
        sys.exit(f'같은 이름의 사진이 여러 개 있습니다. 이름을 바꿔 주세요: {sorted(dup)[:5]}')
    os.makedirs(os.path.join(work, 'sheets'), exist_ok=True)
    f = font(24)
    index = {}
    for s in range(0, len(photos), PER):
        sheet = Image.new('RGB', (W * 3, (H + 34) * 2), 'white')
        d = ImageDraw.Draw(sheet)
        for k, path in enumerate(photos[s:s + PER]):
            n = s + k + 1
            index[str(n)] = names[s + k]
            try:
                im = Image.open(path).convert('RGB')
            except Exception as e:
                print(f'읽기 실패 #{n} {names[s + k]}: {e}')
                continue
            im.thumbnail((W, H))
            x, y = (k % 3) * W, (k // 3) * (H + 34)
            sheet.paste(im, (x, y + 34))
            d.text((x + 6, y + 4), f'#{n}', fill='black', font=f)
        sheet.save(os.path.join(work, 'sheets', f'sheet_{s // PER + 1:02d}.jpg'), quality=88)
    with open(os.path.join(work, 'index.json'), 'w', encoding='utf-8') as fp:
        json.dump(index, fp, ensure_ascii=False, indent=1)
    print(f'사진 {len(photos)}장 → 시트 {(len(photos) + PER - 1) // PER}장 ({os.path.join(work, "sheets")})')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
