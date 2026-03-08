<p align="center">
  <img src="public/img/logo_c.png" alt="1.5 ADANA Logo" width="160" />
</p>

<h1 align="center">🏎️ 1.5 ADANA — Telemetri Sistemi</h1>

<p align="center">
  <strong>Gerçek zamanlı elektrikli araç telemetri platformu</strong><br/>
  STM32 → HTTP → Dashboard — uçtan uca veri akışı
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Express_5-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Socket.io-4.7-010101?logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white" alt="JWT" />
  <img src="https://img.shields.io/badge/Chart.js-Graphs-FF6384?logo=chart.js&logoColor=white" alt="Chart.js" />
  <img src="https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/PWA-Offline-5A0FC8?logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/Android-Hybrid_App-3DDC84?logo=android&logoColor=white" alt="Android" />
</p>

---

## 📸 Ekran Görüntüleri

<p align="center">
  <img src="public/img/screenshot-wide.png" alt="Dashboard — Masaüstü" width="720" />
</p>
<p align="center"><em>Masaüstü Dashboard — gerçek zamanlı hız, enerji, sıcaklık, harita</em></p>

<p align="center">
  <img src="public/img/screenshot-mobile.png" alt="Dashboard — Mobil" height="420" />
</p>
<p align="center"><em>Mobil arayüz — PWA olarak ana ekrana eklenebilir</em></p>

---

## 🔍 Proje Nedir?

**1.5 ADANA Telemetri Sistemi**, TÜBİTAK Efficiency Challenge yarışmaları için geliştirilen elektrikli aracın canlı veri izleme platformudur.

Araç üzerindeki **STM32F407** mikrodenetleyici, CAN bus üzerinden BMS, motor sürücü, GPS ve sensör verilerini toplar; **SIM800L** hücresel modülü aracılığıyla 2 saniye aralıklarla sunucuya HTTP POST gönderir. Sunucu bu verileri **MongoDB**'ye kaydeder ve **Socket.io** ile bağlı tüm istemcilere anında yayınlar.

```
┌──────────────┐     HTTP POST      ┌──────────────────┐    Socket.io     ┌───────────────┐
│  STM32 MCU   │ ─── (2s aralık) ──▸│  Node.js Sunucu  │ ──── yayın ────▸│  Web / Mobil   │
│  + SIM800L   │     JSON body      │  Express + Mongo  │                 │  Dashboard     │
└──────────────┘                    └──────────────────┘                 └───────────────┘
      │                                     │                                    │
  CAN Bus                              MongoDB                          Chart.js + Leaflet
  ├─ BMS (voltaj, akım, sıcaklık)     kalıcı depolama                  gerçek zamanlı
  ├─ Motor (RPM, hız, duty)                                            grafikler & harita
  ├─ GPS (lat, lon)
  └─ Sensörler (H₂, izolasyon)
```

---

## ✨ Özellikler

| Kategori | Detay |
|:---------|:------|
| 🔄 **Gerçek Zamanlı** | Socket.io ile 100ms throttled yayın — tüm istemciler anlık güncellenir |
| 📊 **Grafikler** | Chart.js ile hız, enerji, sıcaklık, SOC, izolasyon grafikleri |
| 🗺️ **Canlı Harita** | Leaflet.js — GPS koordinatlarından anlık konum takibi |
| 🌡️ **Sıcaklık Alarmları** | 30°C Fan · 50°C Buzzer · 70°C Kontaktör — renk kodlu kartlar |
| 📱 **PWA** | Service Worker + Manifest — mobil cihazlara yüklenebilir |
| 🤖 **Android Uygulama** | WebView tabanlı hibrit uygulama + OTA güncelleme desteği |
| 🔐 **JWT Auth** | Rol tabanlı yetkilendirme (admin / member / viewer) |
| 🛡️ **Güvenlik** | Helmet, CORS, Rate-limit, NoSQL injection koruması |
| 📤 **Veri Dışa Aktarım** | CSV / JSON formatında filtrelenmiş veri indirme |
| ⏱️ **Oturum & Test** | Özel zaman aralıkları tanımlayarak test verilerini gruplandırma |
| 🕐 **Kronometre** | Dashboard üzerinde yarış kronometresi |
| 🌙 **Tema** | Açık / Koyu mod desteği (localStorage ile kalıcı) |
| 📷 **Galeri** | Google Drive entegrasyonu — takım fotoğrafları |

---

## 🏗️ Proje Yapısı

