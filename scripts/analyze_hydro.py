from PIL import Image
import os

src = Image.open(r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img\hydro_4.png').convert('RGBA')
pixels = src.load()
w, h = src.size

# Tum piksellerin parlaklik histogramini cikar
hist = [0]*256
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if a > 0:
            avg = (r + g + b) // 3
            hist[avg] += 1

print('Parlaklik dagilimi (sadece >50 piksel olan):')
for i, cnt in enumerate(hist):
    if cnt > 50:
        print(f'  avg={i:3d}: {cnt:7d} piksel')

# Arka plan (en yaygin beyaz) vs cizgi ayrimi
total = sum(hist)
white_count = sum(hist[230:])
line_count = sum(hist[:230])
print(f'\nToplam: {total}, Beyaz(>230): {white_count} ({100*white_count//total}%), Cizgi(<230): {line_count} ({100*line_count//total}%)')
src.close()
