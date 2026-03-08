// tools/simulate_device_a2.js
// Shell Aracı (a2) simülatörü — ISO izolasyon ve Hidrojen sensörleri YOKTUR.
// Fizik motoru: Voltaj düşümü, isınma, GPS rota simülasyonu (Ankara - Atatürk Orman Çiftliği)
//
// Kullanım:
//   node tools/simulate_device_a2.js                         → localhost:3000
//   node tools/simulate_device_a2.js --host localhost --port 3000
//   node tools/simulate_device_a2.js --host telemetry-aliakalin.com.tr --port 443 --https

const http = require('http');
const https = require('https');

// ==================== KOMUT SATIRI ARGÜMANLARI ====================
const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : fallback;
};

const CONFIG = {
    deviceId: 'a2',
    host: getArg('--host', 'telemetry-aliakalin.com.tr'),
    port: parseInt(getArg('--port', '443')),
    useHttps: !args.includes('--no-https'),  // Varsayılan HTTPS; yerel test için --no-https
    intervalMs: parseInt(getArg('--interval', '1000')),
};

const transport = CONFIG.useHttps ? https : http;

// ==================== ROTA ====================
// Çukurova Üniversitesi Kampüsü (a1 ile aynı rota — iki araç birlikte sürülüyor)
const PATH = [
    { lat: 37.0625, lon: 35.3540 }, // Rektörlük Kavşağı
    { lat: 37.0655, lon: 35.3565 }, // Kuzey Yolu
    { lat: 37.0635, lon: 35.3600 }, // Doğu Yolu
    { lat: 37.0590, lon: 35.3590 }, // Teknokent
    { lat: 37.0560, lon: 35.3560 }, // Yurtlar
    { lat: 37.0595, lon: 35.3520 }, // Balcalı Hastanesi
];

// ==================== FİZİK SABİTLERİ ====================
const PHYSICS = {
    INTERNAL_RESISTANCE: 0.12,   // Ohm (Shell'in farklı batarya paketi)
    BASE_LOAD: 2.0,    // A
    BATTERY_CAPACITY_WH: 4000,   // Wh (Shell daha küçük paket)
    MAX_SPEED: 60,     // km/h (Shell daha hızlı)
    MAX_CURRENT: 60,     // A
    VOLTAGE_EMPTY: 60,     // V (%0 SOC)
    VOLTAGE_FULL: 72,     // V (%100 SOC)
};

// ==================== ARAÇ DURUMU ====================
const state = {
    speed: 0,
    targetSpeed: 0,
    soc: 95.0,
    voltage: 72.0,
    current: 0,
    temp: 22.0,
    energy: PHYSICS.BATTERY_CAPACITY_WH * 0.95,  // %95 SOC'tan başla
    pathIndex: 0,
    progress: 0.0,
    lat: PATH[0].lat,
    lon: PATH[0].lon,
    uptime: 0,
};

// ==================== YARDIMCI FONKSİYONLAR ====================

