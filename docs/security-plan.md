# Güvenlik Planı — telemetry-http

Analiz tarihi: 2026-02-22 | Versiyon: 2.1.0

---

## 🔍 Tam Doğrulama Tablosu

| # | Düzeltme İddiaı | Durum | Kanıt |
|---|--------------|-------|-------|
| Hata 1 | Şifre düz metin karşılaştırma | ✅ **Mevcut değil** | `user.js:36` — bcrypt.hash + comparePassword |
| Hata 2 | `user.toJSON()` tümüyle JWT'ye | ✅ **Mevcut değil** | `auth.js:18` — `jwt.sign({ userId }, ...)` |
| Hata 3 | Rate limiting yok | ✅ **Uygulandı** | `server.js` apiLimiter + `auth.js` loginLimiter |
| Hata 4 | JWT süresi yok (`expiresIn`) | ✅ **Mevcut değil** | `auth.js:17` — `'7d'` default, env ile değiştirilebilir |
| Hata 5 | Input validate/sanitize yok | ✅ **Uygulandı** | `mongoSanitize` + `isValidDeviceId` whitelist |
| Hata 6 | `try/catch` yok — stack trace | ✅ **Mevcut değil** | Tüm route handler'larda try/catch + `err.message` loglanıyor |
| Hata 7 | Seed endpoint prod'da açık | ✅ **Uygulandı** | `auth.js` — production'da 403 dönüyor |

---

## 🔴 Öncelik 1 — Kritik (Hemen Uygulanacak)

### 1.1 Brute Force Koruması — Login Endpoint

**Risk:** `/api/auth/login` endpoint'ine sınırsız istek gönderilebilir. 4 karakterli şifre ~10 dakikada kırılır.

**Çözüm:** `express-rate-limit` ile login'e özel sıkı limit:
```js
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 15,
    message: { error: 'Çok fazla giriş denemesi. 15 dakika bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
});
router.post('/login', loginLimiter, ...);
```

---

### 1.2 Genel API Rate Limit

**Risk:** `/ingest` ve diğer endpoint'ler sınırsız istek alabilir, sunucu DoS'a açık.

**Çözüm:**
```js
// Genel: 1 dk'da 200 istek
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use('/api/', generalLimiter);

// /ingest: Cihaz frekansıyla uyumlu (2Hz = 120/dk)
const ingestLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    keyGenerator: (req) => req.query.d || req.ip,
});
```

---

### 1.3 Seed Endpoint — Production'da Kapat

**Risk:** `/api/auth/seed` production'da erişilebilir. Sadece warn log var, engelleme yok.

**Çözüm:**
```js
if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Seed production'da devre dışı' });
}
```

---

### 1.4 NoSQL Injection — `device_id` Whitelist + `express-mongo-sanitize`

**Risk:** `device_id` body'den alınıp doğrudan Mongoose'a gidiyor. `{$gt: ''}` gibi operatörler gönderilebilir.

**Çözüm A:** `express-mongo-sanitize` tüm body/query'den `$` içeren key'leri temizler:
```js
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
```

**Çözüm B:** `device_id` whitelist:
```js
const VALID_DEVICE_IDS = ['a1', 'a2', 'arac-01', 'arac-02'];
if (!VALID_DEVICE_IDS.includes(deviceId)) {
    return res.status(400).json({ error: 'Geçersiz cihaz ID' });
}
```

**Etki:** Tüm Mongoose sorgularında injection riski ortadan kalkar.

## 🟡 Öncelik 2 — Orta Risk

### 2.1 CORS — Wildcard Origin

**Risk:** `server.js`'de CORS `origin: '*'` production'da açık. Herhangi bir domain API'ye istek atabilir.

**Mevcut:**
```js
origin: '*',  // ← açık
```

**Çözüm:** Whitelist'e al:
```js
const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['https://telemetry-aliakalin.com.tr'];

origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
    } else {
        callback(new Error('CORS: İzin verilmeyen origin'));
    }
}
```

**.env'e ekle:**
```
CORS_ORIGINS=https://telemetry-aliakalin.com.tr,https://www.telemetry-aliakalin.com.tr
```

---

