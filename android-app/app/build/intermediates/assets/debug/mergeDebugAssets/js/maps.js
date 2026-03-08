// public/js/maps.js
// ============================================================
// LEAFLET HARİTA MODÜLÜ
// ============================================================
// GPS tabanlı harita görselleştirmesi ve konum takibi
// Ana dosyadan ayrıştırılmış modül (performans optimizasyonu)
// ============================================================

// Harita değişkenleri (global scope - app.js ile paylaşım için)
let mainMap, fullMap;                // Leaflet harita nesneleri
let mainMarker, fullMarker;          // Konum işaretçileri
let fullPath;                        // Rota çizgisi (polyline)
const defaultPos = [37.0560, 35.3560]; // Varsayılan konum (Adana - Çukurova Üni)
let isTrackingMode = true;           // Harita takip modu (true: konumu takip et)
let isMainTracking = true;           // Dashboard harita takip modu
let lastKnownPos = defaultPos;       // Son bilinen GPS konumu
let routeSegments = [];              // Hız bazlı rota renklendirme için segment dizisi
let mapInitialized = false;          // Harita initialize edildi mi?

// Google Maps tarzı mavi konum işaretçisi
const blueCircleIcon = L.divIcon({
    className: 'blue-dot-marker',
    html: '<div style="width:20px;height:20px;background:#4285f4;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

/**
 * Dashboard sayfasındaki küçük haritayı oluşturur
 * Canlı konum takibi için kullanılır
 */
function initMainMap() {
    // Leaflet harita oluştur
    mainMap = L.map('main-map').setView(defaultPos, 13);

    // Karanlık tema harita katmanı (CARTO)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM, &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(mainMap);

    // Konum işaretçisi ekle
    mainMarker = L.marker(defaultPos, { icon: blueCircleIcon }).addTo(mainMap);

    // Harita sürüklenince takip modunu kapat
    mainMap.on('dragstart', () => {
        isMainTracking = false;
        updateMainTrackingButton();
    });
}

/**
 * Dashboard haritasını yeni konumla günceller
 * @param {Object} data - GPS verisi içeren telemetri objesi
 */
function updateMainMap(data) {
    if (validateGPS(data)) {
        const pos = [data.gps.lat_deg, data.gps.lon_deg];
        mainMarker.setLatLng(pos);
        if (isMainTracking) {
            mainMap.panTo(pos);
        }
    }
}

/**
 * Dashboard haritası takip modunu değiştirir
 * Aktifse: Harita aracı takip eder
 * Pasifse: Kullanıcı haritayı serbestçe gezebilir
 */
function toggleMainTracking() {
    isMainTracking = !isMainTracking;
    updateMainTrackingButton();
    if (isMainTracking && mainMarker) {
        mainMap.panTo(mainMarker.getLatLng());
    }
}

/**
 * Dashboard harita takip butonunun görünümünü günceller
 */
function updateMainTrackingButton() {
    const btn = document.getElementById('btn-main-recenter');
    if (isMainTracking) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-location-pin"></i>';
    }
}

/**
 * Harita sayfasındaki büyük detaylı haritayı oluşturur
 * Rota çizimi ve hız bazlı renklendirme içerir
 */
function initFullMap() {
    // Zaten oluşturulmuşsa sadece boyutu yenile
    if (mapInitialized) {
        fullMap.invalidateSize();
        return;
    }

    fullMap = L.map('full-map').setView(defaultPos, 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM, &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(fullMap);

    // Konum işaretçisi ve rota çizgisi
    fullMarker = L.marker(defaultPos, { icon: blueCircleIcon }).addTo(fullMap);
    fullPath = L.polyline([], { color: '#4285f4', weight: 4 }).addTo(fullMap);

    // Harita sürüklenince serbest gezme moduna geç
    fullMap.on('dragstart', () => {
        isTrackingMode = false;
        updateTrackingButton();
    });

    mapInitialized = true;
}

/**
 * Detaylı haritayı günceller ve rota çizer
 * Hız değerine göre farklı renklerde çizgi segmentleri oluşturur
 * @param {Object} data - Telemetri verisi
 */
function updateFullMap(data) {
    if (validateGPS(data)) {
        const pos = [data.gps.lat_deg, data.gps.lon_deg];
        const speed = data.motor?.speed_kph || 0;

        lastKnownPos = pos;
        fullMarker.setLatLng(pos);

        // Takip modundayken haritayı kaydır
        if (isTrackingMode) {
            fullMap.panTo(pos);
        }

        // Hız bazlı renkli rota çiz
        if (routeSegments.length > 0) {
            const lastPos = routeSegments[routeSegments.length - 1].latlng;
            const color = getSpeedColor(speed);
            L.polyline([lastPos, pos], { color: color, weight: 4, opacity: 0.8 }).addTo(fullMap);
        }

        routeSegments.push({ latlng: pos, speed: speed });
    }
}

/**
 * Harita takip modunu aktifleştirir ve son konuma gider
 */
function toggleTrackingMode() {
    isTrackingMode = true;
    if (fullMap && lastKnownPos) {
        fullMap.panTo(lastKnownPos);
    }
    updateTrackingButton();
}

/**
 * Detaylı harita takip butonunun görünümünü günceller
 */
function updateTrackingButton() {
    const btn = document.getElementById('btn-recenter');
    if (btn) {
        if (isTrackingMode) {
            btn.classList.add('active');
            btn.title = 'Konum Takip Aktif';
        } else {
            btn.classList.remove('active');
            btn.title = 'Konuma Git';
        }
    }
}

/**
 * Hız değerine göre renk döndürür
 * @param {number} speed - Hız (km/h)
 * @returns {string} - CSS renk kodu
 */
function getSpeedColor(speed) {
    if (speed < 20) return '#10b981';  // Yeşil (yavaş)
    if (speed < 50) return '#f59e0b';  // Sarı/Turuncu (orta)
    return '#ef4444';                   // Kırmızı (hızlı)
}

/**
 * GPS verisinin geçerli olup olmadığını kontrol eder
 * @param {Object} data - Telemetri verisi
 * @returns {boolean} - GPS verisi geçerli mi?
 */
function validateGPS(data) {
    if (!data.gps) return false;
    const lat = data.gps.lat_deg;
    const lon = data.gps.lon_deg;

    // Sayısal değer, NaN değil ve 0 değil kontrolü
    return typeof lat === 'number' && !isNaN(lat) && lat !== 0 &&
        typeof lon === 'number' && !isNaN(lon) && lon !== 0;
}
