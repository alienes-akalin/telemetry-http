# 📚 TEKNİK DOKÜMANTASYON - Telemetry HTTP Server

## 1. Proje Özeti

**Telemetry HTTP Server**, 1.5 ADANA Elektromobil takımının yarış araçlarından gerçek zamanlı telemetri verisi toplayan, depolayan ve görselleştiren bir web uygulamasıdır.

### Temel Özellikler:
- 🔌 **Gerçek zamanlı veri**: Socket.io WebSocket bağlantısı
- 📊 **Canlı grafikler**: Chart.js ile dinamik veri görselleştirme
- 🗺️ **GPS takibi**: Leaflet harita üzerinde konum ve rota
- 💾 **Veri kalıcılığı**: MongoDB veritabanı
- 🔐 **Güvenlik**: JWT tabanlı kimlik doğrulama
- 📱 **Hibrit uygulama**: Android WebView desteği

---

## 2. Klasör Yapısı

```
telemetry-http/
├── src/                    # Sunucu (Backend) kaynak dosyaları
│   ├── server.js           # Ana HTTP sunucusu + Socket.io
│   ├── tcp_server.js       # TCP sunucusu (alternatif protokol)
│   ├── logger.js           # Winston loglama yapılandırması
│   ├── config/
│   │   ├── db.js           # MongoDB bağlantı yöneticisi
│   │   └── redis.js        # Redis bağlantısı + cacheMiddleware
│   ├── middleware/
│   │   └── auth.js         # JWT doğrulama middleware
│   ├── models/
│   │   ├── telemetry.js    # Telemetri veri şeması
│   │   ├── user.js         # Kullanıcı modeli
│   │   ├── customSession.js # Özel paket modeli
│   │   └── test.js         # Test kaydı modeli
│   └── routes/
│       ├── auth.js         # Kimlik doğrulama API'leri
│       ├── telemetry.js    # Telemetri CRUD operasyonları
│       ├── export.js       # CSV/JSON dışa aktarma
│       ├── customSessions.js # Özel paket yönetimi
│       ├── tests.js        # Test kaydı yönetimi
│       └── prank.js        # Owner-only şaka bildirim endpoint'i
│
├── public/                 # İstemci (Frontend) dosyaları
│   ├── index.html          # Ana web sayfası (SPA)
│   ├── css/
│   │   ├── style.css       # Ana stiller (Glassmorphism tema)
│   │   └── extra_styles.css # Ek/genişletilmiş stiller
│   ├── js/
│   │   ├── app.js          # Tüm istemci JavaScript kodu
│   │   └── app.min.js      # Minifiye üretim dosyası (npm run build)
│   ├── img/                # Görseller ve ikonlar
│   ├── manifest.json       # PWA manifest dosyası
│   └── sw.js               # Service Worker (offline destek)
│
├── android-app/            # Android hibrit uygulama
│   └── app/src/main/assets # public/ kopyası (PowerShell sync script'i ile)
│
├── tools/                  # Geliştirici araçları
│   ├── simulate_device.js  # STM32 telemetri simülatörü
│   ├── simulate_device.ps1 # PowerShell simülatör
│   └── export-logs-to-csv.js # Log CSV dışa aktarma
│
├── logs/                   # Winston log dosyaları
├── exports/                # Dışa aktarılan dosyalar
│
├── .env                    # Ortam değişkenleri (gizli)
├── .env.example            # Örnek ortam dosyası
├── package.json            # NPM bağımlılıkları
└── main.c                  # STM32 referans kaynak kodu
```

---

## 3. Mimari Genel Bakış

### 3.1 Veri Akışı Diyagramı