### 2.2 JWT Secret — Varsayılan Değer

**Risk:** `JWT_SECRET` env set edilmezse `'default-secret-change-in-production'` kullanılıyor. Prod'da JWT forge edilebilir.

**Mevcut:**
```js
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
```

**Çözüm:** Production'da hard stop:
```js
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    logger.error('FATAL: JWT_SECRET env eksik. Sunucu kapatılıyor.');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
```

---

### 2.3 Helmet.js — HTTP Güvenlik Header'ları

**Risk:** Express varsayılan header'ları `X-Powered-By: Express` gibi bilgiler sızdırır. XSS, clickjacking koruması yok.

**Çözüm:**
```js
const helmet = require('helmet');
app.use(helmet());
// CSP, HSTS, X-Frame-Options, X-XSS-Protection otomatik eklenir
```

**Paket:** `npm install helmet`

---

### 2.4 Input Validation — Telemetri Endpoint'leri

**Risk:** `/ingest` parametrelerine herhangi bir değer gönderilebilir. `device_id` olarak `../../etc/passwd` gibi path traversal denenebilir.

**Çözüm:** `device_id` whitelist kontrolü:
```js
const VALID_DEVICE_IDS = ['a1', 'a2', 'arac-01', 'arac-02'];

// Handler başında:
if (!VALID_DEVICE_IDS.includes(deviceId)) {
    return res.status(400).json({ error: 'Geçersiz cihaz ID' });
}
```

---

### 2.5 Seed Endpoint — Production'da Açık

**Risk:** `/api/auth/seed` endpoint'i production'da erişilebilir. Admin hesabı resetlenebilir.

**Mevcut:**
```js
if (process.env.NODE_ENV === 'production') {
    logger.warn('Seed endpoint production ortamında çalıştırıldı!');
    // ← sadece uyarı, engellenmiyor
}
```

**Çözüm:** Production'da tamamen kapat:
```js
if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Seed production\'da devre dışı' });
}
```

---

## 🟢 Öncelik 3 — Uzun Vadeli

### 3.1 Refresh Token Stratejisi

**Risk:** JWT `7d` expire. Token çalınırsa 7 gün boyunca geçerli.

**Çözüm:**
- Access token: kısa süre (15-30 dakika)
- Refresh token: uzun süre (7-30 gün), HTTP-only cookie
- Redis'te token blacklist

### 3.2 Login Audit Logu

Başarılı ve başarısız girişleri IP + user-agent ile kayıt altına al. Şüpheli aktivite tespiti için temel oluşturur.

### 3.3 Mongoose NoSQL Injection Koruması

`express-mongo-sanitize` ile `$where`, `$gt` gibi operatörlerin body'den gelmesi engellenir.

```bash
npm install express-mongo-sanitize
```

```js
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
```

---

## Özet Tablo

| # | Açık | Risk | Öncelik | Durum |
|---|------|------|---------|-------|
| 1.1 | Brute force — login | 🔴 Kritik | Hemen | ✅ |
| 1.2 | Genel API rate limit | 🔴 Kritik | Hemen | ✅ |
| 1.3 | Seed prod'da açık | 🔴 Kritik | Hemen | ✅ |
| 1.4 | NoSQL injection | 🔴 Kritik | Hemen | ✅ |
| 2.1 | CORS wildcard | 🟡 Orta | Bu hafta | ⏳ |
| 2.2 | JWT secret default | 🟡 Orta | Bu hafta | ⏳ |
| 2.3 | Helmet eksik | 🟡 Orta | Bu hafta | ⏳ |
| 3.1 | Refresh token | 🟢 Düşük | Uzun vade | ⏳ |
| 3.2 | Login audit | 🟢 Düşük | Uzun vade | ⏳ |

---

## Uygulama Sırası

```
1. npm install express-rate-limit helmet express-mongo-sanitize
2. Login rate limiting (1.1)
3. Genel API rate limiting (1.2)
4. Seed endpoint prod'da kapat (2.5)
5. JWT_SECRET hard stop (2.2)
6. Helmet (2.3)
7. CORS whitelist (2.1)
8. device_id validation (2.4)
9. NoSQL injection (3.3)
```
