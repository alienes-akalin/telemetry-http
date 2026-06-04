// tools/simulate_device_a1.js
// Hidromobil (a1) simülatörü — ISO izolasyon ve Hidrojen sensörleri dahildir.
// Fizik motoru: Voltaj düşümü, isınma, gerçekçi rota (Çukurova Üniversitesi Kampüsü)
//
// Kullanım:
//   node tools/simulate_device_a1.js                         → localhost:3000
//   node tools/simulate_device_a1.js --host localhost --port 3000
//   node tools/simulate_device_a1.js --host telemetry-aliakalin.com.tr --port 443 --https

const http = require('http');
const https = require('https');

// ==================== KOMUt SATIRI ARGÜMANLARI ====================
const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : fallback;
};

const CONFIG = {
    deviceId: 'a1',
    host: getArg('--host', 'telemetry-aliakalin.com.tr'),
    port: parseInt(getArg('--port', '443')),
    useHttps: !args.includes('--no-https'),  // Varsayılan HTTPS; yerel test için --no-https
    intervalMs: parseInt(getArg('--interval', '1000')),  // Gönderim aralığı (ms)
};

const transport = CONFIG.useHttps ? https : http;

// ==================== ÇUKUROVA ÜNİVERSİTESİ ROTASı ====================
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
    INTERNAL_RESISTANCE: 0.15,  // Ohm (Voltaj düşümü hesabı için)
    BASE_LOAD: 2.5,   // A (Sistem boşta akımı)
    BATTERY_CAPACITY_WH: 5000,  // Wh (Toplam batarya kapasitesi)
    MAX_SPEED: 50,    // km/h (Araç max hızı)
    MAX_CURRENT: 50,    // A
};

