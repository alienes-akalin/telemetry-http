from PIL import Image, ImageFilter
import os

cyan = (6, 182, 212)
img_dir = r'c:\Users\ALI\Desktop\1.5 ADANA\telemetry-http\public\img'

def process_hydro(filename, out_filename, is_hydro4=False):
    src = Image.open(os.path.join(img_dir, filename)).convert('RGB')
    w, h = src.size
    px = src.load()
    
    # 1. Maske olustur
    mask = Image.new('L', (w, h), 0)
    mp = mask.load()
    
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if is_hydro4:
                # Hydro_4 (dama zemin vs gri cizgiler)
                avg = (r + g + b) // 3
                if avg < 190:
                    mp[x, y] = 255
                elif avg < 200:
                    mp[x, y] = 120
            else:
                # Digerleri (cyanimsi cizgiler siyah/beyaz zemin uzerinde veya alfa)
                # Orijinal hydro_1-3 beyaz/transparan uzerine cyan gibiydi
                diff_g = g - r
                diff_b = b - r
                if diff_g > 30 or diff_b > 30:
                    mp[x, y] = 255
                else:
                    avg = (r+g+b)//3
                    if avg < 200:
                        mp[x, y] = 200
                        
    # Cizgileri daha belirgin yapmak icin kalinlastir (Dilate)
    # hydro_4 cok silik oldugu icin daha sert uygula
    dilation_size = 5 if is_hydro4 else 3
    mask = mask.filter(ImageFilter.MaxFilter(dilation_size))
    # Sonra yumusat
    mask = mask.filter(ImageFilter.GaussianBlur(1.2 if is_hydro4 else 0.8))
    
    mp = mask.load()
    
    result = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    rp = result.load()
    
    min_x, min_y, max_x, max_y = w, h, 0, 0
    margin = 50 if is_hydro4 else 0
    
    for y in range(h):
        for x in range(w):
            a = mp[x, y]
            if a > 20:
                # Tam cyan yap
                rp[x, y] = cyan + (a,)
                if margin <= x < w-margin and margin <= y < h-margin:
                    if x < min_x: min_x = x
                    if y < min_y: min_y = y
                    if x > max_x: max_x = x
                    if y > max_y: max_y = y
                    
    pad = 20
    if max_x > min_x:
        c = result.crop((max(0,min_x-pad), max(0,min_y-pad), 
                          min(w,max_x+pad), min(h,max_y+pad)))
    else:
        c = result
        
    cw, ch = c.size
    
    # Referans boyuta gore uyarla
    ref_name = out_filename.replace('-hydro', '')
    ref = Image.open(os.path.join(img_dir, ref_name))
    rw, rh = ref.size
    ref.close()
    
    tw, th = int(rw * 1.4), int(rh * 1.4)
    scale = min(tw / cw, th / ch)
    nw, nh = int(cw * scale), int(ch * scale)
    c = c.resize((nw, nh), Image.LANCZOS)
    
    canvas = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    ox, oy = (tw - nw) // 2, (th - nh) // 2
    canvas.paste(c, (ox, oy), c)
    canvas.save(os.path.join(img_dir, out_filename), 'PNG')
    print(f'{filename} -> {out_filename} islendi! Boyut: {tw}x{th}')

process_hydro('hydro_1.png', 'header-hydro-side.png')
process_hydro('hydro_2.png', 'header-hydro-front.png')
process_hydro('hydro_3.png', 'header-hydro-iso.png')
process_hydro('hydro_4.png', 'header-hydro-top.png', is_hydro4=True)
