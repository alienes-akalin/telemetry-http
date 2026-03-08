from PIL import Image
import os

directory = r"c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img"

def make_front_bold():
    path = os.path.join(directory, 'header-front.png')
    img = Image.open(path).convert('RGBA')
    
    pixels = img.load()
    width, height = img.size
    
    # Make all visible pixels fully opaque
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 30:  # If pixel has any significant alpha
                pixels[x, y] = (r, g, b, 255)  # Make fully opaque
    
    img.save(path, 'PNG')
    print(f"Made front view bold - size: {img.size}")

if __name__ == "__main__":
    make_front_bold()
