// src/routes/telemetry.js
// Telemetri API rotaları: cihazdan veri alma (POST/GET), dashboard için sorgular
const express = require('express');
const Telemetry = require('../models/telemetry');
const logger = require('../logger');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../config/redis');
const { resolveDeviceIds, isValidDeviceId } = require('../config/deviceConfig');

const router = express.Router();

/** Socket.io instance (server.js'den setSocketIO() ile atanır) */
let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

// ==================== SOCKET.IO THROTTLING ====================
// Aynı cihazdan gelen yoğun veriyi 100ms'de bir (10Hz) tekleştirerek yayınlar.
// Bu olmadan her telemetri paketi ayrı broadcast tetikler ve client CPU'yu yorar.

const BROADCAST_THROTTLE_MS = 100;
let lastBroadcastTime = {};  // { device_id: timestamp } — son gönderim zamanı
let pendingData = {};        // { device_id: data } — bekleyen son veri

/**
 * Throttled broadcast — 100ms pencerede aynı cihaz için tek emit gönderir.
 * Pencere dolduğunda bekleyen son veriyi gönderir (aradaki veriler atlanır).
 * @param {string} deviceId - Cihaz ID'si (Socket.io room adı)
 * @param {Object} data - Yayınlanacak telemetri verisi
 */
function throttledBroadcast(deviceId, data) {
    if (!io) return;

    const now = Date.now();
    const lastTime = lastBroadcastTime[deviceId] || 0;

    pendingData[deviceId] = data;

    if (now - lastTime >= BROADCAST_THROTTLE_MS) {
        // Throttle süresi geçti — hemen gönder
        io.to(deviceId).emit('telemetry', data);
        lastBroadcastTime[deviceId] = now;
        delete pendingData[deviceId];
    } else if (!pendingData[deviceId]._timer) {
        // Süre dolmadı — kalan süre sonunda göndermek için timer kur
        const remaining = BROADCAST_THROTTLE_MS - (now - lastTime);
        pendingData[deviceId]._timer = setTimeout(() => {
            if (pendingData[deviceId]) {
                const { _timer, ...cleanData } = pendingData[deviceId];
                io.to(deviceId).emit('telemetry', cleanData);
                lastBroadcastTime[deviceId] = Date.now();
                delete pendingData[deviceId];
            }
        }, remaining);
    }
}

// ==================== Yardımcı: Query String → Number Dönüşümleri ====================
const toFloat = (v) => (v !== undefined && v !== '') ? parseFloat(v) : undefined;
const toInt = (v) => (v !== undefined && v !== '') ? parseInt(v, 10) : undefined;

// ==================== Input Validation ====================
/**
 * Sayısal telemetri değerlerini fiziksel sınırlara göre kontrol eder.
 * NaN, Infinity ve fiziksel olarak imkânsız değerleri reddeder.
 */
const FIELD_LIMITS = {
    voltage_v: [0, 500],
    current_a: [-1000, 1000],
    temp_c: [-50, 150],
    soc_pct: [0, 100],
    energy_mwh: [0, 1e8],
    rpm: [0, 50000],
    speed_kph: [0, 500],
    duty_pct: [0, 100],
    lat_deg: [-90, 90],
    lon_deg: [-180, 180],
    res_1_kohm: [0, 1e7],
    res_2_kohm: [0, 1e7],
    ppm: [0, 100000],
    flowmeter: [0, 1e6]
};

function isValidNum(fieldName, val) {
    if (val === undefined || val === null) return true; // opsiyonel alan
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return false;
    const [min, max] = FIELD_LIMITS[fieldName] || [-Infinity, Infinity];
    return val >= min && val <= max;
}

