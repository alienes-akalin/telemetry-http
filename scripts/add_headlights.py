from PIL import Image, ImageDraw, ImageFilter
import os

# Konfigürasyon
cyan_color = (6, 182, 212)  # Turkuaz
white_color = (255, 255, 255)

# Dosya Yolları
source_path = r"C:\Users\ALI\.gemini\antigravity\brain\58b6a873-640e-4a05-9cab-830277833111\sketch_front_1768771404735.png"
output_path = r"c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img\race-bg.png"

def add_headlights():
    print("Orijinal ön görünüm çizimi yükleniyor...")
    
    # Orijinal görüntüyü yükle (beyaz üzerine siyah)
    img = Image.open(source_path)
    
    # Gri tonlamaya çevir
    gray = img.convert('L')
    
    width, height = img.size
    print(f"Görüntü boyutu: {width}x{height}")
    
    # Şeffaflık ile turkuaz versiyon oluştur
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()
    gray_pixels = gray.load()
    
    for y in range(height):
        for x in range(width):
            brightness = gray_pixels[x, y]
            alpha = 255 - brightness
            if alpha < 15:
                alpha = 0  # Arkaplanı temizle
            result_pixels[x, y] = cyan_color + (alpha,)
    
    print("Turkuaza dönüştürüldü...")
    
    # Şimdi LED farları ekle
    # Ön görünüme göre, farlar dış kenarlarda
    # gövdenin alt kısmına yakın (ön tampon bölgesinde)
    
    # Yaklaşık konumlar (görüntü boyutlarına göre ayarlayın)
    # 1024x1024 görüntü için, araç gövdesi kabaca:
    # - Sol taraf x=180-280 civarı
    # - Sağ taraf x=740-840 civarı
    # - Dikey olarak, farlar y=580-620 civarı
    
    # Ölçek faktörleri
    scale_x = width / 1024
    scale_y = height / 1024
    
    # Sol far grubu (3 LED yan yana)
    left_x_start = int(195 * scale_x)
    left_y = int(595 * scale_y)
    led_spacing = int(18 * scale_x)
    led_radius = int(6 * scale_x)
    
    # Sağ far grubu (3 LED yan yana) - solun aynası
    right_x_start = int(810 * scale_x)
    
    draw = ImageDraw.Draw(result)
    
    # Parıltı katmanı oluştur
    glow_layer = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    
    def draw_led(x, y, radius):
        # Dış parıltıyı çiz (daha büyük, yarı şeffaf)
        glow_radius = radius * 3
        for i in range(glow_radius, 0, -1):
            alpha = int(80 * (1 - i / glow_radius))  # Sönümle
            glow_draw.ellipse(
                [x - i, y - i, x + i, y + i],
                fill=(255, 255, 255, alpha)
            )
        # Çekirdek LED'i çiz (parlak beyaz)
        draw.ellipse(
            [x - radius, y - radius, x + radius, y + radius],
            fill=(255, 255, 255, 255)
        )
    
    # Sol grubu çiz (3 LED)
    for i in range(3):
        x = left_x_start + i * led_spacing
        draw_led(x, left_y, led_radius)
    
    # Sağ grubu çiz (3 LED) - sağdan sola doğru
    for i in range(3):
        x = right_x_start - i * led_spacing
        draw_led(x, left_y, led_radius)
    
    print("LED farlar eklendi...")
    
    # Parıltı katmanına hafif bulanıklık uygula ve birleştir
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=8))
    
    # Kompozit: parıltı arkada, ana görüntü üstte
    final = Image.alpha_composite(glow_layer, result)
    
    # Kaydet
    final.save(output_path, "PNG")
    print(f"Kaydedildi: {output_path}")

if __name__ == "__main__":
    add_headlights()
