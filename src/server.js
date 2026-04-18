// src/server.js
// Ana HTTP sunucu dosyası — Express, Socket.io, JWT Auth, MongoDB bağlantısını başlatır.
const path = require('path');
const fs = require('fs');

// .env dosyasını yükle — önce .env, yoksa .env.production dene
const envFile = fs.existsSync(path.join(__dirname, '..', '.env'))
  ? '.env'
  : '.env.production';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const rateLimit = require('express-rate-limit');

/**
 * Hafif NoSQL injection koruması — body ve params'taki `$` ile başlayan key'leri siler.
 * express-mongo-sanitize paketi Express'in read-only req.query'siyle çakıştığı için
 * özel middleware yazıldı. req.query dokunulmaz (device_id whitelist yeterli).
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
}
function mongoSanitizeMiddleware(req, res, next) {
  if (req.body) sanitizeObject(req.body);
  if (req.params) sanitizeObject(req.params);
  next();
}

const connectDB = require('./config/db');
const { initRedis, isRedisConnected } = require('./config/redis');
const logger = require('./logger');
const mongoose = require('mongoose');
const Telemetry = require('./models/telemetry');

const authRoutes = require('./routes/auth');
const telemetryRoutes = require('./routes/telemetry');
const customSessionRoutes = require('./routes/customSessions');
const testRoutes = require('./routes/tests');
const exportRoutes = require('./routes/export');
const prankRoutes = require('./routes/prank');
const galleryRoutes = require('./routes/gallery');

// ==================== RATE LIMITERS ====================

/**
 * Genel API limiter — tüm /api/* endpoint'leri için (DoS koruması).
 * 1 dakikada 200 istek: normal kullanıcı ve dashboard'u rahatça kapsar.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit aşıldı. 1 dakika sonra tekrar deneyin.' }
});

/**
 * /ingest limiter — cihaz frekansıyla uyumlu (1Hz = 60/dk, 2Hz = 120/dk).
 * validate: false → express-rate-limit v7+'ın keyGenerator'da req.ip uyarısını bastırır.
 * keyGenerator: cihaz ID varsa cihaz bazlı, yoksa IP bazlı limit uygular.
 */
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180, // 3Hz'e kadar toleranslı
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // keyGenerator'da req.ip kullanımı için gerekli (v7+)
  keyGenerator: (req) => req.query.d || req.query.device_id || req.ip,
  message: { error: 'Cihaz rate limit aşıldı.' }
});

const app = express();
const server = http.createServer(app);

// Socket.io — production'da origin kısıtlanmalı
const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io instance'ını telemetry ve prank route'larına ilet
telemetryRoutes.setSocketIO(io);
prankRoutes.setSocketIO(io);

// ==================== MIDDLEWARE ====================

// HTTP güvenlik başlıkları (XSS, clickjacking, MIME sniffing koruması)
app.use(helmet({
    contentSecurityPolicy: false,
    // YouTube iframe için Referer'a izin ver
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // YouTube embed iframe'inin çalışması için COEP/COOP devre dışı
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false
}));

// Gzip compression — 1KB üzeri yanıtları sıkıştırır (~70-80% boyut azaltma)
app.use(compression({ level: 6, threshold: 1024 }));

