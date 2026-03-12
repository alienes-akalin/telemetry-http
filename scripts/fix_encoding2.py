# -*- coding: utf-8 -*-
# Mojibake haritalari - Unicode kodpoint olarak
# CP1252'de 0x9F->U+0178(Y-diaeresis), 0x9E->U+017E(z-caron), 0x96->U+2013(en dash), 0x9C->U+0153(oe), 0x87->U+2021(dagger)

import os

# Dogru haritalama: (bozuk_cift, dogru_tek)
MAP = [
    # Byte ciftleri icin CP1252 gercek Unicode degerlerini kullan
    ('\u00c3\u00a7', '\u00e7'),   # Ã + § -> c (cedilla)
    ('\u00c3\u00bc', '\u00fc'),   # Ã + 1/4 -> u (diaeresis)
    ('\u00c3\u00b6', '\u00f6'),   # Ã + para -> o (diaeresis)
    ('\u00c3\u2021', '\u00c7'),   # Ã + dag(U+2021) -> C (cedilla) [0x87 in cp1252]
    ('\u00c3\u2013', '\u00d6'),   # Ã + en-dash(U+2013) -> O (diaeresis) [0x96]
    ('\u00c3\u0153', '\u00dc'),   # Ã + oe(U+0153) -> U (diaeresis) [0x9C]
    ('\u00c4\u00b1', '\u0131'),   # Ä + pm -> dotless-i [0xB1]
    ('\u00c4\u00b0', '\u0130'),   # Ä + degree -> cap-I [0xB0]
    ('\u00c4\u0178', '\u011f'),   # Ä + Y-diad(U+0178) -> g-breve [0x9F]
    ('\u00c4\u017e', '\u011e'),   # Ä + z-caron(U+017E) -> G-breve [0x9E]
    ('\u00c5\u0178', '\u015f'),   # Å + Y-diad(U+0178) -> s-cedilla [0x9F]
    ('\u00c5\u017e', '\u015e'),   # Å + z-caron(U+017E) -> S-cedilla [0x9E]
    # Ek (bazi sistemlerde)
    ('\u00c3\u00a2', '\u00e2'),   # Ã + a -> a-circ
    ('\u00c3\u00aa', '\u00ea'),   # Ã + e -> e-circ
]

files_to_fix = [
    r'public\index.html',
    r'public\css\style.css',
    r'public\js\app.js',
    r'public\sw.js',
]

for filepath in files_to_fix:
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_len = len(content)
    for wrong, right in MAP:
        content = content.replace(wrong, right)
    
    fixed_len = len(content)
    print(f'{filepath}: {original_len - fixed_len} karakter duzeltildi')
    
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write(content)

print('Bitti!')