/** Haversine formülü ile iki GPS noktası arasındaki mesafeyi metre cinsinden döndürür */
function haversine(p1, p2) {
    const R = 6371e3;
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** -range ile +range arasında rastgele sayı döndürür */
const jitter = (range) => (Math.random() - 0.5) * 2 * range;

// ==================== FİZİK MOTORU ====================

function updatePhysics(dt_s) {
    state.uptime += Math.round(dt_s);

    // -- Hız kontrolü --
    if (Math.random() < 0.05) {
        state.targetSpeed = Math.random() < 0.25 ? 0 : Math.random() * PHYSICS.MAX_SPEED;
    }
    const accelRate = 6.0 * dt_s;  // Shell biraz daha agresif hızlanıyor
    const diff = state.targetSpeed - state.speed;
    const acceleration = Math.abs(diff) < accelRate ? 0 : Math.sign(diff) * accelRate / 3.6;
    state.speed = Math.abs(diff) < accelRate ? state.targetSpeed : state.speed + Math.sign(diff) * accelRate;

    // -- Akım hesabı --
    let I = PHYSICS.BASE_LOAD;
    if (acceleration > 0) I += acceleration * 18;
    I += (state.speed ** 2) * 0.008;
    I += jitter(3);
    state.current = Math.min(PHYSICS.MAX_CURRENT, Math.max(0.5, I));

    // -- Voltaj hesabı --
    const voc = PHYSICS.VOLTAGE_EMPTY + (state.soc / 100) * (PHYSICS.VOLTAGE_FULL - PHYSICS.VOLTAGE_EMPTY);
    state.voltage = voc - state.current * PHYSICS.INTERNAL_RESISTANCE + jitter(0.1);

    // -- Enerji ve SOC --
    const energy_wh = (state.voltage * state.current * dt_s) / 3600;
    state.energy -= energy_wh;
    state.soc = Math.max(0, (state.energy / PHYSICS.BATTERY_CAPACITY_WH) * 100);
    if (state.soc === 0) state.speed = 0;

    // -- Sıcaklık (gerçekçi ısınma/soğuma) --
    const heatRate = (state.current ** 2) * PHYSICS.INTERNAL_RESISTANCE * 0.001;  // Joule ısınma
    const coolRate = 0.05;  // Doğal soğuma
    state.temp = Math.min(80, Math.max(15, state.temp + heatRate - coolRate + jitter(0.2)));

    // -- Konum güncelleme --
    if (state.speed > 0) {
        const distTraveled = (state.speed / 3.6) * dt_s;
        const nextIndex = (state.pathIndex + 1) % PATH.length;
        const segmentDist = haversine(PATH[state.pathIndex], PATH[nextIndex]);

        state.progress += distTraveled / segmentDist;
        if (state.progress >= 1.0) {
            state.pathIndex = nextIndex;
            state.progress = 0;
        }

        const cur = PATH[state.pathIndex];
        const next = PATH[(state.pathIndex + 1) % PATH.length];
        state.lat = cur.lat + (next.lat - cur.lat) * state.progress;
        state.lon = cur.lon + (next.lon - cur.lon) * state.progress;
    }
}

// ==================== VERİ GÖNDERİMİ ====================

function sendTelemetry() {
    updatePhysics(CONFIG.intervalMs / 1000);

    // Shell aracında ISO ve Hydrogen alanları YOK
    const payload = JSON.stringify({
        device_id: CONFIG.deviceId,
        event_type: 'telemetry',
        uptime_sec: state.uptime,
        bms: {
            voltage_v: parseFloat(state.voltage.toFixed(2)),
            current_a: parseFloat(state.current.toFixed(2)),
            temp_c: parseFloat(state.temp.toFixed(1)),
            soc_pct: parseFloat(state.soc.toFixed(1)),
            energy_mwh: Math.floor((PHYSICS.BATTERY_CAPACITY_WH - state.energy) * 1000 / PHYSICS.BATTERY_CAPACITY_WH)
        },
        motor: {
            rpm: Math.floor(state.speed * 40),  // Shell farklı dişli oranı
            speed_kph: parseFloat(state.speed.toFixed(1)),
            duty_pct: parseFloat(Math.min(100, (state.current / PHYSICS.MAX_CURRENT) * 100).toFixed(1))
        },
        gps: {
            lat_deg: parseFloat(state.lat.toFixed(6)),
            lon_deg: parseFloat(state.lon.toFixed(6))
        }
        // iso ve hydrogen alanları kasıtlı olarak dahil edilmiyor (Shell'de sensör yok)
    });

    const options = {
        hostname: CONFIG.host,
        port: CONFIG.port,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        },
        rejectUnauthorized: false
    };

    const req = transport.request(options, (res) => {
        if (res.statusCode !== 201) {
            console.error(`[a2] Sunucu yanıtı: ${res.statusCode}`);
        }
    });

    req.on('error', (e) => console.error(`[a2] İstek hatası: ${e.message}`));
    req.write(payload);
    req.end();

    const t = new Date().toLocaleTimeString('tr-TR');
    console.log(
        `[${t}] [Shell/a2] Hız: ${state.speed.toFixed(1)} km/h | ` +
        `SOC: ${state.soc.toFixed(1)}% | V: ${state.voltage.toFixed(1)}V | ` +
        `A: ${state.current.toFixed(1)}A | T: ${state.temp.toFixed(1)}°C`
    );
}

// ==================== BAŞLAT ====================
const protocol = CONFIG.useHttps ? 'https' : 'http';
console.log('╔══════════════════════════════════════╗');
console.log('║   SHELL (a2) SİMÜLATÖRÜ              ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  Sunucu: ${protocol}://${CONFIG.host}:${CONFIG.port}`.padEnd(41) + '║');
console.log(`║  Cihaz:  ${CONFIG.deviceId}`.padEnd(41) + '║');
console.log(`║  Aralık: ${CONFIG.intervalMs}ms`.padEnd(41) + '║');
console.log('║  Sensörler: BMS, Motor, GPS (ISO/H2 YOK)║');
console.log('╚══════════════════════════════════════╝');
console.log('Durdurmak için Ctrl+C\n');

// Başlangıç sinyali gönder
const startupPayload = JSON.stringify({ device_id: CONFIG.deviceId, event_type: 'system_startup', uptime_sec: 0 });
const startupOpt = {
    hostname: CONFIG.host, port: CONFIG.port,
    path: '/api/v1/telemetry', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(startupPayload) },
    rejectUnauthorized: false
};
const sr = transport.request(startupOpt, () => console.log('[a2] ✅ Başlangıç sinyali gönderildi\n'));
sr.on('error', (e) => console.error(`[a2] Başlangıç sinyali gönderilemedi: ${e.message}`));
sr.write(startupPayload);
sr.end();

setInterval(sendTelemetry, CONFIG.intervalMs);