```
┌──────────────────────┐  HTTP GET (2s)   ┌─────────────────────────────┐
│  STM32F407VGTx MCU   │ ───────────────▶ │                             │
│  + SIM800L           │  ?did=a1&bvt=..  │   Express.js Sunucusu       │
│  (arac-01 / a1)      │                  │   (Port 3000)               │
└──────────────────────┘                  │                             │
                                          │  ┌───────────────────────┐  │
┌──────────────────────┐  HTTPS GET (2Hz) │  │  /ingest Handler      │  │
│  ESP8266 BMS         │ ───────────────▶ │  │  1. API Key doğrula   │  │
│  + MCP2515 CAN       │  ?did=a2&btc=..  │  │  2. Input validation  │  │
│  (Esp32_BMS)         │                  │  │  3. MongoDB kaydet    │  │
└──────────────────────┘                  │  │  4. Socket.io yayın   │  │
                                          │  └───────────────────────┘  │
┌──────────────────────┐  HTTPS GET       │                             │
│  ESP8266 Motor/GPS   │ ───────────────▶ │  ┌───────────────────────┐  │
│  + TinyGPS+ + CAN    │  ?did=a2&spd=..  │  │  Socket.io (room)     │  │
│  (Esp32_Surucu)      │                  │  │  io.to(deviceId)      │  │
└──────────────────────┘                  │  │  10Hz throttle        │  │
                                          │  └───────────────────────┘  │
┌──────────────────────┐  WebSocket       │                             │
│  Web Dashboard       │ ◀──────────────▶ │  ┌───────────────────────┐  │
│  (Glassmorphism)     │  subscribe(did)  │  │  MongoDB/Mongoose     │  │
└──────────────────────┘                  │  │  + Redis Cache        │  │
                                          │  └───────────────────────┘  │
┌──────────────────────┐  WebView         └─────────────┬───────────────┘
│  Android Hybrid App  │ ◀──────────────▶               │
│  v1.8 + OTA update   │                                ▼
└──────────────────────┘                  ┌─────────────────────────────┐
                                          │  MongoDB (Atlas / Local)    │
                                          │  Index: device_id + ts_server│
                                          └─────────────────────────────┘
```

### 3.2 Donanım Veri Kaynakları

| Kaynak | Donanım | Protokol | device_id | Aralık | Sensörler |
|--------|---------|----------|-----------|--------|----------|
| **Telemetry_SIM800L** | STM32F407VGTx + SIM800L | HTTP GET (hücresel) | `a1` / `arac-01` | 2s | BMS (27 hücre, 5 sıcaklık), Motor, GPS, İzolasyon, H₂ |
| **Esp32_BMS** | ESP8266 + MCP2515 | HTTPS GET (WiFi) | `a2` | 500ms | BMS: sıcaklık, akım, enerji (mWh), SOC% |
| **Esp32_Surucu** | ESP8266 + MCP2515 + GPS | HTTPS GET (WiFi) | `a2` | Sürekli | Motor: RPM, duty%; GPS: enlem/boylam |

### 3.3 Araç Konfigürasyonu

| device_id | Takma ad | Araç adı | ISO Sensörü | H₂ Sensörü |
|-----------|----------|----------|-------------|-------------|
| `a1` | `arac-01` | Hidromobil | ✅ | ✅ |
| `a2` | `arac-02` | Shell | ❌ | ❌ |

---

## 4. Kritik Kod Blokları

### 4.1 Telemetri Verisi Alma

**Dosya:** `src/routes/telemetry.js`

Sistem iki format destekler:

**GET `/api/v1/telemetry/ingest`** — ESP8266, SIM800L için (kısa query string):
```
GET /ingest?did=a2&btc=35.2&bca=12.5&enr=1250&spd=42.3
```

**POST `/api/v1/telemetry`** — JSON body (STM32 eski format, geriye uyumluluk):
```javascript
router.post('/', async (req, res) => {
    const body = req.body;

    // Input validation — NaN, Infinity, fiziksel sınır dışı değerleri reddeder
    const validationErrors = validateTelemetry(telemetryData);
    if (validationErrors.length > 0) {
        return res.status(400).json({ error: 'Geçersiz değer', fields: validationErrors });
    }

    const doc = await Telemetry.create(telemetryData);

    // Redis cache'i geçersiz kıl
    await invalidateCache('telemetry:latest*');

    // Throttled broadcast — sadece bu cihazı izleyen istemcilere
    throttledBroadcast(body.device_id, { ...telemetryData, _id: doc._id });

    res.status(201).send('OK');
});
```

**Kısa Query String Parametreleri (GET /ingest):**

