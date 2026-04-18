/**
 * Pist Verisi İşleme Scripti — Çift Pist Desteği
 * SilesiaRing (yarış) + YADYO (test) pistlerini işler
 * Çıktı: public/js/trackData.js
 */

const fs   = require('fs');
const path = require('path');

const TRACKS = [
    {
        id:       'SILESIA',
        name:     'SilesiaRing — SEM 2025 Yarış Pisti',
        file:     '../docs/20260416121946-47254-data.txt',
        segments: 60,
        lapNote:  'Shell Eco-Marathon resmi yarış pisti'
    },
    {
        id:       'YADYO',
        name:     'YADYO — Adana Test Pisti',
        file:     '../docs/yadyo-data.txt',
        segments: 30,
        lapNote:  'Çukurova Üniversitesi YADYO önü test güzergahı'
    }
];

const OUTPUT = path.join(__dirname, '../public/js/trackData.js');

// ── Yardımcı ───────────────────────────────────────────────────────────────

/** Kayan ortalama ile eğim verisini yumuşat (GPS gürültüsü için) */
function smoothSlopes(points, windowSize = 5) {
    return points.map((p, i) => {
        const half   = Math.floor(windowSize / 2);
        const start  = Math.max(0, i - half);
        const end    = Math.min(points.length - 1, i + half);
        const vals   = points.slice(start, end + 1).map(x => x.slope);
        const avg    = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { ...p, slope: avg };
    });
}

/** Throttle hinit belirle */
function throttleHint(slopePct) {
    if (slopePct >  1.5) return 'FULL';
    if (slopePct >  0.5) return 'THROTTLE';
    if (slopePct < -1.5) return 'COAST_FREE';
    if (slopePct < -0.5) return 'COAST';
    return 'MAINTAIN';
}

// ── Ana işlem ──────────────────────────────────────────────────────────────

function processTrack(cfg) {
    const filePath = path.join(__dirname, cfg.file);
    const lines    = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.startsWith('T;'));

    let points = lines.map(line => {
        const p = line.split(';');
        return {
            lat:       parseFloat(p[1]),
            lon:       parseFloat(p[2]),
            alt:       parseFloat(p[3]) || 0,
            slope:     parseFloat(p[4]) || 0,
            distKm:    parseFloat(p[5]),
            intervalM: parseFloat(p[6]) || 1
        };
    }).filter(p => !isNaN(p.lat));

    // YADYO için daha agresif yumuşatma (GPS gürültüsü yüksek)
    const smoothWindow = cfg.id === 'YADYO' ? 11 : 5;
    points = smoothSlopes(points, smoothWindow);

    const totalDistKm = points[points.length - 1].distKm;
    const totalDistM  = totalDistKm * 1000;
    const segSizeM    = totalDistM  / cfg.segments;
    const alts        = points.map(p => p.alt).filter(a => a > 0);
    const altMin      = alts.length ? Math.min(...alts) : 0;
    const altMax      = alts.length ? Math.max(...alts) : 0;

    console.log(`\n[${cfg.id}] ${cfg.name}`);
    console.log(`  Nokta: ${points.length} | Mesafe: ${totalDistM.toFixed(0)} m | Seg: ${cfg.segments} × ${segSizeM.toFixed(1)} m`);
    console.log(`  Rakım: ${altMin.toFixed(1)} – ${altMax.toFixed(1)} m (Δ${(altMax - altMin).toFixed(1)} m)`);

    // Segmentlere böl
    const segments = [];
    for (let s = 0; s < cfg.segments; s++) {
        const segStartM = s * segSizeM;
        const segEndM   = (s + 1) * segSizeM;
        let segPts      = points.filter(p => p.distKm * 1000 >= segStartM && p.distKm * 1000 < segEndM);

        if (segPts.length === 0) {
            const nearest = points.reduce((prev, curr) =>
                Math.abs(curr.distKm * 1000 - (segStartM + segSizeM / 2)) <
                Math.abs(prev.distKm * 1000 - (segStartM + segSizeM / 2)) ? curr : prev
            );
            segPts = [nearest];
        }

        const avgAlt   = segPts.reduce((sum, p) => sum + p.alt,   0) / segPts.length;
        const avgSlope = segPts.reduce((sum, p) => sum + p.slope, 0) / segPts.length;
        const mid      = segPts[Math.floor(segPts.length / 2)];

        segments.push({
            id:        s,
            startM:    Math.round(segStartM),
            endM:      Math.round(segEndM),
            altM:      parseFloat(avgAlt.toFixed(2)),
            slopePct:  parseFloat(avgSlope.toFixed(2)),
            sineAlpha: parseFloat((Math.sin(avgSlope * Math.PI / 180)).toFixed(6)),
            lat:       parseFloat(mid.lat.toFixed(7)),
            lon:       parseFloat(mid.lon.toFixed(7)),
            throttle:  throttleHint(avgSlope)
        });
    }

    // Throttle dağılımı
    const dist = {};
    segments.forEach(s => { dist[s.throttle] = (dist[s.throttle] || 0) + (s.endM - s.startM); });
    console.log('  Throttle: ' + Object.entries(dist).map(([k, v]) => `${k}:${v.toFixed(0)}m(${(v/totalDistM*100).toFixed(0)}%)`).join(' | '));

    return {
        id:       cfg.id,
        name:     cfg.name,
        lapNote:  cfg.lapNote,
        totalM:   Math.round(totalDistM),
        altMinM:  parseFloat(altMin.toFixed(1)),
        altMaxM:  parseFloat(altMax.toFixed(1)),
        altDeltaM: parseFloat((altMax - altMin).toFixed(1)),
        startLat: points[0].lat,
        startLon: points[0].lon,
        segments
    };
}

