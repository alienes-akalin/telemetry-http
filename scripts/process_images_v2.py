from PIL import Image, ImageFilter, ImageEnhance
import os

# Configuration - BRIGHTER, MORE VIVID CYAN
cyan_color = (0, 255, 255)  # Pure bright cyan

# Files to process
files = [
    'header-side.png',
    'header-front.png', 
    'header-top.png',
    'header-iso.png'
]

# Paths
source_dir = r"C:\Users\ALI\.gemini\antigravity\brain\58b6a873-640e-4a05-9cab-830277833111"
output_dir = r"c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img"

# Original file names (the initial sketches we generated)
source_files = {
    'header-side.png': 'sketch_side_1768771388375.png',
    'header-front.png': 'sketch_front_1768771404735.png',
    'header-top.png': 'sketch_top_corrected_1768771786239.png',
    'header-iso.png': 'sketch_iso_1768771444825.png'
}

def process_image(output_name, source_name):
    source_path = os.path.join(source_dir, source_name)
    output_path = os.path.join(output_dir, output_name)
    
    if not os.path.exists(source_path):
        print(f"Source not found: {source_path}")
        return
    
    print(f"Processing {source_name} -> {output_name}...")
    
    # Load original image
    img = Image.open(source_path)
    
    # Convert to grayscale
    gray = img.convert('L')
    
    # ENHANCE CONTRAST - make lines darker, background whiter
    enhancer = ImageEnhance.Contrast(gray)
    gray = enhancer.enhance(2.0)  # Double the contrast
    
    # Threshold to make lines more solid
    # Anything below threshold becomes black (line), above becomes white (bg)
    threshold = 200
    gray = gray.point(lambda p: 0 if p < threshold else 255)
    
    width, height = img.size
    
    # Create result with transparent background
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    result_pixels = result.load()
    gray_pixels = gray.load()
    
    for y in range(height):
        for x in range(width):
            brightness = gray_pixels[x, y]
            # After threshold: 0 = line (full alpha), 255 = background (no alpha)
            if brightness == 0:
                alpha = 255  # Fully visible line
            else:
                alpha = 0  # Transparent background
            
            result_pixels[x, y] = cyan_color + (alpha,)
    
    # Save
    result.save(output_path, "PNG")
    print(f"Saved {output_name}")

if __name__ == "__main__":
    for output_name, source_name in source_files.items():
        process_image(output_name, source_name)
    print("Done! All header images processed with bright cyan lines.")
