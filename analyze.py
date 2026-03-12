from PIL import Image
import os

img_dir = r'public\img'
files = ['hydro_1.png', 'hydro_2.png', 'hydro_3.png', 'hydro_4.png']

for f in files:
    try:
        img = Image.open(os.path.join(img_dir, f))
        mode = img.mode
        img = img.convert('RGBA')
        px = img.load()
        w, h = img.size
        # Sample points: top-left, top-right, bottom-left, bottom-right, center
        pts = [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]
        s_rgba = [px[x,y] for x,y in pts]
        print(f'{f} ({mode}): {w}x{h}')
        for i, pt in enumerate(pts):
            print(f'  {pt}: {s_rgba[i]}')
        
    except Exception as e:
        print(f'Error reading {f}: {e}')