| Kısa | Uzun (eski) | Alan |
|------|-------------|------|
| `did` | `device_id` | Cihaz ID |
| `bvt` | `bms_voltage_v` | Voltaj (V) |
| `bca` | `bms_current_a` | Akım (A) |
| `btc` | `bms_temp_c` | Sıcaklık (°C) |
| `soc` | `bms_soc_pct` | Şarj % |
| `enr` | `bms_energy_mwh` | Enerji (mWh) |
| `rpm` | `motor_rpm` | RPM |
| `spd` | `motor_speed_kph` | Hız (km/h) |
| `dut` | `motor_duty_pct` | Duty % |
| `lat` | `gps_lat_deg` | Enlem |
| `lon` | `gps_lon_deg` | Boylam |
| `ir1` | `iso_res_1_kohm` | İzolasyon 1 (kΩ) |
| `ir2` | `iso_res_2_kohm` | İzolasyon 2 (kΩ) |
| `h2p` | `hydrogen_ppm` | H₂ (ppm) |
| `h2t` | `hydrogen_temp_c` | H₂ sıcaklığı (°C) |
| `evt` | `event_type` | Olay tipi |
| `upt` | `uptime_sec` | Çalışma süresi |

---

### 4.2 Gerçek Zamanlı Veri Dinleme

**Dosya:** `public/js/app.js`

```javascript
// İstemci bağlandığında cihaz odasına abone ol
socket.emit('subscribe', deviceId);

socket.on('telemetry', (data) => {
    // Sunucu zaten room filtresi uyguluyor;
    // bu kontrol ek güvenlik katmanıdır
    if (data.device_id !== deviceId) return;

    updateDashboardWidgets(data);  // Widget'ları güncelle
    updateCharts(data);            // Grafiklere veri ekle
    updateFullMap(data);           // Haritayı güncelle
});
```

**Socket.io Room Sistemi:**
- İstemci `subscribe(deviceId)` eventi gönderir → sunucu `socket.join(deviceId)` çalıştırır
- Yayın `io.to(deviceId).emit('telemetry', data)` ile yalnızca ilgili odaya yapılır
- Araç değişiminde `unsubscribe(deviceId)` ile eski odadan ayrılınır

**Throttled Broadcast (10Hz):**
- `throttledBroadcast()`: 100ms pencerede aynı cihaz için tek yayın gönderilir
- Pencere dolmadan birden fazla paket gelirse en son veri tutulur, arası atlanır
- İstemci tarafında aşırı render yükü engellenir

---

### 4.3 Sıcaklık Uyarı Sistemi

**Dosya:** `public/js/app.js` (updateDashboardWidgets içinde)

```javascript
if (temp >= 70) {
    tempCard.classList.add('temp-critical');  // KONTAKTÖR - Kırmızı
} else if (temp >= 50) {
    tempCard.classList.add('temp-buzzer');    // BUZZER - Turuncu
} else if (temp >= 30) {
    tempCard.classList.add('temp-fan');       // FAN - Sarı
} else {
    tempCard.classList.add('temp-normal');    // NORMAL - Yeşil
}
```

**Açıklama:** Sıcaklık değerine göre görsel uyarı sistemi etkinleştirilir.

---

### 4.4 JWT Kimlik Doğrulama

**Dosya:** `src/middleware/auth.js`

```javascript
const authenticateToken = async (req, res, next) => {
    const token = authHeader && authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    req.user = user;
    next();
};
```

**Açıklama:** Bearer token'ı doğrular ve kullanıcıyı request nesnesine ekler. Korumalı endpoint'lerde kullanılır.

---

## 5. Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `PORT` | 3000 | HTTP sunucu portu |
| `MONGODB_URI` | mongodb://127.0.0.1:27017/telemetry | Veritabanı bağlantı dizesi |
| `JWT_SECRET` | default-secret-... | Token imzalama anahtarı |
| `JWT_EXPIRES_IN` | 7d | Token geçerlilik süresi |
| `ADMIN_USERNAME` | admin | İlk kurulum kullanıcısı |
| `ADMIN_PASSWORD` | admin123 | İlk kurulum şifresi |
| `TCP_PORT` | 5000 | TCP sunucu portu (opsiyonel) |
| `REDIS_URL` | — | Redis bağlantı URL'i (opsiyonel, tanımlanmazsa cache devre dışı) |

---

## 6. API Endpoint'leri

