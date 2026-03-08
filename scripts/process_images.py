from PIL import Image
import os
import sys

# Konfigürasyon
# Camgöbeği/Turkuaz rengi (R, G, B)
cyan_color = (6, 182, 212) # Daha iyi görünürlük için Tailwind/CSS paletinden güzel bir turkuaz-500

files = [
    'header-side.png',
    'header-front.png',
    'header-top.png',
    'header-iso.png',
    'race-bg.png'
]
directory = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'

def process_image(filename):
    path = os.path.join(directory, filename)
    if not os.path.exists(path):
        print(f"Dosya bulunamadı: {path}")
        return

    try:
        print(f"İşleniyor {filename}...")
        # Görüntüyü aç
        img = Image.open(path)
        
        # Gri tonlamaya çevir
        gray = img.convert('L')
        
        # Hedef renkle dolu yeni bir RGBA görüntüsü oluştur
        colored_img = Image.new('RGBA', img.size, cyan_color + (0,))
        
        # Piksel verilerini al
        pixels = colored_img.load()
        gray_pixels = gray.load()
        
        width, height = img.size
        for y in range(height):
            for x in range(width):
                # Parlaklığı al (0=siyah çizgi, 255=beyaz arkaplan)
                brightness = gray_pixels[x, y]
                
                # Alpha hesapla: 
                # Koyu piksellerin opak, açık piksellerin şeffaf olmasını istiyoruz
                # Basit ters çevirme: 255 - brightness
                alpha = 255 - brightness
                
                # Gerekirse "kirli" beyazları temizlemek için bir eşik veya eğri uygulayın
                # Şimdilik basit doğrusal haritalama
                
                if alpha < 10: alpha = 0 # Saf beyaz arkaplan gürültüsünü temizle
                
                pixels[x, y] = cyan_color + (alpha,)
        
        # Geri kaydet
        colored_img.save(path, "PNG")
        print(f"Kaydedildi {filename}")
        
    except Exception as e:
        print(f"Hata oluştu {filename}: {e}")

if __name__ == "__main__":
    # PIL'in kurulu olduğundan emin olun veya hatayı yönetin
    try:
        import PIL
    except ImportError:
        print("Pillow bulunamadı. Lütfen şu komutla yükleyin: pip install Pillow")
        sys.exit(1)

    for f in files:
        process_image(f)
