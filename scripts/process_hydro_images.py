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
        print(f'Kaynak bulunamadi: {source_path}')
        return
    print(f'Isleniyor: {source_name} -> {output_name}')
    img = Image.open(source_path).convert('RGBA')
    width, height = img.size
    pixels = img.load()
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Zaten seffaf: atla
            if a < 30:
                continue
            # Notral gri tespiti: R~G~B (hem acik hem koyu kareler)
            # 25 tolerans, avg > 80 (koyu kareler ~128, acik kareler ~192)
            avg = (r + g + b) / 3
            diff = max(abs(r - g), abs(g - b), abs(r - b))
            if diff < 30 and avg > 80:
                continue  # Kareli arkaplan -> seffaf
            # Cizgi pikseli: kucultme oncesi TAM opak yap (255)
            # Boylece LANCZOS kucultme sonrasi cizgiler kaybolmaz
            result_pixels[x, y] = cyan_color + (255,)
    # Shell referans boyutuna olceklendir
    ref_name = shell_refs.get(output_name)
    if ref_name:
        ref_path = os.path.join(img_dir, ref_name)
        if os.path.exists(ref_path):
            ref_img = Image.open(ref_path)
            ref_w, ref_h = ref_img.size
            ref_img.close()
            result.thumbnail((ref_w, ref_h), Image.LANCZOS)
            canvas = Image.new('RGBA', (ref_w, ref_h), (0, 0, 0, 0))
            offset_x = (ref_w - result.width) // 2
            offset_y = (ref_h - result.height) // 2
            canvas.paste(result, (offset_x, offset_y), result)
            result = canvas
            print(f'  {width}x{height} -> {ref_w}x{ref_h}')
    result.save(output_path, 'PNG')
    print(f'  Kaydedildi: {output_name}')

for out, src in files.items():
    process_image(out, src)
print('Tum Hydro resimleri islendi!')
