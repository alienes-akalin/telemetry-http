from PIL import Image, ImageFilter
import os

img_dir = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'
src = Image.open(os.path.join(img_dir, 'hydro_4.png')).convert('RGB')
w, h = src.size
px = src.load()

# Her 100 satirda parlaklik dagilimi bak
for y in range(0, h, 200):
    row_vals = [sum(px[x, y]) // 3 for x in range(w)]
    dark = sum(1 for v in row_vals if v < 200)
    mid = sum(1 for v in row_vals if 200 <= v < 230)
    bright = sum(1 for v in row_vals if v >= 230)
    min_v = min(row_vals)
    print(f'y={y:4d}: dark(<200)={dark:4d} mid(200-230)={mid:4d} bright(>=230)={bright:4d} min={min_v}')

# Dikey - her 100 sutunda
print()
for x in range(0, w, 200):
    col_vals = [sum(px[x, y]) // 3 for y in range(h)]
    dark = sum(1 for v in col_vals if v < 200)
    print(f'x={x:4d}: dark(<200)={dark:4d}')
