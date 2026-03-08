// src/routes/customSessions.js
// Kullanıcı tanımlı özel paket (custom session) API rotaları.
const express = require('express');
const router = express.Router();
const CustomSession = require('../models/customSession');
const Telemetry = require('../models/telemetry');
const logger = require('../logger');
const { resolveDeviceIds } = require('../config/deviceConfig');

// ==================== TÜM PAKETLERİ LİSTELE ====================
/**
 * GET /api/v1/custom-sessions
 * @description Kayıtlı tüm özel paketleri getirir
 * @returns {Array} Paket listesi (en yeniden eskiye sıralı)
 */
router.get('/', async (req, res) => {
    try {
        const { device_id } = req.query;
        let filter = {};
        if (device_id === 'a1') {
            // Eski kayıtlar değeri olmayınca null/undefined gelir → Hidromobil'e ait sayılır
            filter = { $or: [{ device_id: 'a1' }, { device_id: { $exists: false } }, { device_id: null }] };
        } else if (device_id) {
            filter = { device_id };
        }
        const sessions = await CustomSession.find(filter).sort({ created_at: -1 }).lean();
        res.json(sessions);
    } catch (err) {
        logger.error('List custom sessions failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// ==================== YENİ PAKET OLUŞTUR ====================
/**
 * POST /api/v1/custom-sessions
 * @description Yeni bir özel paket oluşturur
 * @body {string} name - Paket ismi
 * @body {string} start_time - Başlangıç zamanı (ISO format)
 * @body {string} end_time - Bitiş zamanı (ISO format)
 * @returns {Object} Oluşturulan paket bilgisi
 */
router.post('/', async (req, res) => {
    try {
        const { name, start_time, end_time, device_id } = req.body;

        if (!name || !start_time || !end_time) {
            return res.status(400).json({ error: 'İsim, başlangıç ve bitiş zamanı gerekli' });
        }

        const newSession = await CustomSession.create({
            name,
            start_time: new Date(start_time),
            end_time: new Date(end_time),
            device_id: device_id || 'a1'
        });

        res.status(201).json(newSession);
    } catch (err) {
        logger.error('Create custom session failed', { error: err.message });
        res.status(500).json({ error: 'Oluşturulamadı: ' + err.message });
    }
});

// ==================== PAKETİ SİL ====================
/**
 * DELETE /api/v1/custom-sessions/:id
 * @description Belirtilen paketi siler (veriler silinmez, sadece paket tanımı)
 * @param {string} id - Silinecek paket ID'si
 */
router.delete('/:id', async (req, res) => {
    try {
        await CustomSession.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Silinemedi: ' + err.message });
    }
});

// ==================== PAKET VERİLERİNİ GETİR ====================
/**
 * GET /api/v1/custom-sessions/:id/data
 * @description Paketin kapsadığı zaman aralığındaki telemetri verilerini getirir
 * @param {string} id - Paket ID'si
 * @returns {Object} session: Paket bilgisi, count: Veri sayısı, data: Telemetri dizisi
 */
router.get('/:id/data', async (req, res) => {
    try {
        const session = await CustomSession.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Paket bulunamadı' });

        const limit = Math.min(parseInt(req.query.limit) || 5000, 10000);
        const skip = parseInt(req.query.skip) || 0;

        // Paketin kapsadığı zaman aralığını filtrele
        const telemetryFilter = {
            ts_server: { $gte: session.start_time, $lte: session.end_time }
        };
        if (session.device_id) {
            telemetryFilter.device_id = { $in: resolveDeviceIds(session.device_id) };
        }

        const data = await Telemetry.find(telemetryFilter)
            .sort({ ts_server: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({ session, count: data.length, limit, skip, data });

    } catch (err) {
        logger.error('Get custom session data failed', { error: err.message });
        res.status(500).json({ error: 'Veri alınamadı: ' + err.message });
    }
});

module.exports = router;
