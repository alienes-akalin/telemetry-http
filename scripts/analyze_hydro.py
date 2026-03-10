from PIL import Image
from collections import Counter
import os

src = Image.open(r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img\hydro_4.png').convert('RGBA')
pixels = src.load()
w, h = src.size

# Tum opak piksellerin g-r ve b-r dagilimi
samples = []
for y in range(0, h, 3):
    for x in range(0, w, 3):
        r, g, b, a = pixels[x, y]
        if a > 0 and not (r > 230 and g > 230 and b > 230):  # beyaz hariç
            diff_gr = g - r
            diff_br = b - r
            samples.append((diff_gr, diff_br, r, g, b))

# Esige gore piksel sayisi
thresholds = [(20,15), (30,25), (40,35), (45,40), (50,45), (55,50), (60,55)]
total = len(samples)
print(f'Toplam opak, beyaz olmayan piksel: {total}')
for tg, tb in thresholds:
    cnt = sum(1 for dg,db,r,g,b in samples if dg>tg and db>tb)
    print(f'  g-r>{tg} ve b-r>{tb}: {cnt} piksel ({100*cnt//max(total,1)}%)')

# En koyu/zayif cyan ornekleri goster
weak = [(r,g,b,g-r,b-r) for dg,db,r,g,b in samples if 10<dg<45 and 5<db<40]
from collections import Counter
top_weak = Counter(weak).most_common(15)
print('\nZayif cyan pikseller (g-r or b-r esige yakin):')
for (r,g,b,dgr,dbr), cnt in top_weak:
    print(f'  {cnt:4d}x  r={r:3d} g={g:3d} b={b:3d}  g-r={dgr} b-r={dbr}')
src.close()
