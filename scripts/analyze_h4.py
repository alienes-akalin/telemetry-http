from PIL import Image, ImageFilter
import os

img_dir = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'
src = Image.open(os.path.join(img_dir, 'hydro_4.png')).convert('RGB')
w, h = src.size

# Dama kare boyutunu tespit et - ilk satırda parlaklık geçişlerini say
px = src.load()
row = [sum(px[x, h//2]) // 3 for x in range(min(200, w))]
transitions = 0
for i in range(1, len(row)):
    if abs(row[i] - row[i-1]) > 20:
        transitions += 1
print(f'Boyut: {w}x{h}')
print(f'Ilk 200 px gecis sayisi: {transitions}')
print(f'Orta satir ilk 40 parlaklik: {row[:40]}')

# 5x5 kare ortalama ile dama'yi yok et
gray = src.convert('L')
smoothed = gray.filter(ImageFilter.MedianFilter(size=11))
spx = smoothed.load()
sample = [spx[x, h//2] for x in range(min(200, w))]
print(f'Smoothed ilk 40: {sample[:40]}')

# Smoothed uzerinde threshold
count_below = sum(1 for y in range(h) for x in range(w) if spx[x, y] < 210)
count_below2 = sum(1 for y in range(h) for x in range(w) if spx[x, y] < 220)
total = w * h
print(f'Toplam: {total}, <210: {count_below} ({100*count_below/total:.1f}%), <220: {count_below2} ({100*count_below2/total:.1f}%)')
