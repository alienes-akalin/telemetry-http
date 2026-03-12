import re
with open(r'public\index.html', 'r', encoding='utf-8') as f:
    h = f.read()

# Find nav menu strings
idx = h.find('fa-flag-checkered')
print('Race nav area:', repr(h[idx-5:idx+80]))

idx2 = h.find('fa-clock-rotate')
print('History nav area:', repr(h[idx2-5:idx2+80]))

idx3 = h.find('fa-map-location')
print('Map nav area:', repr(h[idx3-5:idx3+80]))

idx4 = h.find('sidebar-title') if 'sidebar-title' in h else h.find('1.5 ADANA')
print('Title area:', repr(h[idx4:idx4+80]))
