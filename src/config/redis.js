// src/config/redis.js
// Redis cache yardımcı modülü.
// Query sonuçlarını TTL bazlı önbelleğe alarak MongoDB yükünü azaltır.
// Redis bağlanamazsa uygulama cache'siz çalışmaya devam eder (graceful degradation).

const Redis = require('ioredis');
const logger = require('../logger');

// Redis bağlantı ayarları (.env'den veya varsayılan)
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

// Redis client instance
let redis = null;
let isConnected = false;

/**
 * Redis bağlantısını başlatır
 * Bağlantı hatalarını gracefully handle eder
 */
function initRedis() {
    try {
        redis = new Redis({
            host: REDIS_HOST,
            port: REDIS_PORT,
            password: REDIS_PASSWORD,
            retryStrategy: (times) => {
                if (times > 3) {
                    logger.warn('Redis: Max retry exceeded, running without cache');
                    return null; // Stop retrying
                }
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true
        });

        redis.on('connect', () => {
            isConnected = true;
            logger.info('Redis connected successfully');
        });

        redis.on('error', (err) => {
            isConnected = false;
            logger.warn('Redis connection error:', err.message);
        });

        redis.on('close', () => {
            isConnected = false;
        });

        // Bağlantıyı başlat
        redis.connect().catch(() => {
            logger.warn('Redis: Could not connect, caching disabled');
        });

    } catch (err) {
        logger.warn('Redis initialization failed:', err.message);
    }
}

/**
 * Cache'den veri okur
 * @param {string} key - Cache anahtarı
 * @returns {Promise<any|null>} - JSON parse edilmiş veri veya null
 */
async function getCache(key) {
    if (!isConnected || !redis) return null;

    try {
        const data = await redis.get(key);
        if (data) {
            logger.debug(`Cache HIT: ${key}`);
            return JSON.parse(data);
        }
        logger.debug(`Cache MISS: ${key}`);
        return null;
    } catch (err) {
        logger.warn('Redis get error:', err.message);
        return null;
    }
}

/**
 * Cache'e veri yazar
 * @param {string} key - Cache anahtarı
 * @param {any} value - Saklanacak veri (JSON'a çevrilir)
 * @param {number} ttlSeconds - TTL saniye cinsinden
 */
async function setCache(key, value, ttlSeconds = 30) {
    if (!isConnected || !redis) return;

    try {
        await redis.setex(key, ttlSeconds, JSON.stringify(value));
        logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (err) {
        logger.warn('Redis set error:', err.message);
    }
}

/**
 * Belirli bir pattern'e uyan cache'leri siler
 * @param {string} pattern - Key pattern (örn: "telemetry:*")
 */
async function invalidateCache(pattern) {
    if (!isConnected || !redis) return;

    try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            logger.debug(`Cache INVALIDATED: ${pattern} (${keys.length} keys)`);
        }
    } catch (err) {
        logger.warn('Redis invalidate error:', err.message);
    }
}

/**
 * Cache middleware factory
 * Express route'larına kolayca eklenebilir
 * @param {string} keyPrefix - Cache key prefix
 * @param {number} ttl - TTL saniye
 */
function cacheMiddleware(keyPrefix, ttl = 30) {
    return async (req, res, next) => {
        const cacheKey = `${keyPrefix}:${req.originalUrl}`;

        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Response'u yakala ve cache'le
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            setCache(cacheKey, data, ttl);
            return originalJson(data);
        };

        next();
    };
}

/**
 * Redis bağlantı durumunu döndürür
 */
function isRedisConnected() {
    return isConnected;
}

module.exports = {
    initRedis,
    getCache,
    setCache,
    invalidateCache,
    cacheMiddleware,
    isRedisConnected
};