// CORS kısıtlaması — sadece dashboard ve localhost'a izin ver (Plan Güv. 1.1)
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://telemetry-aliakalin.com.tr')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // origin undefined = server-to-server veya curl (izin ver)
    // origin 'null' = Android WebView file:// protokolü (izin ver)
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: ${origin} izin listesinde değil`));
  },
  credentials: true
}));
app.use(express.json());

// NoSQL Injection koruması — body ve params'taki `$` key'leri temizler
app.use(mongoSanitizeMiddleware);

// Genel API rate limiting — DoS koruması (Plan Güv. 1.2)
app.use('/api/', apiLimiter);
// /ingest endpoint'i için cihaz-bazlı özel limiter
app.use('/api/v1/telemetry/ingest', ingestLimiter);

// Statik dosyalar — JS/CSS/img için 1 yıllık immutable cache (versioned filenames gerektirir)
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
app.use('/css', express.static(path.join(__dirname, '../public/css'), { maxAge: ONE_YEAR, immutable: true }));
app.use('/js', express.static(path.join(__dirname, '../public/js'), { maxAge: ONE_YEAR, immutable: true }));
app.use('/img', express.static(path.join(__dirname, '../public/img'), { maxAge: ONE_YEAR, immutable: true }));

// APK dosyaları için releases/ dizini (OTA güncelleme)
app.use('/releases', express.static(path.join(__dirname, '../releases'), { maxAge: 0 }));

// HTML ve manifest için cache kapatık (içerik değişebilir)
app.use(express.static('public', { maxAge: 0 }));

// HTTP istek logu — /health endpoint'i hariç
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path !== '/health') {
      logger.debug('HTTP Request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Date.now() - start
      });
    }
  });
  next();
});

// ==================== ROTALAR ====================

// Sağlık kontrolü — harici monitor araçları (uptime robot vb.) için
app.get('/health', async (req, res) => {
  try {
    // MongoDB ping
    const dbState = mongoose.connection.readyState; // 0=kapali, 1=bagli, 2=baglaniyor, 3=kopuyor
    const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';
    let dbPingMs = null;
    if (dbState === 1) {
      const t0 = Date.now();
      await mongoose.connection.db.command({ ping: 1 });
      dbPingMs = Date.now() - t0;
    }

    // Son telemetri zamanı
    const lastRecord = await Telemetry.findOne().sort({ ts_server: -1 }).select('ts_server device_id').lean();

    // Memory kullanımı
    const mem = process.memoryUsage();
    const toMB = (bytes) => Math.round(bytes / 1024 / 1024 * 10) / 10;

    res.json({
      status: dbState === 1 ? 'OK' : 'DEGRADED',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      redis: isRedisConnected() ? 'connected' : 'disconnected',
      mongodb: {
        status: dbStatus,
        pingMs: dbPingMs
      },
      lastTelemetry: lastRecord ? {
        ts: lastRecord.ts_server,
        device_id: lastRecord.device_id,
        ageSeconds: Math.round((Date.now() - new Date(lastRecord.ts_server).getTime()) / 1000)
      } : null,
      memory: {
        heapUsedMB: toMB(mem.heapUsed),
        heapTotalMB: toMB(mem.heapTotal),
        rssMB: toMB(mem.rss)
      }
    });
  } catch (err) {
    logger.error('Health check error', { error: err.message });
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/v1/telemetry', telemetryRoutes);
app.use('/api/v1/prank', prankRoutes.router);
app.use('/api/v1/custom-sessions', customSessionRoutes);
app.use('/api/v1/tests', testRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/v1/gallery', galleryRoutes);

// ==================== HAVA DURUMU PROXY ====================
/**
 * GET /api/v1/weather?lat=xx&lon=yy  veya  ?city=Adana
 * curl üzerinden OpenWeatherMap'e bağlanır (Node.js fetch VDS'de sorunlu).
 */
const { execSync } = require('child_process');
app.get('/api/v1/weather', (req, res) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENWEATHER_API_KEY tanımlı değil' });
  }

  let url;
  if (req.query.lat && req.query.lon) {
    const lat = parseFloat(req.query.lat).toFixed(4);
    const lon = parseFloat(req.query.lon).toFixed(4);
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=tr`;
  } else if (req.query.city) {
    const city = encodeURIComponent(req.query.city.trim().substring(0, 80));
    url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=tr`;
  } else {
    return res.status(400).json({ error: 'lat+lon veya city parametresi gerekli' });
  }

  try {
    const raw = execSync(`curl -s --max-time 8 "${url}"`, { timeout: 10000 }).toString();
    const data = JSON.parse(raw);
    if (data.cod && data.cod !== 200 && data.cod !== '200') {
      return res.status(data.cod === 404 ? 404 : 502).json({ error: data.message || 'API hatası' });
    }
    res.json(data);
  } catch (err) {
    logger.error('Weather proxy hatası:', err.message);
    res.status(502).json({ error: 'Hava durumu verisi alınamadı: ' + err.message });
  }
});

// ==================== OTA GÜNCELLEMESİ ====================

/**
 * Android uygulama versiyon kontrol endpoint'i.
 * İstemci mevcut versionCode'unu gönderir, sunucu yeni versiyon varsa bildirir.
 * GET /api/v1/app/version?current=1
 */
app.get('/api/v1/app/version', (req, res) => {
  try {
    // Cache'lenmiş modülü temizle — version.json güncellendiğinde eski veri dönmesini önler
    delete require.cache[require.resolve('../releases/version.json')];
    const versionInfo = require('../releases/version.json');
    const currentCode = parseInt(req.query.current) || 0;

    const updateAvailable = versionInfo.versionCode > currentCode;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // APK dosya boyutunu hesapla (MB cinsinden)
    let apkSizeMb = versionInfo.apkSizeMb || null;
    if (updateAvailable && !apkSizeMb) {
      try {
        const fs = require('fs');
        const apkPath = path.join(__dirname, '../releases/', versionInfo.apkFileName);
        const stats = fs.statSync(apkPath);
        apkSizeMb = parseFloat((stats.size / (1024 * 1024)).toFixed(1));
      } catch (_) {
        // APK dosyası henüz yüklenmemişse boyut bilinmez
        apkSizeMb = null;
      }
    }

    res.json({
      updateAvailable,
      versionCode: versionInfo.versionCode,
      versionName: versionInfo.versionName,
      releaseNotes: versionInfo.releaseNotes,
      downloadUrl: updateAvailable ? `${baseUrl}/releases/${versionInfo.apkFileName}` : null,
      forceUpdate: versionInfo.forceUpdate || false,
      apkSizeMb: updateAvailable ? apkSizeMb : null
    });
  } catch (err) {
    logger.error('Version check failed', { error: err.message });
    res.status(500).json({ error: 'Versiyon bilgisi okunamadı' });
  }
});

// Kök endpoint — mevcut API endpoint'lerini listeler
app.get('/', (_req, res) => {
  res.json({
    name: 'Telemetry HTTP Server',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      telemetry: '/api/v1/telemetry/*',
      export: '/api/export/*'
    }
  });
});

// 404 — bilinmeyen rotalar
app.use((_req, res) => {
  res.status(404).json({ error: 'Bulunamadı' });
});

// Global hata yakalayıcı
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'İç sunucu hatası' });
});

// ==================== SOCKET.IO ====================
io.on('connection', (socket) => {
  logger.info('Socket.io client connected', { id: socket.id });

  // İstemci belirli bir cihazın odasına katılır (device_id bazlı)
  socket.on('subscribe', (deviceId) => {
    socket.join(deviceId);
    logger.debug('Client subscribed to device', { socketId: socket.id, deviceId });
  });

  // İstemci bir cihazın odasından ayrılır (araç değişiminde)
  socket.on('unsubscribe', (deviceId) => {
    socket.leave(deviceId);
    logger.debug('Client unsubscribed from device', { socketId: socket.id, deviceId });
  });

  socket.on('disconnect', () => {
    logger.debug('Socket.io client disconnected', { id: socket.id });
  });
});

// ==================== SUNUCUYU BAŞLAT ====================
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();

    // Redis opsiyonel — bağlanamazsa uygulama cache'siz çalışmaya devam eder
    initRedis();

    server.listen(PORT, () => {
      logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' });
      console.log(`\n🚀 Telemetry Server listening on port ${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   API:    http://localhost:${PORT}/api/v1/telemetry`);
      console.log(`\n📡 Socket.io ready for real-time connections\n`);
    });

  } catch (err) {
    logger.error('Server startup failed', { error: err.message });
    process.exit(1);
  }
};

// Zarif kapanma — açık bağlantıların tamamlanması beklenir, MongoDB kapatılır
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down...`);
  server.close(async () => {
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (err) {
      logger.error('Error closing MongoDB', { error: err.message });
    }
    logger.info('Server closed gracefully');
    process.exit(0);
  });

  // 10 saniye içinde kapanmazsa zorla kapat
  setTimeout(() => {
    logger.warn('Force shutdown after 10s timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
