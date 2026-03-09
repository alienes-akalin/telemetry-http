# Copilot Talimatları - Telemetry HTTP Kod Tabanı

## Proje Özeti
**1.5 ADANA Telemetri Sistemi**, üç veri kaynağına sahip gerçek zamanlı elektrikli araç telemetri platformudur:
1. **STM32 MCU (Telemetry_SIM800L)**: CAN bus verilerini (BMS, motor, GPS, sensörler) toplar, SIM800L hücresel modülü ile gönderir
2. **Node.js Backend (src/)**: Gerçek zamanlı WebSocket yayını için HTTP API + Socket.io sunucusu
3. **Çok Platform İstemcileri**: Web dashboard (public/), React Native native-app, Android hibrit uygulama

## Kritik Veri Akışı
```
STM32 [CAN Bus] → JSON HTTP POST (2sn aralık) → Express.js sunucu
  ↓ [Socket.io yayını bağlı istemcilere]
Web/Mobil istemciler [gerçek zamanlı alım] → grafikleri, haritaları, alarmları günceller
  ↓ [asenkron]
MongoDB [tüm kayıtları kalıcı hale getirir] ← device_id, ts_server ile indekslenir
```

## Temel Mimari Kalıpları

### 1. Telemetri Veri Şeması
**Konum**: `src/models/telemetry.js`

Şema doğrudan STM32 firmware'ine (`Core/Inc/telemetry.h`) eşlenir:
- **BMS**: voltage_v, current_a, temp_c, soc_pct, energy_mwh
- **Motor**: rpm, speed_kph (tekerlek çevresinden hesaplanır), duty_pct  
- **GPS**: lat_deg, lon_deg
- **Sensörler**: iso (izolasyon direnci), hydrogen (H2 konsantrasyonu, ppm)

⚠️ **Kritik**: Veriye kalıcı hale getirmeden önce her zaman device_id doğrulaması yapın. Device_id, STM32 yapılandırmasıyla (DEVICE_ID="arac-01") eşleşmelidir.

### 2. Socket.io Yayın Kalıbı
**Konum**: `src/routes/telemetry.js`, `src/server.js`

POST `/api/v1/telemetry/ingest` veri aldığında:
1. MongoDB'ye kaydet
2. TÜM bağlı istemcilere anında `io.emit('telemetry', {...})` yayını yap
3. İstemciler `public/js/app.js` içinde dinler - çapraz cihaz karışıklığını önlemek için device_id filtresini kontrol et

Telemetri yayınları için asla `io.to()` oda filtreleme kullanmayın—sistem gerçek zamanlı verileri herkese açık olarak ele alır, ancak JWT kimlik doğrulaması API erişimini kontrol eder.

### 3. Sıcaklık Alarm Sistemi (Sabit Kodlanmış Eşikler)
**Konum**: `public/js/app.js` içinde `updateDashboardWidgets()` fonksiyonu

```
temp >= 70°C → KONTAKTÖR (kırmızı)   // Donanım kapatma tetikleyicisi
temp >= 50°C → BUZZER (turuncu)      // Ses alarmı
temp >= 30°C → FAN (sarı)            // Soğutma aktivasyonu
temp < 30°C  → NORMAL (yeşil)
```

Bunlar veritabanı tabanlı değildir; eşiklerin ayarlanması gerekiyorsa `updateDashboardWidgets()` fonksiyonunu değiştirin. Dashboard kartları CSS class enjeksiyonu kullanır (.temp-critical, .temp-buzzer, .temp-fan).

### 4. Kimlik Doğrulama ve Yetkilendirme
**Konum**: `src/routes/auth.js`, `src/middleware/auth.js`

- Giriş sırasında JWT token'ları veriliyor
- Rotalar `authMiddleware` ile korunuyor (tüm `/api/v1/*` rotalarını kontrol et)
- Herkese açık erişim: `/health`, statik dosyalar (public/), giriş endpoint'i
- **Telemetri alım endpoint'i için**: Şu anda **kimlik doğrulama gerekmiyor** (API `/api/v1/telemetry/ingest` STM32 POST için açık)
- Telemetri POST'a kimlik doğrulama eklenirse, STM32 firmware başlıklarını güncelleyin (gömülü sistemde kolay değil—dikkatli kullanın)