```
telemetry-http/
├── src/                        # ── Backend ──
│   ├── server.js               #    Express + Socket.io sunucu
│   ├── logger.js               #    Winston loglama
│   ├── config/
│   │   ├── db.js               #    MongoDB bağlantısı
│   │   ├── redis.js            #    Redis önbellek (opsiyonel)
│   │   └── deviceConfig.js     #    Araç konfigürasyonları
│   ├── middleware/
│   │   └── auth.js             #    JWT doğrulama & rol kontrolü
│   ├── models/
│   │   ├── telemetry.js        #    Telemetri veri şeması
│   │   ├── user.js             #    Kullanıcı modeli
│   │   ├── customSession.js    #    Özel oturum grupları
│   │   └── test.js             #    Test kayıtları
│   └── routes/
│       ├── auth.js             #    Giriş, çıkış, token yenileme
│       ├── telemetry.js        #    Veri alımı & sorgulama
│       ├── customSessions.js   #    Oturum yönetimi
│       ├── tests.js            #    Test kayıt CRUD
│       ├── export.js           #    CSV / JSON dışa aktarım
│       └── gallery.js          #    Google Drive proxy
│
├── public/                     # ── Frontend (PWA) ──
│   ├── index.html              #    Ana dashboard
│   ├── login.html              #    Giriş sayfası
│   ├── sw.js                   #    Service Worker — çevrimdışı destek
│   ├── js/app.js               #    Uygulama mantığı (kaynak)
│   ├── js/app.min.js           #    Üretim (minified)
│   └── css/style.css           #    Stil dosyası
│
├── android-app/                # ── Android Hibrit Uygulama ──
│   └── app/src/main/
│       ├── java/.../MainActivity.java
│       └── assets/             #    public/ kopyası
│
├── tools/                      # ── Geliştirme Araçları ──
│   ├── simulate_device.js      #    STM32 telemetri simülatörü
│   └── export-logs-to-csv.js   #    Log dışa aktarım
│
├── releases/                   # ── OTA Güncelleme ──
│   └── version.json            #    APK versiyon bilgisi
│
└── docs/                       #    Ek dokümantasyon
```

---

## 🚀 Kurulum

### Gereksinimler

- **Node.js** ≥ 16
- **MongoDB** (yerel veya Atlas)
- **Redis** (opsiyonel — performans önbelleği)

### 1. Klonla ve bağımlılıkları yükle

```bash
git clone https://github.com/alienes-akalin/telemetry-http.git
cd telemetry-http
npm install
```

### 2. Ortam değişkenlerini yapılandır

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/telemetry
JWT_SECRET=güçlü-rastgele-bir-anahtar-oluştur
PORT=3000
NODE_ENV=development
```

### 3. Sunucuyu başlat

```bash
# Geliştirme (izleme modu)
npm run dev

# Üretim
npm start
```

### 4. Simülatörle test et

```bash
npm run simulate
```

Tarayıcıda `http://localhost:3000` adresini aç — gerçek zamanlı veriler akmaya başlayacak.

---

## 🔌 API Referansı

### Kimlik Doğrulama

| Metot | Endpoint | Açıklama |
|:------|:---------|:---------|
| `POST` | `/api/auth/login` | JWT token al |
| `POST` | `/api/auth/logout` | Oturumu sonlandır |
| `POST` | `/api/auth/refresh-token` | Token yenile |

### Telemetri

| Metot | Endpoint | Açıklama | Auth |
|:------|:---------|:---------|:-----|
| `POST` | `/api/v1/telemetry/ingest` | STM32 veri alımı | API Key |
| `GET` | `/api/v1/telemetry/latest` | Son veriler | Opsiyonel |
| `GET` | `/api/v1/telemetry/:id` | Geçmiş veri sorgusu | JWT |
| `GET` | `/api/v1/telemetry/device/:device_id` | Araç bazlı veri | JWT |

### Oturum & Test

| Metot | Endpoint | Açıklama |
|:------|:---------|:---------|
| `GET` `POST` | `/api/v1/custom-sessions` | Oturum listele / oluştur |
| `GET` `DELETE` | `/api/v1/tests` | Test kayıtları |

### Dışa Aktarım

| Metot | Endpoint | Açıklama |
|:------|:---------|:---------|
| `GET` | `/api/export/csv` | CSV indirme (Excel uyumlu) |
| `GET` | `/api/export/json` | JSON veri indirme |

