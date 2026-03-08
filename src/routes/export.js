// src/routes/export.js
// Telemetri verilerini CSV ve JSON formatında dışa aktarma rotaları.
// Tüm endpoint'ler kimlik doğrulama (JWT) gerektirir.
const express = require('express');
const Telemetry = require('../models/telemetry');
const logger = require('../logger');
const { authenticateToken } = require('../middleware/auth');
const { VEHICLE_CONFIG } = require('../config/deviceConfig');

const router = express.Router();

/**
 * Verilen sorgu parametrelerinden MongoDB filtresi oluşturur.
 * @param {object} query - Express req.query
 * @returns {{ filter: object, limit: number }}
 */
function buildExportFilter(query) {
    const { device_id, start, end, limit = 10000 } = query;
    const filter = { event_type: 'telemetry' };

    if (device_id) filter.device_id = device_id;

    if (start || end) {
        filter.ts_server = {};
        if (start) filter.ts_server.$gte = new Date(start);
        if (end) filter.ts_server.$lte = new Date(end);
    }

    return { filter, limit: parseInt(limit) };
}

// ==================== GET /api/export/csv ====================
/**
 * Telemetri verilerini CSV dosyası olarak indirir.
 * UTF-8 BOM eklenir (Excel'de Türkçe karakter uyumluluğu için).
 * @query {string} device_id - Araç ID'si (opsiyonel)
 * @query {string} start - Başlangıç zamanı (ISO 8601)
 * @query {string} end - Bitiş zamanı (ISO 8601)
 * @query {number} limit - Maksimum satır sayısı (varsayılan: 10000)
 */
router.get('/csv', authenticateToken, async (req, res) => {
    try {
        const { filter, limit } = buildExportFilter(req.query);
        const { device_id } = req.query;

        const data = await Telemetry.find(filter)
            .sort({ ts_server: 1 })
            .limit(limit)
            .lean();

        if (data.length === 0) {
            return res.status(404).json({ error: 'Veri bulunamadı' });
        }

        // Araç tipini belirle: device_id belirtilmişse ona göre; yoksa ilk kayıttan al
        const resolvedDeviceId = device_id || (data[0]?.device_id ?? '');
        const vehicleCfg = VEHICLE_CONFIG[resolvedDeviceId] || { hasIso: false, hasH2: false };

        // ---- Ortak başlıklar ----
        const headers = [
            'timestamp', 'device_id', 'event_type', 'uptime_sec',
            'voltage_v', 'current_a', 'temp_c', 'soc_pct', 'energy_mwh',
            'motor_rpm', 'speed_kph', 'duty_pct',
            'gps_lat', 'gps_lon'
        ];

        // ---- Hidromobil (a1) özel başlıklar ----
        if (vehicleCfg.hasIso) {
            headers.push('iso_res_1_kohm', 'iso_res_2_kohm');
        }
        if (vehicleCfg.hasH2) {
            headers.push('h2_ppm', 'h2_temp_c', 'flowmeter');
        }

        const rows = data.map(row => {
            // Ortak alanlar
            const cols = [
                row.ts_server ? new Date(row.ts_server).toISOString() : '',
                row.device_id || '',
                row.event_type || '',
                row.uptime_sec ?? '',
                row.bms?.voltage_v ?? '',
                row.bms?.current_a ?? '',
                row.bms?.temp_c ?? '',
                row.bms?.soc_pct ?? '',
                row.bms?.energy_mwh ?? '',
                row.motor?.rpm ?? '',
                row.motor?.speed_kph ?? '',
                row.motor?.duty_pct ?? '',
                row.gps?.lat_deg ?? '',
                row.gps?.lon_deg ?? ''
            ];

            // Hidromobil özel alanlar
            if (vehicleCfg.hasIso) {
                cols.push(row.iso?.res_1_kohm ?? '', row.iso?.res_2_kohm ?? '');
            }
            if (vehicleCfg.hasH2) {
                cols.push(row.hydrogen?.ppm ?? '', row.hydrogen?.temp_c ?? '', row.hydrogen?.flowmeter ?? '');
            }

            return cols.join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const vehicleName = vehicleCfg.name || resolvedDeviceId || 'all';
        const filename = `telemetry_${vehicleName}_${new Date().toISOString().slice(0, 10)}.csv`;

        logger.info('CSV export', { device_id: resolvedDeviceId, vehicle: vehicleName, rows: data.length, user: req.user.username });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.write('\ufeff');  // UTF-8 BOM (Excel uyumluluğu)
        res.end(csvContent);

    } catch (err) {
        logger.error('CSV export failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/export/json ====================
/**
 * Telemetri verilerini JSON dosyası olarak indirir.
 * @query {string} device_id - Araç ID'si (opsiyonel)
 * @query {string} start - Başlangıç zamanı (ISO 8601)
 * @query {string} end - Bitiş zamanı (ISO 8601)
 * @query {number} limit - Maksimum kayıt sayısı (varsayılan: 10000)
 */
router.get('/json', authenticateToken, async (req, res) => {
    try {
        const { filter, limit } = buildExportFilter(req.query);
        const { device_id } = req.query;

        const data = await Telemetry.find(filter)
            .sort({ ts_server: 1 })
            .limit(limit)
            .lean();

        const filename = `telemetry_${device_id || 'all'}_${new Date().toISOString().slice(0, 10)}.json`;

        logger.info('JSON export', { device_id, rows: data.length, user: req.user.username });

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json({ exported_at: new Date().toISOString(), count: data.length, device_id: device_id || 'all', data });

    } catch (err) {
        logger.error('JSON export failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

module.exports = router;
