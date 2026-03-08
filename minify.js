// minify.js - Safe minification that preserves URLs and removes ALL comments
const fs = require('fs');
const src = fs.readFileSync('public/js/app.js', 'utf8');

const lines = src.split('\n');
const result = [];

for (const line of lines) {
    const trimmed = line.trim();

    // Skip pure comment lines (line starts with //)
    if (trimmed.startsWith('// ') || trimmed === '//') {
        continue;
    }

    // Remove inline comments CAREFULLY:
    // Strategy: find // that is NOT inside a string literal
    // We do a simple state-machine pass to strip trailing inline comments
    let stripped = line;
    let inSingle = false;
    let inDouble = false;
    let commentStart = -1;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (!inSingle && !inDouble) {
            if (ch === "'") { inSingle = true; continue; }
            if (ch === '"') { inDouble = true; continue; }
            if (ch === '`') { inDouble = true; continue; } // template literal (simple handling)
            // Detect // comment (not inside string)
            if (ch === '/' && next === '/') {
                commentStart = i;
                break;
            }
        } else {
            if (inSingle && ch === "'" && line[i - 1] !== '\\') { inSingle = false; continue; }
            if (inDouble && (ch === '"' || ch === '`') && line[i - 1] !== '\\') { inDouble = false; continue; }
        }
    }

    if (commentStart > 0) {
        stripped = line.substring(0, commentStart);
    }

    if (stripped.trim().length > 0) {
        result.push(stripped);
    }
}

let output = result.join('\n');

// Remove multi-line comments
output = output.replace(/\/\*[\s\S]*?\*\//g, '');

// Collapse whitespace
output = output.replace(/\s+/g, ' ').trim();

fs.writeFileSync('public/js/app.min.js', output);

// Verify URLs are intact
const hasSocketUrl = output.includes("https://telemetry-aliakalin.com.tr");
const hasGoogleScript = output.includes("https://script.google.com");
const hasSocketInit = output.includes("const socket = io(");

console.log('Size:', output.length);
console.log('Socket URL intact:', hasSocketUrl);
console.log('Google Script URL intact:', hasGoogleScript);
console.log('Socket init present:', hasSocketInit);
console.log('Has switchVehicle:', output.includes('switchVehicle'));
console.log('Has currentDeviceId:', output.includes('currentDeviceId'));
console.log('Has VEHICLE_CONFIG:', output.includes('VEHICLE_CONFIG'));