### Telemetri
| Metod | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/api/v1/telemetry` | Yeni veri kaydet |
| GET | `/api/v1/telemetry/latest` | Son veriyi getir |
| GET | `/api/v1/telemetry/history` | Geçmiş verileri getir |
| GET | `/api/v1/telemetry/startups` | Oturumları listele |
| GET | `/api/v1/telemetry/session/:id` | Oturum verilerini getir |

### Testler
| Metod | Endpoint | Açıklama |
|-------|----------|----------|
| GET | `/api/v1/tests` | Tüm testleri listele (10s Redis cache) |
| POST | `/api/v1/tests` | Yeni test kaydı oluştur |
| DELETE | `/api/v1/tests/:id` | Test kaydını sil |
| GET | `/api/v1/tests/:id/data` | Test telemetri verilerini getir |

### Kimlik Doğrulama
| Metod | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/api/auth/login` | Giriş yap |
| GET | `/api/auth/profile` | Profil bilgisi |
| POST | `/api/auth/setup` | İlk kurulum |

### Dışa Aktarma
| Metod | Endpoint | Açıklama |
|-------|----------|----------|
| GET | `/api/export/csv` | CSV indir |
| GET | `/api/export/json` | JSON indir |

### Prank (Owner Only)
| Metod | Endpoint | Açıklama |
|-------|----------|----------|
| POST | `/api/v1/prank/notify` | Tüm istemcilere şaka bildirimi gönder (sadece `alienes.akalin`) |

---

## 7. Veritabanı Şemaları

### Telemetry Schema

```javascript
{
  device_id: String,        // Cihaz kimliği
  protocol: String,         // 'http' veya 'tcp'
  event_type: String,       // 'telemetry' veya 'system_startup'
  ts_server: Date,          // Sunucu zaman damgası
  bms: {
    voltage_v: Number,      // Batarya voltajı
    current_a: Number,      // Akım
    temp_c: Number,         // Sıcaklık
    soc_pct: Number,        // Şarj durumu %
    energy_mwh: Number      // Harcanan enerji
  },
  motor: {
    rpm: Number,
    speed_kph: Number,
    duty_pct: Number
  },
  gps: {
    lat_deg: Number,
    lon_deg: Number
  },
  iso: {
    res_1_kohm: Number,
    res_2_kohm: Number
  },
  hydrogen: {
    ppm: Number,
    temp_c: Number,
    flowmeter: Number
  }
}
```

---

## 8. Güvenlik Katmanları

