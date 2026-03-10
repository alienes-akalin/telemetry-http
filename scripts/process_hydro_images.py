from PIL import Image, ImageEnhance
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
    rgb = img.convert('RGB')
    gray = rgb.convert('L')
    enhancer = ImageEnhance.Contrast(gray)
    gray = enhancer.enhance(1.8)
    gray_pixels = gray.load()
    rgb_pixels = rgb.load()
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()
    for y in range(height):
        for x in range(width):
            r, g, b = rgb_pixels[x, y]
            brightness = gray_pixels[x, y]
            is_cyan = (g > 120 and b > 120 and r < 100) or (g > 100 and b > 140 and r < 80) or (g > 80 and b > 80 and r < 60 and brightness < 200)
            is_dark = brightness < 140
            is_checker = (180 <= r <= 210 and 180 <= g <= 210 and 180 <= b <= 210) or (r >= 240 and g >= 240 and b >= 240)
            if is_cyan:
                intensity = max(0, 255 - brightness)
                alpha = max(intensity, 180)
                result_pixels[x, y] = cyan_color + (min(alpha, 255),)
            elif is_dark and not is_checker:
                alpha = max(0, 255 - brightness)
                if alpha > 30:
                    result_pixels[x, y] = cyan_color + (alpha,)
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
            print(f'  Boyut: {width}x{height} -> {ref_w}x{ref_h}')
    result.save(output_path, 'PNG')
    print(f'  Kaydedildi: {output_name}')

for out, src in files.items():
    process_image(out, src)
print('Tum Hydro resimleri islendi!')
