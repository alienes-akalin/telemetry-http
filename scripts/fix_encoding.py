# -*- coding: utf-8 -*-
# Pyhon 3 - Mojibake duzeltici
# CP1252 uzerinden yanlis okunan UTF-8 karakterleri duzeltir

import os

files_to_fix = [
    r'public\index.html',
    r'public\css\style.css',
    r'public\js\app.js',
    r'public\sw.js',
]

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        print(f'SKIP: {filepath} not found')
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()
    
    # Reverse the double-encoding:
    # File was UTF-8 -> PowerShell read as CP1252 -> saved back as UTF-8
    # Reverse: read as UTF-8 -> encode as CP1252 -> decode as UTF-8
    try:
        fixed = original.encode('cp1252', errors='strict').decode('utf-8', errors='strict')
    except (UnicodeEncodeError, UnicodeDecodeError):
        # Fallback: only fix known Turkish mojibake pairs
        fixed = original
        mojibake_map = [
            ('\u00c3\u00bc', '\u00fc'),  # u00fc = u, Ã¼ -> u
            ('\u00c3\u00b6', '\u00f6'),  # u00f6 = o, Ã¶ -> o  
            ('\u00c3\u00a7', '\u00e7'),  # u00e7 = c, Ã§ -> c
            ('\u00c3\u0096', '\u00d6'),  # u00d6 = O, Ã– -> O
            ('\u00c3\u009c', '\u00dc'),  # u00dc = U, Ãœ -> U
            ('\u00c3\u0087', '\u00c7'),  # u00c7 = C, Ã‡ -> C
            ('\u00c4\u00b1', '\u0131'),  # u0131 = dotless i, Ä± -> i
            ('\u00c4\u00b0', '\u0130'),  # u0130 = I, Ä° -> I
            ('\u00c4\u009f', '\u011f'),  # u011f = g, ÄŸ -> g
            ('\u00c4\u009e', '\u011e'),  # u011e = G, Äž -> G
            ('\u00c5\u009f', '\u015f'),  # u015f = s, ÅŸ -> s
            ('\u00c5\u009e', '\u015e'),  # u015e = S, Åž -> S
        ]
        for wrong, right in mojibake_map:
            fixed = fixed.replace(wrong, right)
        print(f'  Used regex fallback for {filepath}')

    # Count changed chars
    changed = sum(1 for a, b in zip(original, fixed) if a != b)
    extra = abs(len(fixed) - len(original))
    print(f'{filepath}: {changed} char diffs, length diff: {extra}')
    
    # Write back WITHOUT BOM (utf-8, not utf-8-sig)
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write(fixed)
    print(f'  -> Yazildi!')
