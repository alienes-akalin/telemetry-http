from PIL import Image
import os

src = Image.open(r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img\hydro_1.png').convert('RGBA')
pixels = src.load()
w, h = src.size

# Cyan olmayan + seffaf olmayan tum benzersiz renk gruplarini bul
dark_pixels = []
for y in range(0, h, 5):
    for x in range(0, w, 5):
        r, g, b, a = pixels[x, y]
        # Koyu pikseller (cyan cizgiler muhtemelen burada)
        if a > 0 and (r < 180 or g < 180 or b < 180):
            dark_pixels.append((r, g, b, a))

from collections import Counter
top = Counter(dark_pixels).most_common(30)
for (r,g,b,a), cnt in top:
    print(f'{cnt:5d}x  a={a} r={r:3d} g={g:3d} b={b:3d}')
src.close()
