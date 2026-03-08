// tools/simulate_device.js
// Bu script, bir aracı simüle ederek sunucuya periyodik veri gönderir.
// Gelişmiş Fizik ve Gerçekçi Rota (Çukurova Üniversitesi)

const https = require('https'); // VDS için https, Local için http kullanın
// const http = require('http');

// Konfigürasyon
const CONFIG = {
    deviceId: 'arac-01',
    serverHost: 'telemetry-aliakalin.com.tr',
    serverPort: 443,
    intervalMs: 1000,        // 1 saniyede bir veri gönder (Daha akıcı olması için)
};

// Çukurova Üniversitesi Kampüs Rotası (Waypoints)
const PATH = [
    { lat: 37.0625, lon: 35.3540 }, // Rektörlük Kavşağı
    { lat: 37.0655, lon: 35.3565 }, // Kuzey Yolu
    { lat: 37.0635, lon: 35.3600 }, // Doğu Yolu
    { lat: 37.0590, lon: 35.3590 }, // Teknokent
    { lat: 37.0560, lon: 35.3560 }, // Yurtlar
    { lat: 37.0595, lon: 35.3520 }, // Balcalı Hastanesi
];

// Araç Durumu
let state = {
    // Fiziksel Durum
    speed: 0,           // km/h
    targetSpeed: 0,     // km/h (Sürücü isteği)

    // Batarya
    soc: 80.0,          // %
    voltage: 110.0,     // V
    current: 0,         // A
    temp: 25.0,         // C
    energy: 5000,       // Wh

    // Konum
    pathIndex: 0,       // Hangi waypoint'e gidiyoruz
    progress: 0.0,      // 0.0 - 1.0 arası (iki nokta arası ilerleme)
    lat: PATH[0].lat,
    lon: PATH[0].lon,

    // Diğer
    odometer: 0,        // metre
};

// Fizik Sabitleri
const PHYSICS = {
    INTERNAL_RESISTANCE: 0.15, // Ohm (Voltaj düşümü için)
    MASS: 400,                 // kg
    BASE_LOAD: 2.5,            // A (Sistem boşta akım)
    AIR_COOLING: 0.05,         // Soğuma katsayısı
    HEATING_COEFF: 0.002,      // Isınma katsayısı (I^2 * R)
};

// İki nokta arası mesafe (Haversine - metre cinsinden)
function getDistance(p1, p2) {
    const R = 6371e3; // Dünya yarıçapı
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lon - p1.lon) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function updatePhysics(dt_seconds) {
    // 1. Hız Kontrolü (Sürücü Davranışı)
    // Rastgele hedef hız değiştir
    if (Math.random() < 0.05) {
        state.targetSpeed = Math.random() < 0.3 ? 0 : Math.random() * 50; // %30 durma, %70 gitme (0-50 km/h)
    }

    // Hızlanma/Yavaşlama (İnertia)
    const accelRate = 5.0 * dt_seconds; // Hızlanma kapasitesi
    const diff = state.targetSpeed - state.speed;

    let acceleration = 0; // m/s^2 (yaklaşık)

    if (Math.abs(diff) < accelRate) {
        state.speed = state.targetSpeed;
    } else {
        const sign = Math.sign(diff);
        state.speed += sign * accelRate;
        acceleration = (sign * accelRate) / 3.6; // km/h -> m/s çevirip ivme bul (tahmini)
    }

    // 2. Akım Hesabı
    // I = I_base + (F_ma + F_drag) / V_eff
    // Basitleştirilmiş model:
    let loadCurrent = PHYSICS.BASE_LOAD;

    // Hızlanma akımı (Pozitif ivmelenmede akım çeker, yavaşlamada rejen henüz yok sayalım veya az olsun)
    if (acceleration > 0) {
        loadCurrent += acceleration * 20; // Her m/s^2 ivme için 20A
    }

    // Hava direnci ve sürtünme (Hız arttıkça artar)
    loadCurrent += (state.speed * state.speed) * 0.01;

    // Yokuş simülasyonu (Rastgele gürültü)
    loadCurrent += (Math.random() - 0.5) * 5;

    state.current = Math.min(50, Math.max(0.5, loadCurrent)); // 0-50A aralığı

    // 3. Voltaj Hesabı (Voltage Sag / Drop)
    // Açık devre voltajı SOC'a bağlı (Lineer yaklaşım: %100=84V, %0=72V)
    const openCircuitVoltage = 72 + (state.soc / 100) * 12;

    // Voltaj düşümü (V = Voc - I * R)
    state.voltage = openCircuitVoltage - (state.current * PHYSICS.INTERNAL_RESISTANCE);

    // Rastgele dalgalanma
    state.voltage += (Math.random() - 0.5) * 0.2;

    // 4. Enerji Tüketimi ve SOC
    const power_w = state.voltage * state.current;
    const energy_wh = (power_w * dt_seconds) / 3600;

    state.energy -= energy_wh; // Depodaki enerji azalır

    // SOC güncelle (5000Wh kapasite varsayalım)
    state.soc = (state.energy / 5000) * 100;
    if (state.soc < 0) { state.soc = 0; state.speed = 0; } // Pil bitti

    // 5. Sıcaklık Modeli (TEST MODU: Uyarıları görmek için sürekli değişir)
    // 25°C ile 85°C arasında dalgalanır (Periyot: ~30 saniye)
    const timeSec = Date.now() / 1000;
    state.temp = 55 + 32 * Math.sin(timeSec * 0.2);
    // Min: 23°C, Max: 87°C -> Tüm uyarıları (FAN, BUZZER, KONTAKTÖR) test eder


    // 6. Konum Güncelleme
    if (state.speed > 0) {
        const distTraveled = (state.speed / 3.6) * dt_seconds; // metre
        state.odometer += distTraveled;

        const currentP = PATH[state.pathIndex];
        const nextIndex = (state.pathIndex + 1) % PATH.length;
        const nextP = PATH[nextIndex];

        const segmentDist = getDistance(currentP, nextP);

        // Bu segmentte ne kadar ilerledik?
        // progress (0..1) += gidilen / toplam
        state.progress += distTraveled / segmentDist;

        if (state.progress >= 1.0) {
            // Sonraki noktaya geç
            state.pathIndex = nextIndex;
            state.progress = 0;
            // Artan mesafeyi taşıyabiliriz ama şimdilik sıfırlayalım basit olsun
        }

        // Lineer İnterpolasyon (Lerp)
        state.lat = currentP.lat + (nextP.lat - currentP.lat) * state.progress;
        state.lon = currentP.lon + (nextP.lon - currentP.lon) * state.progress;
    }
}