// ── Çalıştır ───────────────────────────────────────────────────────────────

console.log('=== Pist Verisi İşleniyor ===');
const tracks = TRACKS.map(processTrack);

const jsContent = `// ============================================================
// Pist Profilleri — Otomatik Oluşturuldu
// ${new Date().toISOString()}
// Pistler: ${tracks.map(t => t.id).join(', ')}
// ============================================================

// Tüm pist profilleri
const TRACK_PROFILES = ${JSON.stringify(tracks, null, 2)};

// Aktif pist (varsayılan: SilesiaRing)
// switchTrack() ile değiştirilebilir
let ACTIVE_TRACK = TRACK_PROFILES.find(t => t.id === 'SILESIA') || TRACK_PROFILES[0];

// Kısayol referanslar (geriye dönük uyumluluk)
let SILESIA_TRACK = TRACK_PROFILES.find(t => t.id === 'SILESIA');
let YADYO_TRACK   = TRACK_PROFILES.find(t => t.id === 'YADYO');

// ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────

/** Aktif pisti değiştirir, 'SILESIA' veya 'YADYO' */
function switchTrack(trackId) {
    const found = TRACK_PROFILES.find(t => t.id === trackId);
    if (!found) { console.warn('[Track] Bilinmeyen pist:', trackId); return; }
    ACTIVE_TRACK = found;
    console.log('[Track] Aktif pist:', ACTIVE_TRACK.name);
}

/** Mesafeye (m) göre aktif pistteki segmenti döndürür */
function getTrackSegment(distM) {
    const segs = ACTIVE_TRACK.segments;
    const idx  = segs.findIndex(s => distM >= s.startM && distM < s.endM);
    return idx >= 0 ? segs[idx] : segs[segs.length - 1];
}

/** GPS koordinatına göre aktif pistete en yakın segmenti döndürür */
function getNearestSegmentByGPS(lat, lon) {
    let minDist = Infinity, nearest = null;
    ACTIVE_TRACK.segments.forEach(s => {
        const d = Math.hypot(s.lat - lat, s.lon - lon);
        if (d < minDist) { minDist = d; nearest = s; }
    });
    return nearest;
}
`;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, jsContent, 'utf8');
console.log(`\n✅ trackData.js yazıldı: ${OUTPUT}`);
console.log(`   Boyut: ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`);
