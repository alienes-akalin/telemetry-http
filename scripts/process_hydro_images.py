from PIL import Image
import os

cyan_color = (6, 182, 212)

files = {
    'header-hydro-side.png': 'hydro_1.png',
    'header-hydro-front.png': 'hydro_2.png',
    'header-hydro-iso.png': 'hydro_3.png',
    'header-hydro-top.png': 'hydro_4.png',
}

shell_refs = {
    'header-hydro-side.png': 'header-side.png',
    'header-hydro-front.png': 'header-front.png',
    'header-hydro-iso.png': 'header-iso.png',
    'header-hydro-top.png': 'header-top.png',
}

img_dir = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'

def process_image(output_name, source_name):
    source_path = os.path.join(img_dir, source_name)
    output_path = os.path.join(img_dir, output_name)
    if not os.path.exists(source_path):
        print(f'Kaynak bulunamadi: {source_path}'); return
    print(f'Isleniyor: {source_name} -> {output_name}')
    img = Image.open(source_path).convert('RGBA')
    pixels = img.load()
    width, height = img.size
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    rp = result.load()

    # RENK BAZLI filtre: Arka plan beyaz (r=g=b), cizgiler cyan (g ve b > r)
    # Tutarli dis kontur: g-r > 45 ve b-r > 40
    # Anti-aliasing icin biraz daha esnek: toplam sapma > 70
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 30:
                continue  # seffaf
            diff_gr = g - r  # Cyan'da pozitif
            diff_br = b - r  # Cyan'da pozitif
            if diff_gr > 45 and diff_br > 40:
                # Kuvvetli - tam opak
                rp[x, y] = cyan_color + (255,)
            elif diff_gr > 25 and diff_br > 20 and (diff_gr + diff_br) > 70:
                # Hafif anti-aliasing kenari - yari opak
                strength = min(255, int((diff_gr + diff_br) * 1.5))
                rp[x, y] = cyan_color + (strength,)
            # Diger: seffaf (arka plan, ic boyama)

    # Icerik sinirlari
    rp2 = result.load()
    min_x, min_y, max_x, max_y = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            if rp2[x, y][3] > 20:
                min_x = min(min_x, x); min_y = min(min_y, y)
                max_x = max(max_x, x); max_y = max(max_y, y)
    if max_x > min_x and max_y > min_y:
        pad = 10
        result = result.crop((max(0,min_x-pad), max(0,min_y-pad), min(width,max_x+pad), min(height,max_y+pad)))
    cw, ch = result.size
    print(f'  Icerik: {cw}x{ch}')

    # Referans boyutuda 1.4x buyut
    ref_name = shell_refs.get(output_name)
    if ref_name:
        ref_path = os.path.join(img_dir, ref_name)
        if os.path.exists(ref_path):
            ref_img = Image.open(ref_path)
            ref_w, ref_h = ref_img.size
            ref_img.close()
            target_w = int(ref_w * 1.4)
            target_h = int(ref_h * 1.4)
            # FIT icinde buyut
            scale = min(target_w / cw, target_h / ch)
            new_w = int(cw * scale)
            new_h = int(ch * scale)
            result = result.resize((new_w, new_h), Image.LANCZOS)
            canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
            ox = (target_w - new_w) // 2
            oy = (target_h - new_h) // 2
            canvas.paste(result, (ox, oy), result)
            result = canvas
            print(f'  Scale:{scale:.2f} -> {new_w}x{new_h} -> canvas:{target_w}x{target_h}')

    result.save(output_path, 'PNG')
    print(f'  Kaydedildi: {output_name}')

for out, src in files.items():
    process_image(out, src)
print('Tum Hydro resimleri islendi!')
