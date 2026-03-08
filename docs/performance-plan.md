# Performans Optimizasyon Planı — telemetry-http

Analiz tarihi: 2026-02-22 | Versiyon: 2.0.0

Projenin tüm katmanları incelendi: backend (Node.js/Express), veritabanı (MongoDB/Mongoose), cache (Redis), real-time katman (Socket.io) ve frontend (Vanilla JS, ~2000 satır). Aşağıdaki bulgular ve öneriler öncelik sırasına göre listelenmiştir.

---

## ✅ Öncelik 1 — Kritik (Uygulandı)

### 1.1 MongoDB Bileşik Index Eksikleri

**Sorun:** `telemetry.js` modelinde mevcut indexler:
```js
TelemetrySchema.index({ device_id: 1, ts_server: -1 });
TelemetrySchema.index({ event_type: 1 });
```

`/history`, `/startups`, `/session/:id` endpoint'leri şu sorguyu çalıştırıyor:
```js
{ device_id: {...}, event_type: 'telemetry', ts_server: {...} }
```

Bu 3-alan filtresini karşılayan **bileşik index yok**. Her sorguda collection scan riski var.

**Çözüm:**
```js
// Üç-alan bileşik index — tarih aralığı sorgularını ~10x hızlandırır
TelemetrySchema.index({ device_id: 1, event_type: 1, ts_server: -1 });
```

**Etki:** Yüksek kayıt sayısında (>100K) sorgu süresini 1-2s'den <50ms'ye düşürür.

---

### 1.2 `/ingest` GET Endpoint — `parseFloat` Tekrarı

**Sorun:** Her GET isteğinde ~12 adet `parseFloat` + `parseInt` çağrısı yapılıyor, her biri ayrı koşullu kontrol ile.

**Çözüm:**
```js
const toFloat = (v) => (v !== undefined && v !== '') ? parseFloat(v) : undefined;
const toInt = (v)   => (v !== undefined && v !== '') ? parseInt(v, 10) : undefined;
```

---

### 1.3 Redis Cache — `/latest` Endpoint Cache Invalidation

**Sorun:** Yeni veri geldiğinde `/latest` cache'i invalidate edilmiyordu. Dashboard 5 saniye eski veri gösterebiliyordu.

**Çözüm:** `/ingest` ve `POST /` handler'larına kayıt sonrası:
```js
await invalidateCache('telemetry:latest*');
```

---

### 1.4 `startups` Endpoint — N+1 Query Sorunu

**Sorun:** Her startup kaydı için ayrı `countDocuments()` → 50 startup = 50 DB sorgusu.

**Çözüm:** `Promise.all()` ile paralel çalıştırma:
```js
const counts = await Promise.all(sessions.map(s => Telemetry.countDocuments(queryFor(s))));
```

**Etki:** ~10-20x hız artışı.

---

## 🟡 Öncelik 2 — Orta (Kısmen Uygulandı)

### ✅ 2.1 Frontend — Chart.js `addPoint()` toplu update (Uygulandı)

Her socket mesajında 8 ayrı `chart.update()` → 5 chart için tek toplu `update('none')`.

**Etki:** Chart render CPU kullanımı ~5x azalır.

---

### ✅ 2.2 Socket.io — `io.emit()` → `io.to(room).emit()` (Uygulandı)

Tüm istemcilere broadcast yerine sadece ilgili cihazı izleyenlere gönderim.

---

### ✅ 2.3 `/history` Endpoint — Projection ile Alan Seçimi (Uygulandı)

Sadece gerekli alanlar çekilir. `?full=true` ile tüm alanlar açılabilir.

**Etki:** MongoDB → Node.js veri transferi ~60% azalır.

---

### ✅ 2.4 `auth.js` Middleware — `optionalAuth` DB Sorgusu (Uygulandı)

`optionalAuth` artık DB'ye gitmez, sadece JWT payload'ını decode eder.

---

### 2.5 Server.js — Cache Busting (Bekliyor)

`app.min.js` her zaman aynı isimle sunuluyor. Deploy sonrası tarayıcı eski versiyonu önbellekten alabilir.

**Çözüm seçenekleri:**
```html
<!-- HTML'de query string versioning -->
<script src="/js/app.min.js?v=20260222"></script>
```

---

## 🟢 Öncelik 3 — Uzun Vadeli

### 3.1 MongoDB Time Series Collection

MongoDB 5.0+ üzerinde zaman serisi koleksiyonu — %50-80 alan tasarrufu, hızlı zaman bazlı sorgular.
**Gereksinim:** Migration planı + test süreci.

### 3.2 Frontend — Kod Bölme (Code Splitting)

`app.js` ~2100 satır. Sayfa bazlı lazy import ile ~15-20KB ilk yükleme tasarrufu.

### 3.3 Redis Cache Genişletmesi

| Endpoint | Önerilen TTL |
|----------|-------------|
| `/startups` | 30s |
| `/api/v1/custom-sessions` | 10s |
| `/stats` | 60s |

### 3.4 Logger — `console.log` Duplikasyon

Tüm `console.log` çağrıları `logger.*` ile değiştirilmeli.

---

## Özet Tablo

| # | Sorun | Dosya | Etki | Durum |
|---|-------|-------|------|-------|
| 1.1 | Bileşik index eksik | `models/telemetry.js` | 🔴 Sorgu hızı | ✅ |
| 1.2 | parseFloat tekrarı | `routes/telemetry.js` | 🟡 Temizlik | ✅ |
| 1.3 | Cache invalidation yok | `routes/telemetry.js` | 🟡 Tutarlılık | ✅ |
| 1.4 | N+1 query — startups | `routes/telemetry.js` | 🔴 DB yükü | ✅ |
| 2.1 | 8x chart.update() | `public/js/app.js` | 🟡 CPU/FPS | ✅ |
| 2.2 | io.emit → io.to().emit | `routes/telemetry.js` | 🟡 Trafik | ✅ |
| 2.3 | Projection eksik | `routes/telemetry.js` | 🟡 Transfer | ✅ |
| 2.4 | Auth'da ekstra DB sorgusu | `middleware/auth.js` | 🟢 Minor | ✅ |
| 2.5 | Cache busting yok | `server.js` + `index.html` | 🟡 Deploy | ⏳ |
| 3.1 | Time Series Collection | `models/telemetry.js` | 🔴 Büyük etki | ⏳ |
| 3.2 | Kod bölme | `public/js/app.js` | 🟡 İlk yükleme | ⏳ |
| 3.3 | Redis cache genişletme | `routes/` | 🟡 DB yükü | ⏳ |
| 3.4 | console.log duplikasyon | `src/db.js`, `server.js` | 🟢 Temizlik | ⏳ |
