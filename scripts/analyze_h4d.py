from PIL import Image
import os

img_dir = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'
src = Image.open(os.path.join(img_dir, 'hydro_4.png')).convert('RGB')
px = src.load()
w, h = src.size

# Koseler - ilk ve son 10 piksel
corners = [(0,0), (10,10), (w-1,0), (0,h-1), (w-1,h-1)]
for cx, cy in corners:
    r,g,b = px[cx,cy]
    avg = (r+g+b)//3
    print(f'({cx},{cy}): rgb=({r},{g},{b}) avg={avg}')

# Kenar satirlar: y=0 ve y=h-1'de kac piksel <200?
for y in [0, 1, h-2, h-1]:
    dark = sum(1 for x in range(w) if sum(px[x,y])//3 < 200)
    print(f'y={y}: dark(<200) = {dark}')

for x in [0, 1, w-2, w-1]:
    dark = sum(1 for y in range(h) if sum(px[x,y])//3 < 200)
    print(f'x={x}: dark(<200) = {dark}')

# Threshold 190'a dusurerek bak
for thresh in [200, 195, 190, 185]:
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            avg = sum(px[x,y])//3
            if avg < thresh:
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
    if max_x > min_x:
        print(f'thresh<{thresh}: ({min_x},{min_y})-({max_x},{max_y}) = {max_x-min_x}x{max_y-min_y}')
    else:
        print(f'thresh<{thresh}: no content')
