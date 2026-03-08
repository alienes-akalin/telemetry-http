from PIL import Image
import os

# Kırpılacak dosyalar
files = [
    'header-side.png',
    'header-front.png', 
    'header-top.png',
    'header-iso.png'
]

directory = r"c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img"

def crop_to_content(filename):
    path = os.path.join(directory, filename)
    
    if not os.path.exists(path):
        print(f"Dosya bulunamadı: {path}")
        return
    
    print(f"İşleniyor {filename}...")
    
    # Görüntüyü yükle
    img = Image.open(path).convert('RGBA')
    
    # Şeffaf olmayan piksellerin sınırlayıcı kutusunu al
    # getbbox() (sol, üst, sağ, alt) döner
    bbox = img.getbbox()
    
    if bbox:
        # İçeriğin etrafına küçük bir boşluk (5px) ekle
        padding = 5
        left = max(0, bbox[0] - padding)
        upper = max(0, bbox[1] - padding)
        right = min(img.width, bbox[2] + padding)
        lower = min(img.height, bbox[3] + padding)
        
        # Sınırlayıcı kutuya göre kırp
        cropped = img.crop((left, upper, right, lower))
        
        print(f"  Orijinal boyut: {img.size}")
        print(f"  Kırpılmış boyut: {cropped.size}")
        
        # Kaydet
        cropped.save(path, "PNG")
        print(f"  Kaydedildi!")
    else:
        print(f"  {filename} içinde içerik bulunamadı")

if __name__ == "__main__":
    for f in files:
        crop_to_content(f)
    print("\nTamamlandı! Tüm görüntüler içerik sınırlarına göre kırpıldı.")
