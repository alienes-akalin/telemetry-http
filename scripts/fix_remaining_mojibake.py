from pathlib import Path

files = [
    Path('public/index.html'),
    Path('public/css/style.css'),
    Path('public/sw.js'),
]

replacements = {
    'Â°C': '°C',
    'âš ï¸\x8f': '⚠️',
    'â„¹ï¸\x8f': 'ℹ️',
    'ğŸ˜\x8f': '😏',
    'ğŸŽµ': '🎵',
    'ğŸŽ¯': '🎯',
    'ğŸ“¡': '📡',
    'â€”': '—',
    'â€“': '–',
    'â€¢': '•',
    'â†’': '→',
    'â†': '←',
    'âœ…': '✅',
    'âœ…': '✅',
    'âœ—': '✗',
    'â”€': '─',
    'â”‚': '│',
    'â”‚': '│',
    'â•': '═',
}

for file in files:
    text = file.read_text(encoding='utf-8')
    original = text
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    if text != original:
        file.write_text(text, encoding='utf-8', newline='')
        print(f'UPDATED: {file}')
    else:
        print(f'NOCHANGE: {file}')
