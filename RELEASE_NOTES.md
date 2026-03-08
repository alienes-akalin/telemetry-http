# 📋 RELEASE NOTES - Telemetry HTTP Server

## Versiyon Geçmişi

---

### v4.1.0 - Socket.io Rooms, Throttling, OTA & ESP8266 Entegrasyonu (7 Mart 2026)

**📡 Gerçek Zamanlı Altyapı & Çok Kaynaklı Mimari**

Bu sürüm, sisteme iki yeni donanım veri kaynağı (Esp32_BMS ve Esp32_Surucu) eklenmiş; Socket.io, OTA güncelleme ve güvenlik altyapısı önemli ölçüde iyileştirilmiştir.

#### Yeni Özellikler:

**Esp32_BMS — BMS Veri Kaynağı (ESP8266):**
- `Esp32_BMS.ino`: MCP2515 CAN (500Kbps) üzerinden BMS verisi toplar
- Ölçümler: sıcaklık, akım, enerji (mWh), voltaj/SOC yüzdesi
- `/api/v1/telemetry/ingest` endpoint'ine HTTPS GET (BearSSL, session reuse) atar
- Gönderim hızı: 500ms (2Hz); cihaz kimliği: `a2` (Shell aracı)
- API key kimlik doğrulaması: `?key=<hash>` query parametresi
- Oturum başlangıcında `system_startup` paketi gönderilir

**Esp32_Surucu — Motor/GPS Veri Kaynağı (ESP8266):**
- `Esp32_Surucu.ino`: TinyGPS+ kütüphanesi ile GPS (9600 baud, SoftwareSerial)
- MCP2515 CAN üzerinden motor RPM ve duty cycle okur
- Hız hesabı: `RPM × 1.753mm × 0.06 → km/h` (tekerlek çevresinden)
- Verileri `/api/v1/telemetry/ingest`'e HTTPS GET ile iletir; `did=a2`

**Socket.io Room Abonelik Sistemi:**
- İstemciler artık `subscribe(deviceId)` eventi ile cihaz odalarına katılır
- Yayınlar `io.to(deviceId).emit()` ile yalnızca ilgili cihazı izleyen istemcilere gönderilir
- `unsubscribe(deviceId)` eventi ile oda değişimi desteklenir
- Çoklu araç izlemede çapraz veri karışması ortadan kalktı

**Socket.io Throttled Broadcast (10Hz):**
- `BROADCAST_THROTTLE_MS = 100ms` — aynı cihazdan gelen yoğun paketler tekleştirilir
- 100ms pencerede birden fazla paket gelirse yalnızca en son veri gönderilir
- Timer mekanizması: pencere dolmadıysa kalan süre sonunda son veri yayınlanır
- İstemci CPU yükü anlamlı ölçüde azaldı

**Merkezi DeviceConfig Modülü:**
- `src/config/deviceConfig.js` oluşturuldu
- `DEVICE_ALIASES`, `VALID_DEVICE_IDS`, `VEHICLE_CONFIG` tek kaynakta tanımlandı
- `VEHICLE_CONFIG`: Hidromobil (`a1`) — ISO ve H2 sensörlü; Shell (`a2`) — sensörsüz
- Tüm route'lar artık `resolveDeviceIds()` ve `isValidDeviceId()` kullanır

**Input Validation (Fiziksel Sınır Kontrolü):**
- `validateTelemetry()` fonksiyonu eklendi — NaN, Infinity ve fiziksel sınır dışı değerleri reddeder
- Alan bazlı limit tablosu (`FIELD_LIMITS`): voltaj, akım, sıcaklık, GPS, RPM vb.
- Geçersiz değer geleninde `400 Bad Request` + hatalı alan listesi döner

**API Key Kimlik Doğrulaması (`/ingest`):**
- `DEVICE_API_KEY` ortam değişkeni tanımlandığında `/ingest` endpoint'i key doğrular
- Doğrulama: `?key=` query parametresi veya `X-Api-Key` header'ı
- `DEVICE_API_KEY` yoksa (geliştirme) kontrol atlanır — sıfır konfigürasyonlu geliştirme
- Esp32_BMS API key'i firmware'de sabit kodlu (hash)

**OTA (Over-The-Air) Güncelleme Sistemi:**
- `GET /api/v1/app/version?current=<versionCode>` endpoint'i eklendi
- `releases/version.json` okur; `versionCode` karşılaştırarak güncelleme gerekip gerekmediğini bildirir
- APK dosyası varsa boyutu otomatik hesaplar (`fs.statSync`)
- `forceUpdate`, `releaseNotes`, `downloadUrl` yanıtta döner
- Android uygulaması bu endpoint'i periyodik olarak kontrol eder

**Android v1.8 — Arka Plan Alarm Bildirimleri:**
- Uygulama kapalı olsa bile sıcaklık ve akım uyarıları sistem bildirimi olarak gelir
- Veri akışı başladığında bağlantı bildirimi gösterilir
- `versionCode: 8`, `minSdk: 24`, `compileSdk: 34`

**CORS ve Güvenlik İyileştirmeleri:**
- CORS'a `origin === 'null'` istisnası eklendi (Android WebView `file://` protokolü)
- İzinli origin'ler `CORS_ORIGINS` ortam değişkeniyle yapılandırılabilir
- Statik dosyalar için 1 yıllık immutable cache (`/css`, `/js`, `/img`)
- HTML ve manifest için cache kapalı (sık güncelleme)

