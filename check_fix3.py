import re
with open(r'public\index.html', 'r', encoding='utf-8') as f:
    h = f.read()

idx = h.find('fa-flag-checkered')
print('Race:', repr(h[idx+20:idx+55]))
broken = re.findall(r'[ÃÄÅ][\xa7\xbc\xb6\xb0\xb1\u2021\u2013\u0153\u0178\u017e]', h)
print('Bozuklar:', broken[:10])
