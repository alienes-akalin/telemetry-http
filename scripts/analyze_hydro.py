from PIL import Image
import os

src = Image.open(r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img\hydro_4.png').convert('RGBA')
pixels = src.load()
w, h = src.size
print(f'Resim: {w}x{h}')

# Alt %30'luk bölgeyi analiz et (kayıp çizgiler burada)
bottom_start = int(h * 0.7)
samples = []
for y in range(bottom_start, h, 2):
    for x in range(0, w, 2):
        r, g, b, a = pixels[x, y]
        if a > 0:
            diff_gr = g - r
            diff_br = b - r
            # Herhangi bir renkli piksel (beyaz/gri değil)
            if not (r > 200 and g > 200 and b > 200 and abs(r-g)<15 and abs(g-b)<15):
                samples.append((r,g,b,diff_gr,diff_br,a))

print(f'Alt bolgede beyaz olmayan piksel sayisi: {len(samples)}')
# Ozgun renkleri listele
from collections import Counter
top = Counter([(r,g,b,dg,db) for r,g,b,dg,db,a in samples]).most_common(30)
for (r,g,b,dg,db), cnt in top:
    print(f'  {cnt:4d}x  r={r:3d} g={g:3d} b={b:3d}  g-r={dg:3d} b-r={db:3d}')
src.close()