**Graceful Shutdown:**
- `SIGTERM` ve `SIGINT` sinyalleri yakalanır — açık istekler tamamlanır
- MongoDB bağlantısı düzgün kapatılır
- 10 saniye zaman aşımı sonrası zorla kapatma desteği

---

### v4.0.0 - Güvenlik, Çoklu Araç & Test Sistemi (28 Şubat 2026)

**🔒 Güvenlik & Performans Altyapısı**

#### Yeni Özellikler:

**Güvenlik Katmanları:**
- `express-rate-limit` eklendi — tüm `/api/*` endpoint'leri için dakikada 200 istek limiti (DoS koruması)
- Özel NoSQL injection sanitizer middleware — `$` ile başlayan key'leri body ve params'tan temizler
- `helmet` ile güvenli HTTP başlıkları
- `compression` ile yanıt sıkıştırma

**Redis Önbellekleme:**
- `src/config/redis.js` oluşturuldu — `initRedis()` ve `cacheMiddleware()` fonksiyonları
- Sık sorgulanan endpoint'lerde 10 saniyelik Redis önbellekleme aktif
- Redis tanımlı değilse sistem yine de çalışır (opsiyonel bağımlılık)

**Test Kayıt Sistemi:**
- `src/routes/tests.js` eklendi — dashboard'dan başlatılan test oturumu yönetimi
- `src/models/test.js` eklendi — test kaydı Mongoose şeması
- Endpoint'ler: `GET/POST /api/v1/tests`, `DELETE /api/v1/tests/:id`, `GET /api/v1/tests/:id/data`

**Çoklu Araç Desteği:**
- `device_id` alias eşleştirmesi eklendi: `a1` ↔ `arac-01` (Hidromobil), `a2` ↔ `arac-02`
- Eski kayıtlarla geriye dönük uyumluluk sağlandı

**Prank Endpoint (Owner-Only):**
- `src/routes/prank.js` eklendi
- `POST /api/v1/prank/notify` — sadece `alienes.akalin` kullanabilir
- JWT doğrulama + özel `requireOwner` middleware koruması

**Frontend Güncellemeleri:**
- `public/css/extra_styles.css` eklendi (genişletilmiş stil dosyası)
- `public/js/app.min.js` build pipeline'a dahil edildi (`npm run build` ile üretilir)

**Android Senkronizasyon:**
- Android hibrit uygulama asset senkronizasyonu PowerShell scripti ile yapılıyor (xcopy yerine Copy-Item)
- `css/extra_styles.css` ve `js/app.min.js` da senkronize ediliyor

---

### v3.3.0 - Refactoring & Optimizasyon (29 Ocak 2026)

**🧹 Kod Temizliği & Dokümantasyon Güncellemesi**

Bu sürümde kapsamlı bir "Clean Code" revizyonu gerçekleştirildi:

#### Yapılan Değişiklikler:

**Temizlik:**
- `src/routes/auth.js`: İngilizce yorum satırı Türkçeye çevrildi
- `src/routes/telemetry.js`: Kullanılmayan `query` değişkeni kaldırıldı (satır 183-198)
- `src/config/db.js`: İngilizce yorum Türkçeye çevrildi
- `src/routes/customSessions.js`: Debug amaçlı console.log satırları kaldırıldı
- Tüm dosyalarda yorum tutarlılığı sağlandı

**Dokümantasyon:**
- `RELEASE_NOTES.md` oluşturuldu (bu dosya)
- `TECHNICAL_DOCS.md` oluşturuldu (teknik mimari dokümantasyonu)

**CSS/UI Düzeltmeleri:**
- Stat-card hover efektinde renk kaybı sorunu giderildi
- Premium cam çerçeve (glass border) opacity 0.25'e yükseltildi
- box-shadow override kaldırıldı (inset glow koruması)

---

### v3.0.0 - UI/UX Modernizasyonu (27-28 Ocak 2026)

**🎨 Görsel İyileştirmeler**

- Glassmorphism tasarım dili uygulandı
- Neon glow efektleri eklendi (stat-card'lar)
- Sıcaklık uyarı sistemi (Normal/Fan/Buzzer/Kontaktör)
- Blue-dot GPS marker stili
- Karanlık tema harita katmanı (CARTO Dark)
- Android/iOS hibrit uygulama desteği

---

### v2.0.0 - Socket.io & Gerçek Zamanlı (Aralık 2025)

**📡 Canlı Veri Akışı**

- Socket.io WebSocket entegrasyonu
- Gerçek zamanlı dashboard güncellemeleri
- Chart.js grafik altyapısı
- Leaflet harita entegrasyonu
- Oturum (session) yönetim sistemi

---

### v1.0.0 - İlk Sürüm (Kasım 2025)

**🚀 Temel Altyapı**

- Express.js HTTP sunucusu
- MongoDB veri depolama
- RESTful API tasarımı
- JWT kimlik doğrulama
- CSV/JSON dışa aktarma

---

## Gelecek Planları

- [x] ~~Çoklu araç (multi-device) desteği~~ ✅ v4.0.0'da tamamlandı
- [x] ~~Test kayıt sistemi~~ ✅ v4.0.0'da tamamlandı
- [x] ~~Socket.io room bazlı yayın~~ ✅ v4.1.0'da tamamlandı
- [x] ~~OTA güncelleme sistemi~~ ✅ v4.1.0'da tamamlandı
- [x] ~~Android arka plan bildirimleri~~ ✅ v4.1.0 (Android v1.8)
- [ ] Alarm/bildirim sistemi (dashboard push notification — masaüstü)
- [ ] Geçmiş veri analizi ve raporlama
- [ ] Native Mobil Uygulama (React Native - Performans Odaklı)