// ==================== ARAÇ DURUMU ====================
const state = {
    speed: 0,
    targetSpeed: 0,
    soc: 80.0,
    voltage: 80.0,
    current: 0,
    temp: 25.0,
    energy: PHYSICS.BATTERY_CAPACITY_WH * 0.8,  // Başlangıç enerjisi (%80 SOC)
    pathIndex: 0,
    progress: 0.0,
    lat: PATH[0].lat,
    lon: PATH[0].lon,
    uptime: 0,
    // Hidrojen simülasyon değişkenleri
    h2Ppm: 2,
    h2Temp: 20.0,
    // İzolasyon simülasyon değişkenleri
    isoPos: 500.0,
    isoNeg: 500.0,
    // GSM sinyal kalitesi simülasyonu (0-100%)
    signalPct: 72,
    // IMU (ADXL345) simülasyon
    imuTime: 0,
    imuRoll:  0.0,
    imuPitch: 0.0,
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

/** dt_s: saniye cinsinden geçen süre */
function updatePhysics(dt_s) {
    state.uptime += Math.round(dt_s);

    // -- Hız kontrolü (sürücü davranışı simülasyonu) --
    if (Math.random() < 0.05) {
        state.targetSpeed = Math.random() < 0.3 ? 0 : Math.random() * PHYSICS.MAX_SPEED;
    }
    const accelRate = 5.0 * dt_s;
    const diff = state.targetSpeed - state.speed;
    const acceleration = Math.abs(diff) < accelRate ? 0 : Math.sign(diff) * accelRate / 3.6;
    state.speed = Math.abs(diff) < accelRate ? state.targetSpeed : state.speed + Math.sign(diff) * accelRate;

    // -- Akım hesabı --
    let I = PHYSICS.BASE_LOAD;
    if (acceleration > 0) I += acceleration * 20;   // Hızlanma akımı
    I += (state.speed ** 2) * 0.01;                  // Hava direnci + sürtünme
    I += jitter(2.5);                                 // Gürültü
    state.current = Math.min(PHYSICS.MAX_CURRENT, Math.max(0.5, I));

    // -- Voltaj hesabı (Voc - I*R modeli) --
    const voc = 72 + (state.soc / 100) * 12;  // %0=72V, %100=84V (27 hücreli paket)
    state.voltage = voc - state.current * PHYSICS.INTERNAL_RESISTANCE + jitter(0.1);

    // -- Enerji ve SOC --
    const power_w = state.voltage * state.current;
    const energy_wh = (power_w * dt_s) / 3600;
    state.energy -= energy_wh;
    state.soc = Math.max(0, (state.energy / PHYSICS.BATTERY_CAPACITY_WH) * 100);
    if (state.soc === 0) state.speed = 0;

    // -- Sıcaklık (TEST MODU: FAN/BUZZER/KONTAKTÖR uyarılarını test eder) --
    // 23°C ile 87°C arasında sinüzel salınım (~30s periyot)
    state.temp = 55 + 32 * Math.sin(Date.now() / 5000);

    // -- Konum güncelleme (rota üzerinde ilerleme) --
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

    // -- İzolasyon direnci (küçük dalgalanmalar) --
    state.isoPos = 500 + jitter(5);
    state.isoNeg = 500 + jitter(5);

    // -- Hidrojen sensörü (baz değer + gürültü) --
    state.h2Ppm = Math.max(0, Math.round(3 + jitter(2)));
    state.h2Temp = 20 + jitter(1);

    // -- GSM sinyal: gerçekçi dalgalanma (55-90% arası) --
    state.signalPct = Math.max(55, Math.min(90,
        state.signalPct + (Math.random() - 0.48) * 3
    ));

    // -- IMU simülasyon: sinüzoidal eğim (viraj + yıdız katsayısı) --
    state.imuTime += CONFIG.intervalMs / 1000;   // saniyede ilerle
    state.imuRoll  = 12 * Math.sin(state.imuTime * 0.25) + jitter(1.5);
    state.imuPitch =  6 * Math.sin(state.imuTime * 0.13 + 1.2) + jitter(0.8);
}

// ==================== VERİ GÖNDERİMİ ====================

function sendTelemetry() {
    updatePhysics(CONFIG.intervalMs / 1000);

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
            rpm: Math.floor(state.speed * 35),
            speed_kph: parseFloat(state.speed.toFixed(1)),
            duty_pct: parseFloat(Math.min(100, (state.current / PHYSICS.MAX_CURRENT) * 100).toFixed(1))
        },
        gps: {
            lat_deg: parseFloat(state.lat.toFixed(6)),
            lon_deg: parseFloat(state.lon.toFixed(6)),
            alt_m:   parseFloat((38.0 + Math.random() * 4).toFixed(1))
        },
        // Hidromobil'e özgü sensörler
        iso: {
            res_1_kohm: parseFloat(state.isoPos.toFixed(1)),
            res_2_kohm: parseFloat(state.isoNeg.toFixed(1))
        },
        hydrogen: {
            ppm: state.h2Ppm,
            temp_c: parseFloat(state.h2Temp.toFixed(1)),
            flowmeter: 0
        },
        // GSM sinyal kalitesi (SIM800L CSQ simüle edilmiş)
        gsm: {
            signal_pct: Math.round(state.signalPct)
        },
        // IMU / ADXL345 İvme sensörü
        imu: {
            pitch_deg: parseFloat(state.imuPitch.toFixed(2)),
            roll_deg:  parseFloat(state.imuRoll.toFixed(2))
        }
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
        rejectUnauthorized: false  // Self-signed sertifika için (test)
    };

    const req = transport.request(options, (res) => {
        if (res.statusCode !== 201) {
            console.error(`[a1] Sunucu yanıtı: ${res.statusCode}`);
        }
    });

    req.on('error', (e) => console.error(`[a1] İstek hatası: ${e.message}`));
    req.write(payload);
    req.end();

    // Konsol logu
    const t = new Date().toLocaleTimeString('tr-TR');
    console.log(
        `[${t}] [Hidromobil/a1] Hız: ${state.speed.toFixed(1)} km/h | ` +
        `SOC: ${state.soc.toFixed(1)}% | V: ${state.voltage.toFixed(1)}V | ` +
        `A: ${state.current.toFixed(1)}A | T: ${state.temp.toFixed(1)}°C | ` +
        `H2: ${state.h2Ppm}ppm | İzo+: ${state.isoPos.toFixed(0)}kΩ | ` +
        `GSM: ${Math.round(state.signalPct)}%`
    );
}

// ==================== BAŞLAT ====================
const protocol = CONFIG.useHttps ? 'https' : 'http';
console.log('╔══════════════════════════════════════╗');
console.log('║   HİDROMOBİL (a1) SİMÜLATÖRÜ        ║');
console.log('╠══════════════════════════════════════╣');
console.log(`║  Sunucu: ${protocol}://${CONFIG.host}:${CONFIG.port}`.padEnd(41) + '║');
console.log(`║  Cihaz:  ${CONFIG.deviceId}`.padEnd(41) + '║');
console.log(`║  Aralık: ${CONFIG.intervalMs}ms`.padEnd(41) + '║');
console.log('║  Sensörler: BMS, Motor, GPS, ISO, H2, GSM ║');
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
const sr = transport.request(startupOpt, () => console.log('[a1] ✅ Başlangıç sinyali gönderildi\n'));
sr.on('error', (e) => console.error(`[a1] Başlangıç sinyali gönderilemedi: ${e.message}`));
sr.write(startupPayload);
sr.end();

setInterval(sendTelemetry, CONFIG.intervalMs);