| Katman | Araç | Açıklama |
|--------|------|----------|
| Rate Limiting | `express-rate-limit` | /api/* için dakikada 200 istek limiti |
| NoSQL Injection | Özel middleware | `$` ile başlayan body/params key'leri silinir |
| HTTP Başlıkları | `helmet` | Güvenli HTTP başlıkları |
| Sıkıştırma | `compression` | Yanıt boyutunu küçültür |
| JWT Auth | `jsonwebtoken` | Korumalı endpoint'lerde Bearer token doğrulama |
| Redis Cache | `ioredis` | Sık sorgulanan endpoint'lerde 10s önbellekleme |

---

## 9. Çoklu Araç Desteği

Sistem iki araçla çalışabilir. `device_id` ile ayırt edilir:

| device_id | Alias | Araç |
|-----------|-------|------|
| `a1` | `arac-01` | Hidromobil (1. araç) |
| `a2` | `arac-02` | 2. Araç |

Eski kayıtlarla geriye dönük uyumluluk için alias eşleştirmesi `tests.js` ve `telemetry.js` route'larında `DEVICE_ALIASES` map'i ile sağlanır.

Yeni araç eklemek için yalnızca `src/config/deviceConfig.js` dosyasını güncellemek yeterlidir.

---

## 10. OTA (Over-The-Air) Güncelleme

Android v1.8 ile birlikte gelen OTA güncelleme sistemi, kullanıcıların APK'yı store dışında güncellemesini sağlar.

### 10.1 Version Kontrol Endpoint'i

```
GET /api/v1/app/version?current=<versionCode>
```

Yanıt örneği (güncelleme varsa):
```json
{
  "updateAvailable": true,
  "versionCode": 8,
  "versionName": "1.8",
  "releaseNotes": "Arka plan alarm bildirimleri...",
  "downloadUrl": "https://telemetry-aliakalin.com.tr/releases/telemetri-v1.8.apk",
  "forceUpdate": false,
  "apkSizeMb": 4.2
}
```

### 10.2 Yeni Sürüm Yayınlama

1. `android-app/app/build.gradle` içinde `versionCode` ve `versionName` artır
2. `releases/version.json` dosyasını güncelle (`versionCode`, `versionName`, `releaseNotes`, `apkFileName`)
3. Android Studio → **Build → Build APK(s)**
4. APK dosyasını sunucuya yükle: `/root/telemetry-http/releases/telemetri-v<N>.apk`
5. `releases/version.json` dosyasını sunucuya yükle

### 10.3 APK Statik Servis

`/releases` yolu Express static middleware ile servis edilir, cache kapalıdır:
```javascript
app.use('/releases', express.static(path.join(__dirname, '../releases'), { maxAge: 0 }));
```

---

## 11. ESP8266 Donanım Entegrasyonu

### 11.1 Esp32_BMS (BMS Veri Kaynağı)

| Özellik | Değer |
|---------|-------|
| **MCU** | ESP8266 (NodeMCU/Wemos) |
| **CAN Transceiver** | MCP2515 (CS: GPIO15, SPI) |
| **CAN Hızı** | 500 Kbps |
| **WiFi** | WPA2 (V2027 ağı) |
| **TLS** | BearSSL, session reuse, `setInsecure()` |
| **Gönderim Aralığı** | 500ms (2Hz) |
| **device_id** | `a2` |

**CAN Veri Formatı (8 byte):**
```
Byte [0-1] → Sıcaklık (uint16 → 0-100°C eşleme)
Byte [2-3] → Enerji mWh (uint16 → 0-223.56 Wh eşleme)
Byte [4-5] → Akım (uint16 → -10A / +30A eşleme)
Byte [6-7] → SOC/Voltaj % (uint16 → -5% / 105% eşleme)
```

**Eşleme Fonksiyonu:**
```cpp
float custom_map(uint16_t x, uint16_t in_min, uint16_t in_max,
                 float out_min, float out_max) {
    return (float)(x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}
```

### 11.2 Esp32_Surucu (Motor ve GPS Veri Kaynağı)

| Özellik | Değer |
|---------|-------|
| **MCU** | ESP8266 |
| **GPS** | TinyGPS+ (SoftwareSerial, RX=GPIO0, TX=GPIO2) |
| **GPS Baud** | 9600 |
| **CAN Transceiver** | MCP2515 (CS: GPIO15) |
| **device_id** | `a2` |

**Hız Hesabı:**
```cpp
float mm_per_minute = 1.753 * engine_rpm;   // Tekerlek çevresi: 1.753m
float km_per_hour   = mm_per_minute * 0.06;  // (mm/dk) → (km/h)
```

**CAN Veri Formatı (8 byte):**
```
Byte [0-3] → motor_rpm (float, IEEE 754)
Byte [4-7] → duty_cycle (uint32, 0-4096 → 0-100%)
```

---

## 12. Android Assetleri Senkronize Etme

`public/` klasörü değiştiğinde Android hibrit uygulamasını güncellemek için PowerShell scriptini çalıştırın:

```powershell
$src = "telemetry-http\public"
$dst = "telemetry-http\android-app\app\src\main\assets"
Copy-Item "$src\css\style.css" "$dst\css\style.css" -Force
Copy-Item "$src\css\extra_styles.css" "$dst\css\extra_styles.css" -Force
Copy-Item "$src\js\app.js" "$dst\js\app.js" -Force
Copy-Item "$src\js\app.min.js" "$dst\js\app.min.js" -Force
Copy-Item "$src\index.html" "$dst\index.html" -Force
Copy-Item "$src\login.html" "$dst\login.html" -Force
Copy-Item "$src\sw.js" "$dst\sw.js" -Force
Copy-Item "$src\manifest.json" "$dst\manifest.json" -Force
```

Ardından Android Studio'da projeyi yeniden derleyin.

---

## 13. Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Ortam dosyasını oluştur
cp .env.example .env

# Sunucuyu başlat
npm start

# Geliştirme modu (auto-restart)
npm run dev

# Frontend'i minifiye et (üretim)
npm run build
```

---

## 14. İletişim

**Takım:** 1.5 ADANA Elektromobil  
**Proje:** Telemetri Sistemi  
**Yer:** Çukurova Üniversitesi, Adana  
**Son Güncelleme:** 7 Mart 2026 | **Versiyon:** 4.1.0
