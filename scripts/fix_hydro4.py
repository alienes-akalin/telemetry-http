from PIL import Image
import os

cyan_color = (6, 182, 212)
img_dir = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'

def process_hydro4():
    src_path = os.path.join(img_dir, 'hydro_4.png')
    out_path = os.path.join(img_dir, 'header-hydro-top.png')
    ref_path = os.path.join(img_dir, 'header-top.png')

    img = Image.open(src_path).convert('RGBA')
    pixels = img.load()
    width, height = img.size
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    rp = result.load()

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 30:
                continue

            diff_gr = g - r
            diff_br = b - r
            diff_max = max(abs(r-g), abs(g-b), abs(r-b))

            # 1) Guclu cyan cizgiler
            if diff_gr > 40 and diff_br > 35:
                rp[x, y] = cyan_color + (255,)

            # 2) Zayif cyan (anti-aliasing kenarlari)
            elif diff_gr > 8 and diff_br > 8 and r < 232:
                strength = min(240, int((diff_gr + diff_br) * 4))
                if strength > 60:
                    rp[x, y] = cyan_color + (strength,)

            # 3) GRI cizgiler: r≈g≈b ve koyu (arka plan beyaz=255, cizgiler <185)
            elif diff_max < 12 and r < 188:
                # Koyulugu alpha'ya donustur: ne kadar koyu -> o kadar opak
                strength = min(255, int((188 - r) * 3.5))
                if strength > 80:
                    rp[x, y] = cyan_color + (strength,)

    # Icerik sinirlari
    min_x, min_y, max_x, max_y = width, height, 0, 0
    rp2 = result.load()
    for y in range(height):
        for x in range(width):
            if rp2[x, y][3] > 40:
                min_x = min(min_x, x); min_y = min(min_y, y)
                max_x = max(max_x, x); max_y = max(max_y, y)
    if max_x > min_x and max_y > min_y:
        pad = 12
        result = result.crop((max(0,min_x-pad), max(0,min_y-pad),
                               min(width,max_x+pad), min(height,max_y+pad)))
    cw, ch = result.size
    print(f'  Icerik: {cw}x{ch}')

    ref_img = Image.open(ref_path)
    ref_w, ref_h = ref_img.size
    ref_img.close()
    target_w = int(ref_w * 1.4)
    target_h = int(ref_h * 1.4)
    scale = min(target_w / cw, target_h / ch)
    new_w = int(cw * scale)
    new_h = int(ch * scale)
    result = result.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    ox = (target_w - new_w) // 2
    oy = (target_h - new_h) // 2
    canvas.paste(result, (ox, oy), result)
    print(f'  Canvas: {target_w}x{target_h}')
    canvas.save(out_path, 'PNG')
    print('  Kaydedildi: header-hydro-top.png')

process_hydro4()
print('Bitti!')
