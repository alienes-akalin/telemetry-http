from PIL import Image, ImageFilter
import os

directory = r"c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img"
cyan_color = (0, 255, 255)

def make_front_thicker_and_bold():
    path = os.path.join(directory, 'header-front.png')
    img = Image.open(path).convert('RGBA')
    
    # 1. Extract alpha channel
    r, g, b, a = img.split()
    
    # 2. Threshold alpha to get solid shape
    # Any pixel with alpha > 10 becomes 255
    mask = a.point(lambda p: 255 if p > 10 else 0)
    
    # 3. Dilate the mask (make lines thicker)
    # Using MaxFilter to expand white areas
    from PIL import ImageFilter
    thicker_mask = mask.filter(ImageFilter.MaxFilter(3)) # Expand by 1 pixel radius (3x3 kernel)
    
    # 4. Create new pure cyan image
    result = Image.new('RGBA', img.size, (0, 0, 0, 0))
    result_pixels = result.load() # Defined correctly here
    mask_pixels = thicker_mask.load()
    
    width, height = img.size
    for y in range(height):
        for x in range(width):
            if mask_pixels[x, y] > 0:
                result_pixels[x, y] = (0, 255, 255, 255)
    
    result.save(path, 'PNG')
    print(f"Made front view THICKER and BOLD - size: {img.size}")

if __name__ == "__main__":
    make_front_thicker_and_bold()
