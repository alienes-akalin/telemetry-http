from PIL import Image
import os

img_dir = r'public\img'
src = Image.open(os.path.join(img_dir, 'hydro_2.png')).convert('RGB')
px = src.load()
w, h = src.size

# Let's sample a region that might be the "window"
# Looking at the original dimensions 2458x1696
# We can sample middle-top
print(f"hydro_2.png size: {w}x{h}")
for y in range(h//4, h//2, 100):
    for x in range(w//2 - 200, w//2 + 200, 100):
        r, g, b = px[x, y]
        diff_g = g - r
        diff_b = b - r
        print(f"({x}, {y}): RGB=({r},{g},{b}) diff_g={diff_g} diff_b={diff_b}")

