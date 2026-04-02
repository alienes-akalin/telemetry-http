// src/routes/auth.js
// Kimlik doğrulama rotaları: giriş, kayıt, profil, token yenileme, süperadmin yönetim
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/user');
const RegistrationRequest = require('../models/registrationRequest');
const logger = require('../logger');
const { authenticateToken, requireSuperAdmin, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/**
 * Brute-force koruması — 15 dakikada maksimum 15 giriş denemesi
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
    skipSuccessfulRequests: true,
});

/**
 * Kayıt rate limiter — 1 saatte 5 kayıt talebi (spam koruması)
 */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Çok fazla kayıt talebi. 1 saat sonra tekrar deneyin.' },
});

const generateToken = (userId) => {
    return jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: '2h' });
};

const generateRefreshToken = (userId) => {
    return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
};

// ==================== POST /api/auth/login ====================
/**
 * Kullanıcı girişi — artık rol seçimi yok, sadece username + password
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
        logger.info('Login successful', { username, role: user.role });

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

// ==================== POST /api/auth/register ====================
/**
 * Kayıt talebi oluşturur — süperadmin onayı gerekir
 */
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { username, password, passwordConfirm, requestedRole } = req.body;

        // Validasyonlar
        if (!username || !password || !passwordConfirm) {
            return res.status(400).json({ error: 'Tüm alanlar zorunludur' });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Kullanıcı adı 3-20 karakter olmalı' });
        }

        if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
            return res.status(400).json({ error: 'Kullanıcı adı sadece harf, rakam, nokta, tire ve alt çizgi içerebilir' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({ error: 'Şifreler eşleşmiyor' });
        }

        const validRoles = ['member', 'admin'];
        if (requestedRole && !validRoles.includes(requestedRole)) {
            return res.status(400).json({ error: 'Geçersiz rütbe seçimi' });
        }

        // Aynı kullanıcı adı zaten kayıtlı mı?
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
        }

        // Zaten bekleyen bir talep var mı?
        const existingRequest = await RegistrationRequest.findOne({
            username: username.toLowerCase(),
            status: 'pending'
        });
        if (existingRequest) {
            return res.status(409).json({ error: 'Bu kullanıcı adı için zaten bekleyen bir talep var' });
        }

        // Talebi oluştur
        const request = new RegistrationRequest({
            username: username.toLowerCase(),
            password, // pre-save hook hash'leyecek
            requestedRole: requestedRole || 'member'
        });
        await request.save();

        logger.info('Registration request created', { username: request.username, requestedRole: request.requestedRole });

        res.status(201).json({ message: 'Kayıt talebiniz oluşturuldu. Süperadmin onayı bekleniyor.' });

    } catch (err) {
        logger.error('Register error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/auth/pending ====================
/**
 * Bekleyen kayıt taleplerini listeler (sadece süperadmin)
 */
router.get('/pending', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const requests = await RegistrationRequest.find({ status: 'pending' })
            .sort({ createdAt: -1 })
            .select('-password')
            .lean();

        res.json(requests);
    } catch (err) {
        logger.error('Get pending requests error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== POST /api/auth/approve/:id ====================
/**
 * Kayıt talebini onaylar ve kullanıcı oluşturur (sadece süperadmin)
 * Body: { assignedRole: 'admin' | 'member' }
 */
router.post('/approve/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { assignedRole } = req.body;

        if (!assignedRole || !['admin', 'member'].includes(assignedRole)) {
            return res.status(400).json({ error: 'Geçerli bir rütbe seçin (admin veya member)' });
        }

        const request = await RegistrationRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ error: 'Talep bulunamadı' });
        }
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Bu talep zaten işlenmiş' });
        }

        // Kullanıcıyı oluştur (şifre zaten hash'li, tekrar hash'lenmemeli)
        const user = new User({
            username: request.username,
            password: request.password, // Zaten hash'li
            role: assignedRole
        });
        // pre-save hook'u atlamak için isModified kontrolü zaten var
        // ama password zaten hash'li olduğu için tekrar hash'lenecek — bunu önle
        user.$skipPasswordHash = true;
        await user.save();

        // Talebi güncelle
        request.status = 'approved';
        await request.save();

        logger.info('Registration approved', {
            username: request.username,
            assignedRole,
            approvedBy: req.user.username
        });

        res.json({ message: `${request.username} kullanıcısı ${assignedRole} olarak onaylandı` });

    } catch (err) {
        logger.error('Approve error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== POST /api/auth/reject/:id ====================
/**
 * Kayıt talebini reddeder ve siler (sadece süperadmin)
 */
router.post('/reject/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const request = await RegistrationRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ error: 'Talep bulunamadı' });
        }
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Bu talep zaten işlenmiş' });
        }

        // Reddet ve sil
        await RegistrationRequest.findByIdAndDelete(req.params.id);

        logger.info('Registration rejected', {
            username: request.username,
            rejectedBy: req.user.username
        });

        res.json({ message: `${request.username} talebi reddedildi` });

    } catch (err) {
        logger.error('Reject error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== GET /api/auth/profile ====================
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

// ==================== GET /api/auth/users ====================
/**
 * Tüm kayıtlı kullanıcıları listeler (sadece süperadmin)
 */
router.get('/users', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        res.json(users);
    } catch (err) {
        logger.error('List users error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== DELETE /api/auth/users/:id ====================
/**
 * Kullanıcı siler (sadece süperadmin, kendini silemez)
 */
router.delete('/users/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: 'Kendinizi silemezsiniz' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }
        if (user.role === 'superadmin') {
            return res.status(403).json({ error: 'Süperadmin silinemez' });
        }

        await User.findByIdAndDelete(req.params.id);
        logger.info('User deleted', { username: user.username, deletedBy: req.user.username });

        res.json({ message: `${user.username} kullanıcısı silindi` });
    } catch (err) {
        logger.error('Delete user error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== PATCH /api/auth/users/:id/role ====================
/**
 * Kullanici rolunu degistirir (sadece superadmin, kendi rolunu degistiremez)
 * Body: { role: 'admin' | 'member' }
 */
router.patch('/users/:id/role', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { role } = req.body;

        if (!role || !['admin', 'member'].includes(role)) {
            return res.status(400).json({ error: 'Gecerli bir rol secin (admin veya member)' });
        }

        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ error: 'Kendi rolunuzu degistiremezsiniz' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'Kullanici bulunamadi' });
        }
        if (user.role === 'superadmin') {
            return res.status(403).json({ error: 'Superadmin rolu degistirilemez' });
        }

        const oldRole = user.role;
        user.role = role;
        await user.save();

        logger.info('User role changed', {
            username: user.username,
            from: oldRole,
            to: role,
            changedBy: req.user.username
        });

        res.json({ message: `${user.username} kullanicisinin rolu ${role} olarak guncellendi` });

    } catch (err) {
        logger.error('Change role error', { error: err.message });
        res.status(500).json({ error: 'Sunucu hatasi' });
    }
});

module.exports = router;
