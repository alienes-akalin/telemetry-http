// src/middleware/auth.js
// JWT token doğrulama middleware'leri
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const logger = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

/**
 * Zorunlu kimlik doğrulama — token yoksa 401 döner.
 * Başarılı doğrulamada kullanıcıyı req.user'a ekler.
 */
const authenticateToken = async (req, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1]; // "Bearer TOKEN"

        if (!token) {
            return res.status(401).json({ error: 'Token gerekli' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }

        req.user = user;
        next();

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token süresi dolmuş' });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Geçersiz token' });
        }

        logger.error('Auth middleware error', { error: err.message });
        return res.status(500).json({ error: 'Sunucu hatası' });
    }
};

/**
 * Admin rolü kontrolü — authenticateToken sonrası kullanılır.
 * Kullanıcı admin değilse 403 döner.
 */
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    }
    next();
};

/**
 * Opsiyonel kimlik doğrulama — token geçerliyse JWT payload'ını req.user'a ekler.
 * DB sorgusu YAPILMAZ (Plan 2.4) — /latest gibi yüksek frekanslı endpoint'lerde
 * her istek için DB round-trip'i önlemek kritiktir.
 * Token yoksa veya geçersizse isteğe devam eder (401 dönmez).
 */
const optionalAuth = (req, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];

        if (token) {
            // verify() token geçersizse exception fırlatır → catch bloğuna düşer
            req.user = jwt.verify(token, JWT_SECRET); // Payload: { userId, iat, exp }
        }

        next();
    } catch {
        // Süresi dolmuş veya geçersiz token — sessizce devam et
        next();
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    optionalAuth,
    JWT_SECRET
};
