// src/routes/auth.js
// Kimlik doğrulama rotaları: giriş, profil, token yenileme, ilk kurulum
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/user');
const logger = require('../logger');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/**
 * Brute-force koruması — 15 dakikada maksimum 15 giriş denemesi (Plan Güv. 1.1)
 * standartHeaders: RateLimit-* header'larını ekler (RFC 6585 uyumlu)
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
    // keyGenerator: IP bazı (varsayılan) — reverse proxy arkasında X-Forwarded-For otomatik
    skipSuccessfulRequests: true, // Başarılı girişler sayıya eklenmez
});

/**
 * Access token üretir (kısa ömürlü: 2 saat)
 */
const generateToken = (userId) => {
    return jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: '2h' });
};

/**
 * Refresh token üretir (uzun ömürlü: 30 gün)
 */
const generateRefreshToken = (userId) => {
    return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
};

// ==================== POST /api/auth/login ====================
/**
 * Kullanıcı girişi — başarılıysa JWT token döner.
 * loginLimiter: 15 dk'da 15 başarısız deneme sonrası kilitlenir (Plan Güv. 1.1).
 * Hem yanlış kullanıcı adı hem de yanlış şifre için aynı hata mesajı
 * kullanılır (kullanıcı adı enumeration'u önlemek için).
 */
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            logger.warn('Login failed - user not found', { username });
            return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            logger.warn('Login failed - wrong password', { username });
            return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        logger.info('Login successful', { username, userId: user._id });

        res.json({
            message: 'Giriş başarılı',
            token,
            refreshToken,
            user: { id: user._id, username: user.username, role: user.role }
        });

    } catch (err) {
        logger.error('Login error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/auth/profile ====================
/**
 * Giriş yapmış kullanıcının profil bilgisini döner.
 * authenticateToken middleware'i req.user'ı doldurur.
 */
router.get('/profile', authenticateToken, (req, res) => {
    res.json({
        user: {
            id: req.user._id,
            username: req.user.username,
            role: req.user.role,
            createdAt: req.user.createdAt,
            lastLogin: req.user.lastLogin
        }
    });
});

// ==================== POST /api/auth/refresh ====================
/**
 * Refresh token ile yeni access token al.
 * Refresh token geçerliyse ve `type: 'refresh'` ise yeni access token döner.
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token gerekli' });
        }

        const decoded = jwt.verify(refreshToken, JWT_SECRET);
        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Geçersiz token tipi' });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }

        const token = generateToken(user._id);
        res.json({ token });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token süresi dolmuş, tekrar giriş yapın' });
        }
        logger.error('Token refresh error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== POST /api/auth/setup ====================
/**
 * İlk kurulum: Hiç kullanıcı yoksa .env'den admin bilgileriyle admin oluşturur.
 * Sistem zaten kurulmuşsa reddeder.
 */
router.post('/setup', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            return res.status(400).json({ error: 'Sistem zaten kurulmuş' });
        }

        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

        await new User({ username: adminUsername, password: adminPassword, role: 'admin' }).save();

        logger.info('Admin user created during setup', { username: adminUsername });

        res.status(201).json({ message: 'Admin kullanıcısı oluşturuldu', username: adminUsername });

    } catch (err) {
        logger.error('Setup error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== POST /api/auth/seed ====================
/**
 * Varsayılan admin ve member kullanıcılarını oluşturur.
 * Mevcut kullanıcılar atlanır. Geliştirme/test ortamı için kullanılır.
 * GÜVENLİK: Production ortamında tamamen engellenir (Plan Güv. 1.3).
 */
router.post('/seed', async (req, res) => {
    // Production'da seed endpoint'i tamamen kapat — admin account reset riski
    if (process.env.NODE_ENV === 'production') {
        logger.warn('Seed endpoint production\'da engellendi', { ip: req.ip });
        return res.status(403).json({ error: 'Seed endpoint’i production ortamında devre dışı' });
    }

    try {
        const users = [
            { username: process.env.SEED_ADMIN_USERNAME  || 'admin',         password: process.env.SEED_ADMIN_PASSWORD  || 'changeme', role: 'admin' },
            { username: process.env.SEED_MEMBER_USERNAME || 'member',        password: process.env.SEED_MEMBER_PASSWORD || 'changeme', role: 'member' },
            { username: process.env.SEED_OWNER_USERNAME  || 'alienes.akalin', password: process.env.SEED_OWNER_PASSWORD  || 'changeme', role: 'admin' }
        ];

        const created = [];
        const existing = [];

        for (const userData of users) {
            const exists = await User.findOne({ username: userData.username });
            if (exists) {
                existing.push(userData.username);
                continue;
            }

            await new User(userData).save();
            created.push(userData.username);
            logger.info('User created during seed', { username: userData.username, role: userData.role });
        }

        res.status(201).json({ message: 'Seed işlemi tamamlandı', created, existing });

    } catch (err) {
        logger.error('Seed error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

module.exports = router;
