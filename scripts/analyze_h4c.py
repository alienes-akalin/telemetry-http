from PIL import Image
import os

img_dir = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'
src = Image.open(os.path.join(img_dir, 'hydro_4.png')).convert('RGB')
px = src.load()
w, h = src.size

# y=0 satirinda ilk 60 piksel - checkerboard pattern'i gor
vals = [sum(px[x, 0]) // 3 for x in range(60)]
print('y=0, x=0..59:', vals)
# y=1 satirinda
vals1 = [sum(px[x, 1]) // 3 for x in range(60)]
print('y=1, x=0..59:', vals1)

# Dama kareleri tespit: ayni deger bloklari bul
y = 0
run_start = 0
current = 'B' if vals[0] >= 230 else 'M'
runs = []
for x in range(1, 60):
    cat = 'B' if vals[x] >= 230 else 'M'
    if cat != current:
        runs.append((current, x - run_start))
        run_start = x
        current = cat
runs.append((current, 60 - run_start))
print('Runs:', runs[:20])

# Bir cizgi bolgesinde bak: y=500, x=800-900
line_vals = [sum(px[x, 500]) // 3 for x in range(800, 900)]
print('y=500, x=800-899:', line_vals)
