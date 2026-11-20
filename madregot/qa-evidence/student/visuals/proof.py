# Proof sheets for qa-evidence: python3 proof.py <shots from firsts.cjs> <outdir> topic[:stairs]... (5 stairs by default)
# With COUNCIL_SHOT=<the council's i13f-02-teach-0.png>, also the before/after of signed:1#0.
import os, sys
from PIL import Image, ImageDraw, ImageFont
src, out, topics = sys.argv[1], sys.argv[2], sys.argv[3:]
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
except Exception:
    font = ImageFont.load_default()
def sheet(files, cols, scale, captions, path, bg=(236, 238, 242)):
    ims = [Image.open(f).convert('RGB') for f in files]
    w = int(ims[0].width * scale); h = int(ims[0].height * scale)
    rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * (w + 16) + 16, rows * (h + 46) + 16), bg); d = ImageDraw.Draw(S)
    for k, (im, cap) in enumerate(zip(ims, captions)):
        r, c = divmod(k, cols); x = 16 + c * (w + 16); y = 16 + r * (h + 46)
        d.text((x, y), cap, fill=(40, 44, 52), font=font)
        S.paste(im.resize((w, h), Image.LANCZOS), (x, y + 28))
        d.rectangle([x - 1, y + 27, x + w, y + 28 + h], outline=(180, 186, 196))
    S.save(path, optimize=True)
for arg in topics:
    t, n = (arg.split(':') + ['5'])[:2]; n = int(n)
    files = []; caps = []
    for scheme in ['light', 'dark']:
        for lvl in range(1, n + 1):
            files.append(f'{src}/{t}{lvl}-first-{scheme}.png'); caps.append(f'{t}:{lvl}  {scheme}')
    sheet(files, n, 0.5, caps, f'{out}/{t}-first-steps.png')
if 'signed' in topics and os.environ.get('COUNCIL_SHOT'):
    sheet([os.environ['COUNCIL_SHOT'], f'{src}/council-after-signed1-0.png'], 2, 0.33,
          ["before: the council's i13f-02-teach-0.png", 'after: signed:1#0 with its number line'], f'{out}/council-before-after-signed1-0.png')
