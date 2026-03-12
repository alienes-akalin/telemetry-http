import re
with open(r'public\index.html', 'r', encoding='utf-8') as f:
    h = f.read()

idx = h.find('fa-flag-checkered')
print('Race:', repr(h[idx+20:idx+60]))

idx = h.find('fa-clock-rotate')
print('History:', repr(h[idx+21:idx+65]))

idx = h.find('ELEKTROMOBİL')
found_i = idx != -1
idx2 = h.find('ELEKTROMOB')
print('Title has correct I:', found_i, '->', repr(h[idx2:idx2+20]))

# CSS de kontrol et
with open(r'public\css\style.css', 'r', encoding='utf-8') as f:
    c = f.read()
idx = c.find('Kenar')
print('CSS sidebar comment:', repr(c[idx:idx+40]))

# Hala bozuk olan var mi
import re
broken = re.findall(r'[ÃÄÅ][§¼¶°±\u2021\u2013\u0153\u0178\u017e]', h)
print('Hala bozuk:', broken[:10])