function validateTelemetry(data) {
    const errors = [];
    if (data.bms) {
        for (const f of ['voltage_v', 'current_a', 'temp_c', 'soc_pct', 'energy_mwh'])
            if (!isValidNum(f, data.bms[f])) errors.push(`bms.${f}`);
    }
    if (data.motor) {
        for (const f of ['rpm', 'speed_kph', 'duty_pct'])
            if (!isValidNum(f, data.motor[f])) errors.push(`motor.${f}`);
    }
    if (data.gps) {
        if (!isValidNum('lat_deg', data.gps.lat_deg)) errors.push('gps.lat_deg');
        if (!isValidNum('lon_deg', data.gps.lon_deg)) errors.push('gps.lon_deg');
    }
    if (data.iso) {
        if (!isValidNum('res_1_kohm', data.iso.res_1_kohm)) errors.push('iso.res_1_kohm');
        if (!isValidNum('res_2_kohm', data.iso.res_2_kohm)) errors.push('iso.res_2_kohm');
    }
    if (data.hydrogen) {
        if (!isValidNum('ppm', data.hydrogen.ppm)) errors.push('hydrogen.ppm');
        if (!isValidNum('temp_c', data.hydrogen.temp_c)) errors.push('hydrogen.temp_c');
        if (!isValidNum('flowmeter', data.hydrogen.flowmeter)) errors.push('hydrogen.flowmeter');
    }
    return errors;
}

// DEVICE_API_KEY doğrulama — ingest endpoint için
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || null;