## Temel Komutlar ve Build Adımları

### Backend (Node.js)
```bash
npm install                    # Bağımlılıkları yükle (mongoose, socket.io, express, bcrypt, jwt)
npm run dev                    # İzleme modu (geliştirme için tercih edilen)
npm start                      # Üretim modu
npm run build                  # public/js/app.js → public/js/app.min.js minifiye et (üretim için)
node tools/simulate_device.js  # Test için STM32 telemetri simülasyonu
```

### Native App (React Native Expo)
```bash
cd native-app
npm install
npm start                      # Expo geliştirme sunucusu
npm run android               # Android emülatör/cihazına dağıt
npm run ios                   # iOS'a dağıt (sadece macOS)
```

### Android Hibrit Uygulama
- Gradle tabanlı; `android-app/` klasörünü Android Studio'da aç
- **Önemli tuzak**: public/ güncelle → değişiklikleri görmek için aşağıdaki komutu çalıştır, ardından Android Studio'da yeniden build yap

## ⚠️ Zorunlu Android Build Pipeline — Her public/ Değişikliğinde Uygula

`public/js/app.js` veya herhangi bir `public/` dosyası (CSS, HTML, SW, resim vb.) değiştirildiğinde
şu adımlar **sırasıyla** uygulanmalıdır. Aksi takdirde Android uygulaması eski kodu çalıştırır.

### Adım 1 — app.js'i minifiye et
```bash
npx terser public/js/app.js -o public/js/app.min.js -c -m
```

### Adım 2 — Cache versiyonunu artır (sw.js + index.html)
`public/sw.js` içindeki `CACHE_NAME = 'telemetri-vN'` ve
`public/index.html` içindeki `?v=N` query string'lerini aynı anda bir artır.

### Adım 3 — public/ → Android assets/ senkronizasyonu
```powershell
# Telemetry-http proje kökünden çalıştır
Copy-Item -Path "public\*" -Destination "android-app\app\src\main\assets\" -Recurse -Force
```
Bu komut tüm dosyaları (HTML, JS, CSS, img, sw.js, manifest.json) assets'e kopyalar.

### Adım 4 — Android Studio'da Build APK yap
Android Studio → **Build → Build Bundle(s) / APK(s) → Build APK(s)**

> **AI için not**: Kullanıcı `public/js/app.js`, `public/css/style.css`, `public/index.html`
> veya başka bir `public/` dosyasında değişiklik yaptığında yukarıdaki 3 adımı otomatik olarak uygula.
> Kullanıcı hatırlatmak zorunda kalmamalı.

### STM32 Firmware
- **IDE**: STM32CubeIDE gerekli (VS Code değil)
- **STM32F407VGTx** (ARM Cortex-M4) kullanır
- Ana modüller: `sim800l_tcp.c` (hücresel), `can_handler.c` (CAN bus), `telemetry.c` (JSON formatlama)
- Derleme hedefi: JTAG/OpenOCD ile flash edilen binary

## Projeye Özel Konvansiyonlar

### 1. Hata Yönetim Kalıpları
- **Backend**: Tüm loglar için Winston logger `src/logger.js` kullan, düz console.log kullanmaktan kaçın
- **Frontend**: Socket.io bağlantı kopmaları → "Bağlantı koptu" banner göster (örnek için public/js/app.js kontrol et)
- **STM32**: Sınırlı loglama—UART2 debug çıktısı kullan (HAL_UART_Transmit ile printf)

### 2. Dosya İsimlendirme ve Organizasyon
- Rotalar REST fiilleri kullanır: `GET /telemetry/:id`, `POST /telemetry/ingest`, `PUT /customSessions/:id`
- Middleware `src/middleware/` klasöründe organize edilir
- Modeller Mongoose şemalarını yansıtır `src/models/`
- STM32 firmware `API_ENDPOINT` tanımını güncellemeden ana API yollarını asla değiştirmeyin

### 3. Yapılandırma
- **Ortam Değişkenleri** `.env.example`:
  - `MONGODB_URI` - kalıcılık için gerekli
  - `JWT_SECRET` - kimlik doğrulama için gerekli
  - `REDIS_URL` - isteğe bağlı, oturum önbelleği için `initRedis()` tarafından kullanılır
  - `NODE_ENV` - "development" veya "production" (sıkıştırma, log ayrıntı seviyesini etkiler)