function sendTelemetry() {
    updatePhysics(CONFIG.intervalMs / 1000);

    const payload = JSON.stringify({
        device_id: CONFIG.deviceId,
        ts_device: new Date().toISOString(),
        gps: {
            lat_deg: state.lat,
            lon_deg: state.lon
        },
        bms: {
            voltage_v: Number(state.voltage.toFixed(2)),
            current_a: Number(state.current.toFixed(2)),
            temp_c: Number(state.temp.toFixed(1)),
            soc_pct: Number(state.soc.toFixed(1)),
            energy_mwh: Math.floor((5000 - state.energy)) // Harcanan enerji (logik ters olabilir, dashboard tüketim bekliyorsa)
        },
        motor: {
            rpm: Math.floor(state.speed * 35),
            speed_kph: Number(state.speed.toFixed(1)),
            duty_pct: Number(Math.min(100, (state.current / 50) * 100).toFixed(1))
        },
        iso: {
            res_1_kohm: 500 + Math.random() * 10,
            res_2_kohm: 500 + Math.random() * 10
        },
        hydrogen: {
            ppm: Math.floor(Math.random() * 10),
            temp_c: 25,
            flowmeter: 0
        }
    });

    const options = {
        hostname: CONFIG.serverHost,
        port: CONFIG.serverPort,
        path: '/api/v1/telemetry',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        },
        // HTTPS için sertifika kontrolünü devre dışı bırakmak gerekirse (test için)
        rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
        // console.log(`STATUS: ${res.statusCode}`);
    });

    req.on('error', (e) => {
        console.error(`İstek hatası: ${e.message}`);
    });

    req.write(payload);
    req.end();

    // Log
    console.log(`[${new Date().toLocaleTimeString()}] Hız: ${state.speed.toFixed(1)} km/h | Akım: ${state.current.toFixed(1)} A | Voltaj: ${state.voltage.toFixed(1)} V | SOC: ${state.soc.toFixed(1)}% | Hedef: ${state.targetSpeed.toFixed(0)}`);
}

// Başlat
console.log(`Gelişmiş Simülasyon Başladı!`);
console.log(`Cihaz: ${CONFIG.deviceId} -> ${CONFIG.serverHost}`);
console.log('Fizik motoru devrede: Voltaj düşümü, ısınma ve gerçekçi rota aktif.');

setInterval(sendTelemetry, CONFIG.intervalMs);
sendTelemetry();
