from PIL import Image, ImageFilter
import os

cyan = (6, 182, 212)
img_dir = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'

src = Image.open(os.path.join(img_dir, 'hydro_4.png')).convert('RGB')
w, h = src.size
px = src.load()

# 1) Cizgi maskesi olustur (threshold < 195)
mask = Image.new('L', (w, h), 0)
mp = mask.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        avg = (r + g + b) // 3
        if avg < 180:
            mp[x, y] = min(255, (185 - avg) * 3)
        elif avg < 195:
            mp[x, y] = 40

# 2) Cizgileri kalinlastir (dilate = MaxFilter)
mask = mask.filter(ImageFilter.MaxFilter(3))
# Hafif yumusat
mask = mask.filter(ImageFilter.GaussianBlur(radius=0.8))

mp = mask.load()

# 3) Cyan renkle boyama
result = Image.new('RGBA', (w, h), (0, 0, 0, 0))
rp = result.load()
for y in range(h):
    for x in range(w):
        a = mp[x, y]
        if a > 15:
            rp[x, y] = cyan + (min(255, a),)

# 4) Crop (kenar marjini ile)
margin = 60
min_x, min_y, max_x, max_y = w, h, 0, 0
for y in range(margin, h - margin):
    for x in range(margin, w - margin):
        if rp[x, y][3] > 25:
            if x < min_x: min_x = x
            if y < min_y: min_y = y
            if x > max_x: max_x = x
            if y > max_y: max_y = y
print(f'Content: ({min_x},{min_y})-({max_x},{max_y})')

pad = 20
c = result.crop((max(0,min_x-pad), max(0,min_y-pad),
                  min(w,max_x+pad), min(h,max_y+pad)))
cw, ch = c.size
print(f'Crop: {cw}x{ch}')

# 5) Reference boyut (1.4x)
ref = Image.open(os.path.join(img_dir, 'header-top.png'))
rw, rh = ref.size
ref.close()
tw, th = int(rw * 1.4), int(rh * 1.4)
scale = min(tw / cw, th / ch)
nw, nh = int(cw * scale), int(ch * scale)
c = c.resize((nw, nh), Image.LANCZOS)

canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
ox, oy = (tw - nw) // 2, (th - nh) // 2
canvas.paste(c, (ox, oy), c)
canvas.save(os.path.join(img_dir, 'header-hydro-top.png'), 'PNG')
print(f'Final: {tw}x{th} -> OK!')