## Entegrasyon Noktaları ve Bağımlılıklar

### Dış Servisler
1. **MongoDB Atlas / Local** - Kalıcı veri depolama (gerekli)
2. **Redis** - İsteğe bağlı oturum önbelleği; tanımlanmamışsa kimlik doğrulama yine de çalışır
3. **SIM800L Modülü** - STM32'den 2 saniye aralıklarla HTTP POST gönderir
4. **Socket.io** - WebSocket sunucusu (varsayılan port 3000)

### Bileşenler Arası İletişim
- **STM32 → Backend**: JSON gövdeli ham HTTP POST (Content-Type: application/json)
- **Backend ↔ Web İstemci**: Socket.io olayları (telemetry, auth, status)
- **Backend → Mobil**: Aynı Socket.io olayları; `native-app/` içinde React Native istemci

## Yaygın AI Görevleri ve Rehberlik

### Yeni Sensör Ekleme
1. STM32 `TelemetryData_t` struct'ına ekle (Telemetry_SIM800L/Core/Inc/telemetry.h)
2. MongoDB şemasını `src/models/telemetry.js` içinde güncelle
3. Frontend grafik render'ını `public/js/app.js` içinde güncelle
4. Her üç istemciyi de güncelle (web, React Native, Android hibrit)

### Telemetri Kaybı Hata Ayıklama
1. STM32 UART debug çıktısını kontrol et (main.c içindeki printf ifadeleri)
2. Ağ bağlantısını kontrol et (sim800l.c içindeki SIM800L AT komutları)
3. MongoDB bağlantısını doğrula `src/config/db.js`
4. Socket.io istemci bağlantılarını kontrol et (`io.engine.clientsCount`)
5. `logs/` dizinindeki Winston loglarını gözden geçir

### Alarm Eşiklerini Değiştirme
- **Frontend'de sabit kodlanmış**: `public/js/app.js` → `updateDashboardWidgets()` fonksiyonunu düzenle
- **Seçenek**: Runtime ayarlaması için veritabanı config tablosuna taşı (PROJECT_PERSPECTIVES.md içinde gelecek geliştirme)

## OTA Güncelleme Yayınlama Otomasyonu

> **AI için zorunlu kural**: Kullanıcı aşağıdaki ifadelerden herhangi birini kullandığında
> bu kuralı uygula (birebir eşleşme gerekmez, anlam yeterlir):
> - "uygulamayı güncelle", "uygulama versiyonunu güncelle", "versiyon X.X çıkar",
>   "yeni sürüm çıkar", "güncelleme çıkar" vb.

### AI'nın otomatik yapacakları:

1. `releases/version.json` dosyasından mevcut `versionCode` ve `versionName`'i oku
2. `versionCode`'u +1 artır, `versionName`'i bir üst patch'e çıkar (1.3 → 1.4)
   - Kullanıcı farklı bir numara belirttiyse onu kullan
3. Aşağıdaki iki dosyayı güncelle:

**`android-app/app/build.gradle`**
```gradle
versionCode <yeni_numara>
versionName "<yeni_versiyon>"
```

**`releases/version.json`**
```json
{
  "versionCode": <yeni_numara>,
  "versionName": "<yeni_versiyon>",
  "releaseNotes": "<kullanıcının belirttiği değişiklikler, yoksa boş bırak>",
  "apkFileName": "telemetri-v<yeni_versiyon>.apk",
  "minAndroidSdk": 24,
  "forceUpdate": false,
  "apkSizeMb": null
}
```

4. İşlem sonunda kullanıcıya şu hatırlatmayı yap:
   > "✅ Versiyon güncellendi. Sıradaki adımlar:
   > 1. Android Studio → Build APK
   > 2. Sunucuya **iki dosya** yükle:
   >    - APK → `/root/telemetry-http/releases/telemetri-v<yeni_versiyon>.apk`
   >    - version.json → `/root/telemetry-http/releases/version.json`"

Kullanıcının yapacakları (sadece bunlar):
1. Android Studio → Build APK
2. APK + version.json dosyalarını sunucuya yükle

