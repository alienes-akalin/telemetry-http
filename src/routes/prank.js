// src/routes/prank.js
// Şaka amaçlı bildirim endpoint'i — sadece alienes.akalin kullanabilir
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();

/** Socket.io instance (server.js'den setSocketIO() ile atanır) */
let io = null;
const setSocketIO = (socketIO) => { io = socketIO; };

/**
 * Owner kontrolü — sadece alienes.akalin bu endpoint'i kullanabilir.
 * authenticateToken sonrası kullanılır (req.user dolu olmalı).
 */
const requireOwner = (req, res, next) => {
    if (req.user.username !== 'alienes.akalin') {
        logger.warn('Prank endpoint yetkisiz erişim', { username: req.user.username, ip: req.ip });
        return res.status(403).json({ error: 'Bu özellik sadece owner için' });
    }
    next();
};

// ==================== POST /api/v1/prank/notify ====================
/**
 * Tüm bağlı istemcilere şaka bildirimi gönderir.
 * Sadece alienes.akalin kullanabilir.
 * Body: { title, message, type, icon }
 */
router.post('/notify', authenticateToken, requireOwner, (req, res) => {
    const {
        title = '⚠️ Uyarı!',
        message = 'Dikkat!',
        type = 'danger',
        icon = 'fa-bell'
    } = req.body;

    if (!title || !message) {
        return res.status(400).json({ error: 'Başlık ve mesaj gerekli' });
    }

    // Başlık ve mesaj max uzunluk kontrolü (XSS önlemi)
    if (title.length > 100 || message.length > 200) {
        return res.status(400).json({ error: 'Başlık max 100, mesaj max 200 karakter olabilir' });
    }

    if (io) {
        io.emit('prank_notify', { title, message, type, icon });
        const clientCount = io.engine.clientsCount;
        logger.info('Prank bildirimi gönderildi', {
            title, message, type, icon,
            by: req.user.username,
            recipients: clientCount
        });
        res.json({ success: true, message: `Bildirim ${clientCount} istemciye gönderildi`, recipients: clientCount });
    } else {
        res.status(503).json({ error: 'Socket.io hazır değil' });
    }
});

// ==================== POST /api/v1/prank/play ====================
/**
 * Tüm bağlı istemcilerde YouTube videosunu oynatır.
 * Body: { videoId }
 */
router.post('/play', authenticateToken, requireOwner, (req, res) => {
    const { videoId } = req.body;

    if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
        return res.status(400).json({ error: 'Geçersiz videoId' });
    }

    if (io) {
        io.emit('prank_play', { videoId });
        const clientCount = io.engine.clientsCount;
        logger.info('Prank video yayını başlatıldı', { videoId, by: req.user.username, recipients: clientCount });
        res.json({ success: true, message: `Video ${clientCount} istemciye gönderildi`, recipients: clientCount });
    } else {
        res.status(503).json({ error: 'Socket.io hazır değil' });
    }
});

// ==================== POST /api/v1/prank/stop ====================
/**
 * Tüm istemcilerdeki prank player'u kapatır.
 */
router.post('/stop', authenticateToken, requireOwner, (req, res) => {
    if (io) {
        io.emit('prank_stop');
        logger.info('Prank video durduruldu', { by: req.user.username });
        res.json({ success: true });
    } else {
        res.status(503).json({ error: 'Socket.io hazır değil' });
    }
});

module.exports = { router, setSocketIO };
