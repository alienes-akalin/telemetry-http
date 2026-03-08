from PIL import Image
import os

directory = r"c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img"
cyan_color = (0, 255, 255) # Pure bright cyan

def force_bold_front():
    path = os.path.join(directory, 'header-front.png')
    img = Image.open(path).convert('RGBA')
    
    pixels = img.load()
    width, height = img.size
    
    # Force all visible pixels to be pure cyan and fully opaque
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # If there is ANY visibility (alpha > 0), make it max brightness
            if a > 0:
                pixels[x, y] = (0, 255, 255, 255)
    
    img.save(path, 'PNG')
    print(f"Forced front view to pure cyan/solid - size: {img.size}")

if __name__ == "__main__":
    force_bold_front()
