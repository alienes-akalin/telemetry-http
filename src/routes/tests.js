// src/routes/tests.js
// Dashboard'dan başlatılan test kayıtları API rotaları.
const express = require('express');
const router = express.Router();
const Test = require('../models/test');
const Telemetry = require('../models/telemetry');
const logger = require('../logger');
const { cacheMiddleware } = require('../config/redis');
const { resolveDeviceIds } = require('../config/deviceConfig');

// ==================== TÜM TESTLERİ LİSTELE ====================
/**
 * GET /api/v1/tests
 * @description Kayıtlı tüm testleri getirir (10s cache)
 * @returns {Array} Test listesi (en yeniden eskiye sıralı)
 */
router.get('/', cacheMiddleware('tests:list', 10), async (req, res) => {
    try {
        const { device_id } = req.query;
        let filter = {};
        if (device_id === 'a1') {
            // Eski kayıtlar (device_id olmayan) Hidromobil'e ait sayılır
            filter = { $or: [{ device_id: 'a1' }, { device_id: { $exists: false } }, { device_id: null }] };
        } else if (device_id) {
            filter = { device_id };
        }
        const tests = await Test.find(filter).sort({ created_at: -1 }).lean();
        res.json(tests);
    } catch (err) {
        logger.error('List tests failed', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// ==================== YENİ TEST OLUŞTUR ====================
/**
 * POST /api/v1/tests
 * @description Yeni bir test kaydı oluşturur
 * @body {string} name - Test ismi (otomatik: "Başlangıç - Bitiş")
 * @body {string} start_time - Başlangıç zamanı (ISO format)
 * @body {string} end_time - Bitiş zamanı (ISO format)
 * @body {number} [total_laps] - Toplam tur sayısı (opsiyonel)
 * @returns {Object} Oluşturulan test bilgisi
 */
router.post('/', async (req, res) => {
    try {
        const { name, start_time, end_time, total_laps, device_id } = req.body;

        if (!name || !start_time || !end_time) {
            return res.status(400).json({ error: 'İsim, başlangıç ve bitiş zamanı gerekli' });
        }

        const newTest = await Test.create({
            name,
            start_time: new Date(start_time),
            end_time: new Date(end_time),
            total_laps: total_laps || 0,
            device_id: device_id || 'a1'
        });

        res.status(201).json(newTest);
    } catch (err) {
        logger.error('Create test failed', { error: err.message });
        res.status(500).json({ error: 'Oluşturulamadı: ' + err.message });
    }
});

// ==================== TESTİ SİL ====================
/**
 * DELETE /api/v1/tests/:id
 * @description Belirtilen testi siler
 * @param {string} id - Silinecek test ID'si
 */
router.delete('/:id', async (req, res) => {
    try {
        await Test.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Silinemedi: ' + err.message });
    }
});

// ==================== TEST GÜNCELLE (label / description) ====================
/**
 * PATCH /api/v1/tests/:id
 * @description Testin label veya description alanını günceller
 * @body {string} [label]       - Kısa isim (listede görünür)
 * @body {string} [description] - Açıklama (sadece detayda görünür)
 */
router.patch('/:id', async (req, res) => {
    try {
        const { label, description } = req.body;
        const update = {};
        if (label !== undefined) update.label = label;
        if (description !== undefined) update.description = description;

        const test = await Test.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!test) return res.status(404).json({ error: 'Test bulunamadı' });

        logger.info('Test updated', { id: req.params.id, fields: Object.keys(update) });
        res.json(test);
    } catch (err) {
        logger.error('Update test failed', { error: err.message });
        res.status(500).json({ error: 'Güncellenemedi: ' + err.message });
    }
});

// ==================== TEST VERİLERİNİ GETİR ====================
/**
 * GET /api/v1/tests/:id/data
 * @description Testin kapsadığı zaman aralığındaki telemetri verilerini getirir
 * @param {string} id - Test ID'si
 * @returns {Object} test: Test bilgisi, count: Veri sayısı, data: Telemetri dizisi
 */
router.get('/:id/data', async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ error: 'Test bulunamadı' });

        const limit = Math.min(parseInt(req.query.limit) || 5000, 10000);
        const skip = parseInt(req.query.skip) || 0;

        // Testin kapsadığı zaman aralığını filtrele
        const telemetryFilter = {
            ts_server: { $gte: test.start_time, $lte: test.end_time }
        };
        if (test.device_id) {
            telemetryFilter.device_id = { $in: resolveDeviceIds(test.device_id) };
        }

        const data = await Telemetry.find(telemetryFilter)
            .sort({ ts_server: 1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({ test, count: data.length, limit, skip, data });

    } catch (err) {
        logger.error('Get test data failed', { error: err.message });
        res.status(500).json({ error: 'Veri alınamadı: ' + err.message });
    }
});

module.exports = router;