function checkDeviceApiKey(req, res) {
    if (!DEVICE_API_KEY) return true; // .env tanımlı değilse kontrolü atla (dev ortamı)
    const provided = req.query.key || req.headers['x-api-key'];
    if (provided !== DEVICE_API_KEY) {
        logger.warn('Geçersiz DEVICE_API_KEY', { ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
        res.status(401).send('Unauthorized');
        return false;
    }
    return true;
}

// ==================== POST /api/v1/telemetry ====================
/**
 * JSON body ile telemetri verisi alır (eski yöntem, geriye uyumluluk).
 * STM32 SIM800L veya test araçları bu endpoint'e JSON POST atar.
 */
router.post('/', async (req, res) => {
    const body = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!body?.device_id) {
        logger.warn('Geçersiz telemetri POST (device_id yok)', { ip: clientIp });
        return res.status(400).send('device_id gereklidir');
    }

    if (!isValidDeviceId(body.device_id)) {
        logger.warn('Geçersiz device_id reddedildi (POST)', { device_id: body.device_id, ip: clientIp });
        return res.status(400).json({ error: 'Geçersiz cihaz ID\'si' });
    }

    try {
        const telemetryData = {
            device_id: body.device_id,
            protocol: 'http',
            event_type: body.event_type || 'telemetry',
            uptime_sec: body.uptime_sec,
            bms: body.bms ? {
                voltage_v: body.bms.voltage_v,
                current_a: body.bms.current_a,
                temp_c: body.bms.temp_c,
                soc_pct: body.bms.soc_pct,
                energy_mwh: body.bms.energy_mwh
            } : undefined,
            motor: body.motor ? {
                rpm: body.motor.rpm,
                speed_kph: body.motor.speed_kph,
                duty_pct: body.motor.duty_pct
            } : undefined,
            gps: body.gps ? {
                lat_deg: body.gps.lat_deg,
                lon_deg: body.gps.lon_deg
            } : undefined,
            iso: body.iso ? {
                res_1_kohm: body.iso.res_1_kohm,
                res_2_kohm: body.iso.res_2_kohm
            } : undefined,
            hydrogen: body.hydrogen ? {
                ppm: body.hydrogen.ppm,
                temp_c: body.hydrogen.temp_c,
                flowmeter: body.hydrogen.flowmeter
            } : undefined
        };

        // Input validation — fiziksel sınır kontrolü
        const validationErrors = validateTelemetry(telemetryData);
        if (validationErrors.length > 0) {
            logger.warn('Telemetri validation hatası (POST)', { fields: validationErrors, device_id: body.device_id });
            return res.status(400).json({ error: 'Geçersiz değer', fields: validationErrors });
        }

        const doc = await Telemetry.create(telemetryData);

        logger.info('Telemetry saved (POST)', {
            id: doc._id, device_id: body.device_id,
            event_type: telemetryData.event_type, ip: clientIp
        });

        await invalidateCache('telemetry:latest*');
        throttledBroadcast(body.device_id, { ...telemetryData, _id: doc._id, ts_server: doc.ts_server });

        res.status(201).send('OK');

    } catch (err) {
        logger.error('Telemetry save failed', { device_id: body.device_id, error: err.message });
        res.status(500).send('Internal error');
    }
});

// ==================== GET /api/v1/telemetry/ingest ====================
/**
 * Query string ile telemetri verisi alır (yeni yöntem, düşük bellek).
 * GSM modemi (SIM800L) kısa URL parametreleri gönderir (bvt, bca, btc...).
 * Eski format (bms_voltage_v, device_id) da desteklenir (geriye uyumluluk).
 *
 * Kısa format:  GET /ingest?did=a1&bvt=84&bca=15.5&rpm=3200...
 * Eski format:  GET /ingest?device_id=arac-01&bms_voltage_v=84...
 */
router.get('/ingest', async (req, res) => {
    const q = req.query;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // DEVICE_API_KEY doğrulama — cihaz taklitini önler
    if (!checkDeviceApiKey(req, res)) return;

    const deviceId = q.did || q.device_id;
    if (!deviceId) {
        logger.warn('Geçersiz telemetri GET (did/device_id yok)', { ip: clientIp });
        return res.status(400).send('did gereklidir');
    }

    if (!isValidDeviceId(deviceId)) {
        logger.warn('Geçersiz device_id reddedildi (GET)', { device_id: deviceId, ip: clientIp });
        return res.status(400).json({ error: 'Geçersiz cihaz ID\'si' });
    }

    // Her parametre: kısa format ?? eski format
    const eventType = q.evt ?? q.event_type ?? 'telemetry';
    const uptimeSec = toInt(q.upt ?? q.uptime_sec);
    const bvt = q.bvt ?? q.bms_voltage_v;
    const bca = q.bca ?? q.bms_current_a;
    const btc = q.btc ?? q.bms_temp_c;
    const soc = q.soc ?? q.bms_soc_pct;
    const enr = q.enr ?? q.bms_energy_mwh;
    const rpm = q.rpm ?? q.motor_rpm;
    const spd = q.spd ?? q.motor_speed_kph;
    const dut = q.dut ?? q.motor_duty_pct;
    const lat = q.lat ?? q.gps_lat_deg;
    const lon = q.lon ?? q.gps_lon_deg;
    const ir1 = q.ir1 ?? q.iso_res_1_kohm;
    const ir2 = q.ir2 ?? q.iso_res_2_kohm;
    const h2p = q.h2p ?? q.hydrogen_ppm;
    const h2t = q.h2t ?? q.hydrogen_temp_c;
    const flw = q.flw ?? q.hydrogen_flowmeter;

    try {
        const telemetryData = {
            device_id: deviceId,
            protocol: 'http',
            event_type: eventType,
            uptime_sec: uptimeSec,
            bms: (bvt || bca || btc || soc) ? {
                voltage_v: toFloat(bvt),
                current_a: toFloat(bca),
                temp_c: toFloat(btc),
                soc_pct: toFloat(soc),
                energy_mwh: toFloat(enr)
            } : undefined,
            motor: (rpm || spd || dut) ? {
                rpm: toFloat(rpm),
                speed_kph: toFloat(spd),
                duty_pct: toFloat(dut)
            } : undefined,
            gps: (lat || lon) ? {
                lat_deg: toFloat(lat),
                lon_deg: toFloat(lon)
            } : undefined,
            // İzolasyon ve hidrojen sensörleri — yalnızca Araç 1 (Hidromobil)
            iso: (ir1 || ir2) ? {
                res_1_kohm: toFloat(ir1),
                res_2_kohm: toFloat(ir2)
            } : undefined,
            hydrogen: (h2p || h2t || flw) ? {
                ppm: toInt(h2p),
                temp_c: toFloat(h2t),
                flowmeter: toFloat(flw)
            } : undefined
        };

        // Input validation — fiziksel sınır kontrolü
        const validationErrors = validateTelemetry(telemetryData);
        if (validationErrors.length > 0) {
            logger.warn('Telemetri validation hatası (GET)', { fields: validationErrors, device_id: deviceId });
            return res.status(400).send('Invalid values');
        }

        const doc = await Telemetry.create(telemetryData);

        logger.info('Telemetry saved (GET)', {
            id: doc._id, device_id: deviceId, event_type: eventType, ip: clientIp
        });

        await invalidateCache('telemetry:latest*');
        throttledBroadcast(deviceId, { ...telemetryData, _id: doc._id, ts_server: doc.ts_server });

        res.status(201).send('OK');

    } catch (err) {
        logger.error('Telemetry save failed (GET)', { device_id: deviceId, error: err.message });
        res.status(500).send('Internal error');
    }
});

// ==================== GET /api/v1/telemetry/alerts ====================
/**
 * Her iki araç için aktif alarm durumlarını döner.
 * Android Foreground Service bu endpoint'i periyodik olarak yoklar.
 * Eşikler: temp >= 30 FAN, >= 50 BUZZER, >= 70 KONTAKTÖR, current >= 30A
 */
router.get('/alerts', async (req, res) => {
    try {
        const devices = ['a1', 'a2'];
        const TEMP_FAN = 30, TEMP_BUZZER = 50, TEMP_CRITICAL = 70, CURRENT_THRESHOLD = 30;
        const STALE_SECONDS = 30; // 30 sn'den eski veri → alarm verme

        const alerts = [];
        const activeDevices = []; // Aktif veri akışı olan araçlar

        for (const did of devices) {
            const deviceIds = resolveDeviceIds(did);
            const latest = await Telemetry.findOne({
                device_id: { $in: deviceIds },
                event_type: 'telemetry'
            }).sort({ ts_server: -1 }).lean();

            if (!latest) continue;

            // Eski veri kontrolü
            const ageSeconds = (Date.now() - new Date(latest.ts_server).getTime()) / 1000;
            if (ageSeconds > STALE_SECONDS) continue;

            const temp = latest.bms?.temp_c ?? 0;
            const current = latest.bms?.current_a ?? 0;
            const deviceLabel = did === 'a1' ? 'Hidromobil' : 'Shell Eco';

            // Bu araçta aktif veri akışı var
            activeDevices.push(deviceLabel);

            if (temp >= TEMP_CRITICAL) {
                alerts.push({ device: deviceLabel, type: 'critical', title: '🚨 Kritik Sıcaklık!', message: `${deviceLabel}: ${temp.toFixed(0)}°C — Kontaktör açıldı!` });
            } else if (temp >= TEMP_BUZZER) {
                alerts.push({ device: deviceLabel, type: 'buzzer', title: '⚠️ Sıcaklık Yüksek!', message: `${deviceLabel}: ${temp.toFixed(0)}°C — Buzzer aktif!` });
            } else if (temp >= TEMP_FAN) {
                alerts.push({ device: deviceLabel, type: 'fan', title: '🌡️ Sıcaklık Uyarısı', message: `${deviceLabel}: ${temp.toFixed(0)}°C — Fan aktif` });
            }

            if (current >= CURRENT_THRESHOLD) {
                alerts.push({ device: deviceLabel, type: 'current', title: '⚡ Akım Uyarısı', message: `${deviceLabel}: ${current.toFixed(1)}A — Akım yüksek!` });
            }
        }

        res.json({ alerts, activeDevices, timestamp: new Date().toISOString() });

    } catch (err) {
        logger.error('Get alerts failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/v1/telemetry/latest ====================
/**
 * Aktif araç için en son telemetri kaydını döner.
 * Cache: 5 saniye TTL (sık çağrılan endpoint, cache faydalı).
 * Cache, yeni veri geldiğinde /ingest ve POST tarafından invalidate edilir.
 * @query {string} device_id - Araç ID'si (varsayılan: 'a1')
 */
router.get('/latest', optionalAuth, cacheMiddleware('telemetry:latest', 5), async (req, res) => {
    try {
        const deviceIds = resolveDeviceIds(req.query.device_id || 'a1');

        const latest = await Telemetry.findOne({
            device_id: { $in: deviceIds },
            event_type: 'telemetry'
        }).sort({ ts_server: -1 }).lean();

        if (!latest) {
            return res.status(404).json({ error: 'Veri bulunamadı' });
        }

        res.json({ data: latest });

    } catch (err) {
        logger.error('Get latest telemetry failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/v1/telemetry/history ====================
/**
 * Belirli bir araç ve zaman aralığı için telemetri geçmişini döner.
 * Projection ile sadece grafik/harita için gereken alanlar çekilir (Plan 2.3).
 * Tam veri için export endpoint'ini kullanın.
 * @query {string} device_id - Araç ID'si
 * @query {string} start - Başlangıç zamanı (ISO 8601)
 * @query {string} end - Bitiş zamanı (ISO 8601)
 * @query {number} limit - Maksimum kayıt sayısı (varsayılan: 1000)
 * @query {boolean} full - true ise tüm alanlar döner (varsayılan: false)
 */
router.get('/history', optionalAuth, async (req, res) => {
    try {
        const { device_id, start, end, limit = 1000, full } = req.query;

        const query = { event_type: 'telemetry' };
        if (device_id) query.device_id = device_id;

        if (start || end) {
            query.ts_server = {};
            if (start) query.ts_server.$gte = new Date(start);
            if (end) query.ts_server.$lte = new Date(end);
        }

        // Projection: Grafik ve harita için gereken alanlar (Plan 2.3)
        // ?full=true ile tüm alanlar döner (debug/export senaryosu)
        const projection = full === 'true' ? null :
            'device_id ts_server uptime_sec motor.speed_kph motor.rpm ' +
            'bms.voltage_v bms.current_a bms.temp_c bms.soc_pct bms.energy_mwh ' +
            'gps.lat_deg gps.lon_deg iso.res_1_kohm iso.res_2_kohm ' +
            'hydrogen.ppm hydrogen.temp_c hydrogen.flowmeter';

        const query_ = Telemetry.find(query).sort({ ts_server: -1 }).limit(parseInt(limit));
        if (projection) query_.select(projection);
        const data = await query_.lean();

        res.json({ count: data.length, data });

    } catch (err) {
        logger.error('Get telemetry history failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/v1/telemetry/startups ====================
/**
 * Sistemin başlangıç olaylarını (system_startup) listeler.
 * Her oturum için o oturumda kaç telemetri kaydı olduğunu sayar.
 * ⚠️ N+1 sorgu riski: countDocuments paralel çalıştırılarak azaltıldı.
 * @query {string} device_id - Araç ID'si (varsayılan: 'a1')
 * @query {number} limit - Maksimum startup sayısı (varsayılan: 50)
 */
router.get('/startups', optionalAuth, async (req, res) => {
    try {
        const { device_id = 'a1', limit = 50 } = req.query;
        const deviceIds = resolveDeviceIds(device_id);

        // Startupları yeniden eskiye sırala
        const startups = await Telemetry.find({
            device_id: { $in: deviceIds },
            event_type: 'system_startup'
        })
            .sort({ ts_server: -1 })
            .limit(parseInt(limit))
            .lean();

        // Her startup için kayıt sayısı sorguları paralel çalışır (N+1 → Promise.all)
        const counts = await Promise.all(startups.map((current, i) => {
            const countQuery = {
                device_id: { $in: deviceIds },
                event_type: 'telemetry',
                ts_server: { $gt: current.ts_server }
            };
            // En yeni oturum değilse üst sınır = bir önceki (daha yeni) startup
            if (i > 0) countQuery.ts_server.$lte = startups[i - 1].ts_server;
            return Telemetry.countDocuments(countQuery);
        }));

        const sessions = startups.map((current, i) => ({
            _id: current._id,
            session_start: current.ts_server,
            session_name: new Date(current.ts_server).toLocaleString('tr-TR'),
            record_count: counts[i]
        }));

        res.json({ count: sessions.length, data: sessions });

    } catch (err) {
        logger.error('Get startups failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/v1/telemetry/session/:sessionId ====================
/**
 * Belirli bir startup oturumuna ait telemetri verilerini döner.
 * Oturum başlangıç → sonraki startup arasındaki veriler alınır.
 * @param {string} sessionId - Startup kaydının MongoDB _id'si
 * @query {string} device_id - Araç ID'si (varsayılan: 'a1')
 */
router.get('/session/:sessionId', optionalAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const deviceIds = resolveDeviceIds(req.query.device_id || 'a1');

        const startup = await Telemetry.findById(sessionId);
        if (!startup) {
            return res.status(404).json({ error: 'Oturum bulunamadı' });
        }

        // Bu oturumdan sonraki startup'ı bul → oturum bitiş sınırını belirler
        const nextStartup = await Telemetry.findOne({
            device_id: { $in: deviceIds },
            event_type: 'system_startup',
            ts_server: { $gt: startup.ts_server }
        }).sort({ ts_server: 1 });

        const query = {
            device_id: { $in: deviceIds },
            event_type: 'telemetry',
            ts_server: { $gte: startup.ts_server }
        };
        if (nextStartup) query.ts_server.$lt = nextStartup.ts_server;

        const data = await Telemetry.find(query)
            .sort({ ts_server: 1 })
            .limit(5000)
            .lean();

        res.json({
            session_id: sessionId,
            session_start: startup.ts_server,
            session_end: nextStartup?.ts_server || null,
            count: data.length,
            data
        });

    } catch (err) {
        logger.error('Get session data failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/v1/telemetry/stats ====================
/**
 * Toplam ve son 24 saatteki kayıt sayısı ile en son güncelleme zamanını döner.
 * Sadece admin kullanıcılar erişebilir.
 * @query {string} device_id - Araç ID'si (opsiyonel — tüm araçlar için boş bırakılabilir)
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const { device_id } = req.query;
        const matchStage = { event_type: 'telemetry' };
        if (device_id) matchStage.device_id = device_id;

        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [total, last24hCount, lastData] = await Promise.all([
            Telemetry.countDocuments(matchStage),
            Telemetry.countDocuments({ ...matchStage, ts_server: { $gte: last24h } }),
            Telemetry.findOne(matchStage).sort({ ts_server: -1 }).select('ts_server').lean()
        ]);

        res.json({
            total_records: total,
            last_24h_records: last24hCount,
            last_update: lastData?.ts_server || null
        });

    } catch (err) {
        logger.error('Get stats failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/v1/telemetry/gps-track ====================
/**
 * Belirtilen süre aralığındaki GPS noktalarını döner (harita geçmişi için).
 * Sadece geçerli GPS koordinatları olan kayıtlar döner.
 * @query {string} device_id - Araç ID'si
 * @query {number} hours     - Kaç saatlik geçmiş (varsayılan: 2)
 */
router.get('/gps-track', async (req, res) => {
    try {
        const { device_id = 'a1', hours = 2 } = req.query;
        const since = new Date(Date.now() - parseFloat(hours) * 60 * 60 * 1000);

        const deviceIds = [device_id];
        if (device_id === 'a1') deviceIds.push('arac-01');
        else if (device_id === 'a2') deviceIds.push('arac-02');

        const points = await Telemetry.find({
            device_id: { $in: deviceIds },
            event_type: 'telemetry',
            ts_server: { $gte: since },
            'gps.lat_deg': { $ne: null, $ne: 0 },
            'gps.lon_deg': { $ne: null, $ne: 0 }
        })
        .sort({ ts_server: 1 })
        .limit(3000)
        .select('ts_server gps motor.speed_kph')
        .lean();

        res.json({
            count: points.length,
            since,
            points: points.map(p => ({
                ts: p.ts_server,
                lat: p.gps.lat_deg,
                lon: p.gps.lon_deg,
                speed: p.motor?.speed_kph || 0
            }))
        });

    } catch (err) {
        logger.error('Get GPS track failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;