### Sağlık Kontrolü

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "uptime": "2h 15m 30s",
  "mongo": "connected",
  "redis": "connected"
}
```

---

## 📡 Telemetri Veri Şeması

STM32'den gelen her JSON paketi şu alanları içerir:

```json
{
  "device_id": "a1",
  "event_type": "telemetry",
  "uptime_sec": 1234,
  "bms": {
    "voltage_v": 48.6,
    "current_a": 12.3,
    "temp_c": 35.2,
    "soc_pct": 78,
    "energy_mwh": 45600
  },
  "motor": {
    "rpm": 3200,
    "speed_kph": 42.5,
    "duty_pct": 65
  },
  "gps": {
    "lat_deg": 36.9914,
    "lon_deg": 35.3308
  },
  "isolation": {
    "res_1_kohm": 500,
    "res_2_kohm": 480
  },
  "hydrogen": {
    "ppm": 12,
    "temp_c": 22.5,
    "flowmeter": 1.8
  }
}
```

---

## 🌡️ Sıcaklık Alarm Eşikleri

Dashboard, BMS sıcaklığına göre otomatik alarm durumu gösterir:

| Sıcaklık | Durum | Renk | Aksiyon |
|:---------|:------|:-----|:--------|
| `< 30°C` | ✅ Normal | 🟢 Yeşil | — |
| `≥ 30°C` | 🌀 Fan | 🟡 Sarı | Soğutma aktif |
| `≥ 50°C` | 🔊 Buzzer | 🟠 Turuncu | Sesli uyarı |
| `≥ 70°C` | ⚡ Kontaktör | 🔴 Kırmızı | Donanım kapatma |

---

## 📱 Android Uygulaması

Hibrit WebView uygulaması, dashboard'u native Android deneyimi olarak sunar.

**OTA Güncelleme Akışı:**
1. Uygulama başlatılırken `/api/v1/app/version` endpoint'ini kontrol eder
2. Yeni sürüm varsa kullanıcıya bildirim gösterir
3. APK doğrudan sunucudan indirilir ve kurulur

**Build:**
```
Android Studio → Build → Build APK(s)
```

> ⚠️ `public/` dosyalarında değişiklik yapıldığında `android-app/app/src/main/assets/` klasörünü güncellemeyi unutmayın.

---

## 🔧 Ortam Değişkenleri

| Değişken | Zorunlu | Varsayılan | Açıklama |
|:---------|:--------|:-----------|:---------|
| `PORT` | ❌ | `3000` | Sunucu portu |
| `NODE_ENV` | ❌ | `development` | Ortam modu |
| `MONGODB_URI` | ✅ | — | MongoDB bağlantı URI |
| `JWT_SECRET` | ✅ | — | Token imzalama anahtarı |
| `JWT_EXPIRES_IN` | ❌ | `7d` | Token geçerlilik süresi |
| `REDIS_URL` | ❌ | — | Redis sunucu adresi |
| `CORS_ORIGINS` | ❌ | `localhost:3000` | İzin verilen originler |
| `SOCKET_ORIGIN` | ❌ | `*` | Socket.io CORS |
| `DEVICE_API_KEY` | ❌ | — | STM32 cihaz doğrulama |
| `GOOGLE_SCRIPT_URL` | ❌ | — | Drive galeri entegrasyonu |

---

## 🔒 Güvenlik

- **Helmet** — HTTP güvenlik başlıkları (XSS, clickjacking koruması)
- **Rate Limiting** — API: 200 req/dk · İngest: 180 req/dk · Login: 15 deneme/15dk
- **NoSQL Sanitization** — `$` operatör enjeksiyon koruması
- **JWT** — Erişim kontrolü (admin / member / viewer rolleri)
- **bcrypt** — Şifre hashleme (10 round)
- **CORS** — Katı origin politikası (üretim modunda)

---

## 🛠️ Kullanılan Teknolojiler

<table>
  <tr>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" width="40" /><br/>
      <sub>Node.js</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg" width="40" /><br/>
      <sub>Express 5</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg" width="40" /><br/>
      <sub>MongoDB</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg" width="40" /><br/>
      <sub>Redis</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/socketio/socketio-original.svg" width="40" /><br/>
      <sub>Socket.io</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" width="40" /><br/>
      <sub>JavaScript</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" width="40" /><br/>
      <sub>HTML5</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg" width="40" /><br/>
      <sub>CSS3</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/android/android-original.svg" width="40" /><br/>
      <sub>Android</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nginx/nginx-original.svg" width="40" /><br/>
      <sub>Nginx</sub>
    </td>
    <td align="center" width="96">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" width="40" /><br/>
      <sub>React Native</sub>
    </td>
    <td align="center" width="96">
      <img src="https://upload.wikimedia.org/wikipedia/commons/e/e5/Leaflet_Logo.svg" width="40" /><br/>
      <sub>Leaflet</sub>
    </td>
  </tr>
</table>

---

## 🔗 İlişkili Projeler

| Proje | Açıklama |
|:------|:---------|
| **Telemetry_SIM800L** | STM32F407 firmware — CAN bus veri toplama + SIM800L HTTP gönderim |
| **Esp32_BMS** | ESP32 tabanlı BMS (Batarya Yönetim Sistemi) |
| **Esp32_Surucu** | ESP32 tabanlı motor sürücü kontrolü |
| **native-app/** | React Native mobil uygulama (Expo) |
| **android-app/** | Android hibrit uygulama (WebView) |

---

## 📝 Lisans

Bu proje **1.5 ADANA** takımı tarafından TÜBİTAK Efficiency Challenge yarışmaları için geliştirilmiştir.

---

<p align="center">
  <img src="public/img/header-iso.png" alt="Araç CAD Render" width="600" />
</p>

<p align="center">
  <sub>Made with ❤️ by <strong>1.5 ADANA</strong> — Adana, Türkiye</sub>
</p>