## Test Kalıpları
- Henüz formal test paketi yok; `node tools/simulate_device.js` ile simülasyon yap
- Manuel E2E: Backend başlat → web dashboard aç → simülatör çalıştır → gerçek zamanlı güncellemeleri gözle
- Sağlık endpoint'ini kontrol et: `curl http://localhost:3000/health` (uptime, Redis durumu gösterir)

## GitHub Repo Güncelleme Kuralları

> **AI için zorunlu kural**: `telemetry-http` projesinde **herhangi bir dosyada değişiklik yapıldığında**
> (kod, yapılandırma, belge fark etmeksizin) aşağıdaki pipeline otomatik çalıştırılmalıdır.
> Kullanıcı hatırlatmak zorunda kalmamalı.

### Değişiklik Sonrası Otomatik GitHub Pipeline

1. **Eğer `public/` altında değişiklik varsa** — önce Android pipeline uygula:
   ```powershell
   npx terser public/js/app.js -o public/js/app.min.js -c -m
   # sw.js CACHE_NAME ve index.html ?v= değerlerini +1 artır
   Copy-Item -Path "public\*" -Destination "android-app\app\src\main\assets\" -Recurse -Force
   ```

2. **Her değişiklikten sonra** — commit ve push:
   ```powershell
   git add .
   git commit -m "<değişikliği özetleyen anlamlı mesaj>"
   git push
   ```

3. **Commit mesajı formatı** (conventional commits):
   - `feat:` yeni özellik
   - `fix:` hata düzeltme
   - `chore:` yapılandırma/temizlik
   - `docs:` sadece belge değişikliği

### Gizli Bilgi Güvenliği — GitHub'a Asla Yüklenmeye**cek**ler

> **AI için zorunlu kural**: Kod yazarken veya dosya düzenlerken aşağıdaki bilgileri
> **asla** doğrudan kaynak koduna sabit değer (hardcode) olarak yazma.
> Bunların `.gitignore` tarafından korunduğundan her zaman emin ol.

| Kategori | Örnekler | Doğru Yaklaşım |
|---|---|---|
| Şifreler | Kullanıcı şifreleri, admin şifreleri | `process.env.SEED_*` değişkenlerinden oku |
| JWT Secret | 64 karakterlik hex key | `.env` dosyasında `JWT_SECRET` değişkeni |
| API Key'leri | `DEVICE_API_KEY`, `GOOGLE_SCRIPT_URL` | `.env` dosyasında sakla |
| Veritabanı URI | MongoDB bağlantı stringi | `.env` dosyasında `MONGODB_URI` |
| Sunucu şifreleri | SSH key, SSL sertifikası | Asla repoya ekleme |

**`.gitignore` koruması altındaki dosyalar** (bu dosyalara asla kaynak kod yazma):
- `.env`
- `.env.production`
- `.env.local`
- `.env.*.local`

**Yeni gizli değer gerektiğinde yapılacaklar:**
1. Değeri `.env` ve `.env.production` dosyalarına ekle (yerel/sunucu)
2. Placeholder'ı `.env.example` dosyasına ekle (GitHub'a gider)
3. Kodda `process.env.DEĞIŞKEN_ADI` ile oku
4. Middleware'lerdeki import formatını kontrol et: `const { authenticateToken } = require('../middleware/auth')`

## FOC Geliştirme Ortamı — Teşhis Kuralları

Bu bölüm `FOC_B (2)/` projesindeki STM32 FOC algoritması geliştirme sürecine ait bilinen durumları ve teşhis kurallarını içerir.

### FOC Telemetri Pipeline
```
STM32 USART3 (PB10, 921600 baud) → COM8 → foc_uart_bridge.py → tools/foc_data.json
  → foc_dashboard_server.py (port 5000) → VS Code Simple Browser
```
- **Bridge**: `tools/foc_uart_bridge.py` — 18 frame'de bir JSON yazar (~5Hz), atomic write
- **Dashboard**: `tools/foc_dashboard_server.py` — 1s polling, tablo + CSV export, port 5000

### Bilinen Durumlar ve Teşhis Tablosu

