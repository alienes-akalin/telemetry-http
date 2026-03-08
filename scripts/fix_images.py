from PIL import Image, ImageEnhance
import os

directory = r"c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img"

# 1. Make front view (image 2) more prominent
def enhance_front_view():
    path = os.path.join(directory, 'header-front.png')
    img = Image.open(path).convert('RGBA')
    
    # Get alpha channel and enhance it
    r, g, b, a = img.split()
    
    # Increase alpha values (make lines more opaque)
    a = a.point(lambda p: min(255, int(p * 1.5)) if p > 20 else 0)
    
    # Merge back
    img = Image.merge('RGBA', (r, g, b, a))
    img.save(path, 'PNG')
    print("Enhanced front view")

# 2. Rotate top view (image 3) 90 degrees
def rotate_top_view():
    path = os.path.join(directory, 'header-top.png')
    img = Image.open(path).convert('RGBA')
    
    # Rotate 90 degrees counter-clockwise
    rotated = img.rotate(90, expand=True)
    
    print(f"Top view: {img.size} -> {rotated.size}")
    rotated.save(path, 'PNG')
    print("Rotated top view 90 degrees")

if __name__ == "__main__":
    enhance_front_view()
    rotate_top_view()
    print("Done!")