| Gözlem | Anlam | Yapılacak |
|---|---|---|
| **Vq ≈ 29.09V sabit** | Batarya bağlantısı koruma amacıyla kesilmiş. VDC=50.4V sabit kodlu olduğundan PI limiti = 50.4/√3 = 29.1V'dir. Motor güç almadığından Iq_measured=0 → PI integrali bu limite dolar ve sabit kalır. | Batarya bağlantısını geri al. Pot tam sıfırda değilse önce potu sıfıra çek → Vq düşer. |
| theta_e sabit, omega_e = 0 | Motor dönmüyor (pot sıfırda veya encoder stuck) | Pot'u kontrol et |
| Id = Iq = 0.0A | ADC okuması sıfır; güç yok veya akım sensörü offset hatası | Batarya bağlantısını ve offset kalibrasyonunu kontrol et |
| dc_a/dc_b/dc_c sabit, asimetrik | PI bir sektörde kilitli; rotor hareket etmiyor | Pot'u sıfıra çek, PI reset gerçekleşir |
| Tiz ses (yüksek frekanslı gürültü) | Sabit asimetrik PWM; motordan sabit yönde akım geçiyor | Pot'u sıfıra çek veya batarya bağlantısını kes |
| ADC_LPF_ALPHA < 0.4 | Kesim frekansı çok düşük → PI kazanımları dengesizleşir → ses + hareket yok | 0.574f'e geri al |

### Kritik Sabitler (FOC_B firmware)
- **VDC = 50.4f** — sabit kodlu; `foc_protection.h`
- **Vs_max = VDC/√3 ≈ 29.10V** — PI çıkış üst limiti (Id ve Iq PI için)
- **ADC_LPF_ALPHA = 0.574f** — fc ≈ 2kHz, fs = 9.33kHz; güvenli alt sınır ~0.45f
- **I_PEAK = 14.0f A** — anlık akım sınırı
- **ALIGN_ID = 3.0f A**, **ALIGN_TICKS = 5600** (~600ms) — hizalama parametreleri

### Vq = 29.09V Özel Kuralı
> **AI için zorunlu kural**: Kullanıcı FOC verilerini paylaşırken veya analiz isterken
> dashboardda `Vq ≈ 29.09V` (veya 29.1V) **sabit** görülüyorsa, her zaman şu yorumu yap:
> "Vq = VDC/√3 limitine takılmış → batarya sürücü bağlantısı koruma nedeniyle kesilmiş.
> STM32 logic çalışıyor ama motor güç almıyor. Normal durum."
> Bu bir hata veya yazılım sorunu **değildir**.

### FOC Deneme Sonrası Veri İnceleme Kuralı
> **AI için zorunlu kural**: Kullanıcı herhangi bir FOC değişikliğinden sonra
> "denedim", "sonuç şu oldu", "motor şöyle davrandı" gibi bir geri bildirim verdikten sonra
> **HER ZAMAN** şu adımları uygula — kullanıcı hatırlatmak zorunda kalmamalı:
>
> 1. `Get-Content "…/tools/foc_data.json" -Raw` komutuyla JSON'ı oku
> 2. **En son oturumdan** (en yüksek `session_id`) başlayarak `history_last_20` verilerini analiz et
> 3. Şu metrikleri kontrol et: `theta_e` (sabit mi?), `omega_e` (dönüyor mu?),
>    `Id`/`Iq` (ölçülüyor mu?), `Vq` (PI windup var mı?), `pot` (referans doğru mu?)
> 4. Ardından teşhis yaz, öneri sun

### Id = Iq = 0 Ama Motor Çalışıyor Durumu
| Semptom | Anlam |
|---|---|
| Id=Iq=0 sürekli, Vq≠0, theta_e değişiyor | ADC akım ölçümü sıfır → PI açık döngü gibi çalışıyor |
| Motor başlangıçta döndü, sonra durdu | Alignment akımı çalıştı (PI sature → açık döngü), sonra Iq yetersiz kaldı |
| Pot artırınca 5A çekti + tiz ses | Iq_ref büyüdü → Iq_measured=0 → PI anında 29.1V'e doydu → kilitli rotor |
| theta_e = sabit değer (0 değil) | Encoder çalıştı, motor döndü, durdu; encoder reset sonrası bu açıda kaldı |

---

**Son Güncelleme**: 3 Mart 2026 | **Versiyon**: 2.2
