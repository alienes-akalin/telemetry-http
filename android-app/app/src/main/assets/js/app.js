// public/js/app.js
// ============================================================
// 1.5 ADANA ELEKTROMOBİL TELEMETRİ - ANA UYGULAMA DOSYASI
// ============================================================
// Bu dosya web arayüzünün tüm işlevselliğini sağlar:
// - Socket.io ile gerçek zamanlı veri alımı
// - Dashboard widget'larının güncellenmesi
// - Harita görselleştirmesi (Leaflet)
// - Grafik çizimi (Chart.js)
// - Kronometre işlevleri
// - Oturum/paket yönetimi
// - Medya galerisi
// ============================================================

// ==================== SOCKET.IO YAPILANDIRMASI ====================

// ==================== TEMA YÖNETİMİ ====================
// Light/Dark mode toggle — tercih localStorage'da saklanır
function toggleTheme() {
    const body = document.body;
    const isLight = body.classList.toggle('light-mode');
    body.classList.toggle('dark-mode', !isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');

    // Toggle buton ikonunu güncelle
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = isLight
            ? '<i class="fa-solid fa-moon"></i>'
            : '<i class="fa-solid fa-sun"></i>';
    }

    // Chart.js renkleri güncelle
    updateChartTheme(isLight);
}

function updateChartTheme(isLight) {
    const textColor = isLight ? '#475569' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0,0,0,0.08)' : '#334155';
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    // Mevcut chart'ları güncelle
    [speedChart, energyChart, tempChart, socChart, isoChart].forEach(chart => {
        if (!chart) return;
        if (chart.options.scales) {
            Object.values(chart.options.scales).forEach(scale => {
                if (scale.ticks) scale.ticks.color = textColor;
                if (scale.grid) scale.grid.color = gridColor;
                if (scale.title) scale.title.color = scale.title.text ? scale.title.color : textColor;
            });
        }
        chart.update('none');
    });
}

function applyStoredTheme() {
    const stored = localStorage.getItem('theme') || 'dark';
    const body = document.body;
    const isLight = stored === 'light';
    body.classList.toggle('light-mode', isLight);
    body.classList.toggle('dark-mode', !isLight);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = isLight
            ? '<i class="fa-solid fa-moon"></i>'
            : '<i class="fa-solid fa-sun"></i>';
    }
}

// ==================== SOCKET.IO YAPILANDIRMASI ====================
// Socket.io istemci bağlantısı
// Local dosyadan çalışınca (Android) bile sunucuya bağlansın
const SOCKET_URL = (window.location.protocol === 'file:')
    ? 'https://telemetry-aliakalin.com.tr'
    : undefined;

const socket = io(SOCKET_URL, {
    reconnection: true,              // Bağlantı kopunca otomatik yeniden bağlan
    reconnectionAttempts: Infinity,  // Sonsuz deneme
    reconnectionDelay: 1000,         // İlk deneme gecikmesi (ms)
    reconnectionDelayMax: 5000,      // Maksimum gecikme (ms)
    timeout: 10000                   // Bağlantı zaman aşımı (ms)
});

// Aktif cihaz ID'si — araç seçimine göre dinamik değişir
let currentDeviceId = 'a1';

const API_BASE = (window.location.protocol === 'file:')
    ? 'https://telemetry-aliakalin.com.tr'
    : ''; // Web sitesinde relative path kullan

// Araç konfigürasyonu
const VEHICLE_CONFIG = {
    'a1': { name: 'Hidromobil', hasIso: true, hasH2: true, color: '#a855f7' },
    'a2': { name: 'Shell', hasIso: false, hasH2: false, color: '#3b82f6' }
};

// Cihaz ID alias'ları (socket filter için)
const DEVICE_ID_ALIASES = { 'a1': ['a1', 'arac-01'], 'a2': ['a2', 'arac-02'] };
function resolveSocketIds(deviceId) {
    return DEVICE_ID_ALIASES[deviceId] || [deviceId];
}

// Araç değiştirme fonksiyonu — dropdown'dan tetiklenir
function switchVehicle(newDeviceId) {
    if (newDeviceId === currentDeviceId) return;

    // Dropdown animasyonu
    const select = document.getElementById('device-select');
    if (select) {
        select.classList.add('switching');
        setTimeout(() => select.classList.remove('switching'), 600);
    }

    // Eski cihazı unsubscribe, yeni cihaza subscribe
    socket.emit('unsubscribe', currentDeviceId);
    currentDeviceId = newDeviceId;
    socket.emit('subscribe', currentDeviceId);

    // ==================== DASHBOARD SIFIRLA ====================
    ['val-speed', 'val-rpm', 'val-duty', 'val-soc', 'val-voltage', 'val-temp',
        'val-current', 'val-energy', 'val-iso-pos', 'val-iso-neg', 'val-h2', 'val-h2-temp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = '0';
        });
    document.getElementById('val-last-update').innerText = '-';

    // Yarış modu değerlerini sıfırla
    ['race-speed', 'race-voltage', 'race-current', 'race-temp', 'race-duty'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '0';
    });
    const dutyFill = document.getElementById('race-duty-fill');
    if (dutyFill) {
        dutyFill.style.transition = 'none';
        if (window.matchMedia('(max-width: 767px) and (orientation: landscape)').matches) {
            dutyFill.style.width = '100%';
            dutyFill.style.height = '0%';
        } else {
            dutyFill.style.height = '100%';
            dutyFill.style.width = '0%';
        }
    }

    // Alarm durumlarını sıfırla
    const tempCard = document.getElementById('temp-card');
    if (tempCard) {
        tempCard.classList.remove('temp-fan', 'temp-buzzer', 'temp-critical');
        tempCard.classList.add('temp-normal');
    }
    const badge = document.getElementById('temp-warning-badge');
    if (badge) badge.style.display = 'none';
    const currentCard = document.getElementById('current-card');
    if (currentCard) currentCard.classList.remove('current-warning');

    // Global alarm + zaman state sıfırla
    lastTempState = null;
    lastCurrentWarning = null;
    lastDataTime = null;
    lastDataActive = null;   // Araç değişti → bildirim geçmişini temizle

    // Progress bar'ları sıfırla
    ['bar-speed', 'bar-current', 'bar-voltage', 'bar-temp', 'bar-soc'].forEach(id => {
        updateBar(id, 0);
    });

    // ==================== GRAFİKLERİ SIFIRLA ====================
    if (chartsInitialized) {
        [speedChart, energyChart, tempChart, socChart, isoChart].forEach(chart => {
            if (!chart) return;
            chart.data.labels = [];
            chart.data.datasets.forEach(ds => { ds.data = []; });
            chart.update('none');
        });
    }

    // ==================== HARİTALARI SIFIRLA ====================
    // Dashboard küçük haritası — marker'a başlangıç konumuna dön
    if (mainMarker) {
        mainMarker.setLatLng(defaultPos);
        mainMap.setView(defaultPos, 13);
        isMainTracking = true;
        updateMainTrackingButton();
    }

    // Detaylı harita — tüm renkli rota segmentlerini kaldır
    if (mapInitialized && fullMap) {
        routePolylines.forEach(p => { try { fullMap.removeLayer(p); } catch(e) {} });
        routePolylines = [];
        routeSegments = [];
        if (fullPath) fullPath.setLatLngs([]);
        fullMarker.setLatLng(defaultPos);
        fullMap.setView(defaultPos, 14);
        isTrackingMode = true;
        updateTrackingButton();
    }
    lastKnownPos = defaultPos;

    // ==================== STRATEJİ SIFIRLA ====================
    // Dinamik hesaplar sıfırlanır, kullanıcının girdiği ayarlar (tur sayısı vb.) korunur
    raceStrategy.totalConsumedWh = 0;
    raceStrategy.avgConsumptionWhKm = 0;

    // Araç config'e göre widget göster/gizle
    const cfg = VEHICLE_CONFIG[newDeviceId] || { hasIso: false, hasH2: false };
    ['row-iso-pos', 'row-iso-neg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = cfg.hasIso ? '' : 'none';
    });
    ['row-h2', 'row-h2-temp'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = cfg.hasH2 ? '' : 'none';
    });

    // Grafik sekmesindeki izolasyon grafiğini gizle/göster (ID veya querySelector ile)
    const isoWrapper = document.getElementById('chart-iso-wrapper') ||
        document.querySelector('[data-chart="iso"]');
    if (isoWrapper) isoWrapper.style.display = cfg.hasIso ? '' : 'none';

    // Araç rengini selector'a yansıt
    if (select && cfg.color) {
        select.style.borderColor = cfg.color;
        select.style.boxShadow = `0 0 10px ${cfg.color}55`;
    }

    // Geçmiş sekmesini yenile
    if (currentView === 'history') {
        switchSessionTab(activeSessionTab || 'system');
    }

    // En son veriyi yeni araç için çek
    fetchLatestData();

    console.log(`🚗 Araç değiştirildi: ${newDeviceId}`, cfg);
}

// ==================== DURUM DEĞİŞKENLERİ ====================
let currentView = 'dashboard';       // Aktif sayfa (dashboard, race, charts, map, history, media)
let chartsInitialized = false;       // Grafikler oluşturuldu mu?
let mapInitialized = false;          // Detaylı harita oluşturuldu mu?
let isMainTracking = true;           // Dashboard haritası konum takip modu
let currentSessionId = null;         // Görüntülenen oturum/paket ID'si
let currentSessionData = [];         // Oturum verileri (CSV export için)
let currentViewType = null;          // Detay görünümünün tipi: 'session' | 'custom' | 'test'
let currentTestId = null;            // Açık testin ID'si (açıklama kaydetmek için)
let lastDataTime = null;             // Son veri alındığı zaman (test butonu için)
let currentUserRole = null;          // Kullanıcı rolü (admin/member)
let currentUsername = null;          // Kullanıcı adı (şaka panelı için)

// ==================== BİLDİRİM SİSTEMİ DEĞİŞKENLERİ ====================
let lastTempState = null;              // Son sıcaklık durumu — null: sayfa yeni yüklendi (bildirim atma)
let lastCurrentWarning = null;        // Son akım uyarı durumu — null: sayfa yeni yüklendi (bildirim atma)
const CURRENT_THRESHOLD = 30;         // Akım eşik değeri (A)
let lastDataActive = null;            // Seçili araçta veri akışının son bilinen durumu (null=henüz bilinmiyor, true/false)

// Toast bildirim gösterir
function showNotification(title, message, type = 'warning', icon = 'fa-triangle-exclamation') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `notification-toast ${type}`;
    toast.innerHTML = `
        <div class="notif-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="notif-content">
            <div class="notif-title">${title}</div>
            <div class="notif-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Tıklayınca kapat
    toast.addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    });

    // 5 saniye sonra otomatik kapat
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);

    // Android WebView'da push notification tetikle
    if (window.AndroidNotification) {
        window.AndroidNotification.showNotification(title, message);
    }
}

// ==================== ŞAKA BİLDİRİM FONKSİYONLARI (alienes.akalin) ====================

// Emoji ızgarasını oluşturur — sadece owner panelinde kullanılır
function renderPrankEmojiGrid() {
    const grid = document.getElementById('prank-emoji-grid');
    if (!grid || grid.children.length > 0) return;  // Zaten doldurulduysa atla

    const emojis = [
        // Tehlike & Uyarı
        '⚠️','🚨','🔥','💀','⛔','🛑','💥','⚡','☢️','☠️','🆘','🚒',
        // Araç & Teknik
        '🌡️','🔋','🛞','🏎️','⚙️','🔌','💡','🧲','🔧','🛠️','📡','🖥️',
        // Ses & Bildirim
        '🔔','📢','📣','🔕','🎺','📻','🔊','🔇','📳','📴','🔑','🚪',
        // Duygu & Reaksiyon
        '🤯','😱','😈','😤','🤬','😨','🥶','🤡','👻','🎃','💀','🤙',
        // Silah & Patlama
        '🧨','💣','🔫','🪃','🗡️','⚔️','🛡️','💢','💫','✨','🌪️','❄️',
        // Eğlence
        '🎉','🎊','🎭','🏆','👑','🎯','🎲','🎮','🕹️','🎬','🎤','🪗'
    ];

    emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.textContent = emoji;
        btn.title = emoji;
        btn.style.cssText = 'font-size:1.5rem; background:none; border:1px solid transparent; border-radius:6px; cursor:pointer; padding:4px 6px; transition:all 0.15s;';
        btn.onmouseenter = () => btn.style.borderColor = '#f59e0b';
        btn.onmouseleave = () => { if (btn.dataset.selected !== '1') btn.style.borderColor = 'transparent'; };
        btn.onclick = () => {
            // Seçimi güncelle
            grid.querySelectorAll('button').forEach(b => { b.style.borderColor = 'transparent'; b.style.background = 'none'; b.dataset.selected = '0'; });
            btn.style.borderColor = '#f59e0b';
            btn.style.background = '#1e1b0e';
            btn.dataset.selected = '1';
            document.getElementById('prank-selected-emoji').textContent = emoji;
        };
        grid.appendChild(btn);
    });

    // İlk emoji seçili olsun
    if (grid.children[0]) grid.children[0].click();
}

// Önizleme panelini günceller
function previewPrankNotification() {
    const emoji = document.getElementById('prank-selected-emoji')?.textContent || '⚠️';
    const rawTitle = document.getElementById('prank-title-input')?.value?.trim() || 'Uyarı!';
    const message = document.getElementById('prank-message-input')?.value?.trim() || '...';
    const icon = document.querySelector('input[name="prank-icon"]:checked')?.value || 'fa-bell';

    const fullTitle = `${emoji} ${rawTitle}`;

    const preview = document.getElementById('prank-preview');
    if (preview) {
        preview.style.display = 'block';
        document.getElementById('prev-title').textContent = fullTitle;
        document.getElementById('prev-msg').textContent = message;
        document.getElementById('prev-icon').innerHTML = `<i class="fa-solid ${icon}"></i>`;
    }
}

// Şaka bildirimini sunucuya gönderir → tüm bağlı istemciler alır
async function sendPrankNotification() {
    const emoji = document.getElementById('prank-selected-emoji')?.textContent || '⚠️';
    const rawTitle = document.getElementById('prank-title-input')?.value?.trim();
    const message = document.getElementById('prank-message-input')?.value?.trim();
    const type = document.querySelector('input[name="prank-type"]:checked')?.value || 'danger';
    const icon = document.querySelector('input[name="prank-icon"]:checked')?.value || 'fa-bell';

    if (!rawTitle || !message) {
        document.getElementById('prank-status').textContent = '⚠️ Başlık ve mesaj boş bırakılamaz.';
        return;
    }

    const title = `${emoji} ${rawTitle}`;
    const btn = document.getElementById('prank-send-btn');
    const statusEl = document.getElementById('prank-status');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gönderiliyor...';
    statusEl.textContent = '';

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/v1/prank/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, message, type, icon })
        });

        const data = await res.json();
        if (res.ok) {
            statusEl.style.color = '#22c55e';
            statusEl.textContent = `✅ ${data.message}`;
        } else {
            statusEl.style.color = '#ef4444';
            statusEl.textContent = `❌ ${data.error}`;
        }
    } catch (err) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = '❌ Sunucu bağlantı hatası.';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-ghost"></i> Herkese Gönder';
    }
}

// ==================== KİMLİK DOĞRULAMA ====================
// Oturum kontrolü - Token yoksa login sayfasına yönlendirir
function checkAuth() {
    // Login sayfasındaysak kontrol etme (WebView + web uyumu)
    if (window.location.pathname.endsWith('login.html')) return;

    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('user');

    if (!token || !user) {
        // Giriş yapmamış, login sayfasına yönlendir
        window.location.href = 'login.html';
        return false;
    }

    try {
        const userData = JSON.parse(user);
        currentUserRole = userData.role;
        currentUsername = userData.username;  // Owner kontrolü için


        // Rol bazlı UI kısıtlamalarını uygula
        applyRoleRestrictions();
        return true;
    } catch (err) {
        console.error('Kimlik doğrulama hatası:', err);
        logout();
        return false;
    }
}

// Çıkış yap - Token ve kullanıcı bilgilerini temizle
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    currentUserRole = null;
    currentUsername = null;
    window.location.href = 'login.html';
}

// Rol bazlı UI kısıtlamalarını uygula
function applyRoleRestrictions() {
    const isAdmin = currentUserRole === 'admin';
    const isOwner = currentUsername === 'alienes.akalin';

    // Admin-only elementleri bul ve gizle/göster
    document.querySelectorAll('[data-admin-only]').forEach(el => {
        if (isAdmin) {
            // Paket Yap butonu sadece custom sekmesinde görünmeli
            if (el.id === 'btn-create-packet') {
                el.style.display = (activeSessionTab === 'custom') ? 'block' : 'none';
            } else {
                el.style.display = '';
            }
            el.disabled = false;
        } else {
            // Gizle veya devre dışı bırak
            const action = el.dataset.adminOnly || 'hide';
            if (action === 'disable') {
                el.disabled = true;
                el.style.opacity = '0.5';
                el.style.cursor = 'not-allowed';
                el.title = 'Bu özellik sadece adminler için';
            } else {
                el.style.display = 'none';
            }
        }
    });

    // Owner-only elementleri bul ve gizle/göster (sadece alienes.akalin)
    document.querySelectorAll('[data-owner-only]').forEach(el => {
        if (isOwner) {
            el.style.display = 'block';  // Kesin görünürlük (cache/CSS etkisini sıfırla)
            renderPrankEmojiGrid();      // Emoji ızgarasını doldur
        } else {
            el.style.display = 'none';
        }
    });

    // Kullanıcı bilgisini header'a ekle
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const ownerBadge = isOwner ? '<span style="font-size:0.75rem;color:#f59e0b;vertical-align:middle;line-height:1;">👑</span>' : '';
        userDisplay.innerHTML = `
            <span class="user-role ${user.role}" style="display:inline-flex;align-items:center;gap:4px;">${user.role === 'admin' ? 'Admin' : 'Üye'}${ownerBadge}</span>
        `;
    }

    console.log('🔒 Rol kısıtlamaları uygulandı:', isAdmin ? 'Admin yetkileri' : 'Üye yetkileri', isOwner ? '| 👑 Owner' : '');
}

// ==================== YOUTUBE PLAYER (ŞAKA) ====================

/**
 * YouTube URL'inden video ID çıkarır.
 * URL API ile query param parse eder — greedy regex yanılgısını önler.
 * Desteklenen formatlar:
 *   youtube.com/watch?v=ID  (liste, radio, playlist paramları olsa bile doğru ID alır)
 *   youtu.be/ID
 *   youtube.com/embed/ID
 *   youtube.com/shorts/ID
 *   music.youtube.com/watch?v=ID
 */
function extractYoutubeId(url) {
    try {
        const u = new URL(url.trim());
        // watch?v=ID — URLSearchParams ile tam doğru parse (greedy hata riski yok)
        if (u.searchParams.has('v')) {
            const id = u.searchParams.get('v');
            if (/^[\w-]{11}$/.test(id)) return id;
        }
        // youtu.be/ID veya youtu.be/ID?si=...
        if (u.hostname === 'youtu.be') {
            const id = u.pathname.slice(1).split('?')[0].split('/')[0];
            if (/^[\w-]{11}$/.test(id)) return id;
        }
        // /embed/ID, /shorts/ID, /v/ID
        const pathMatch = u.pathname.match(/\/(?:embed|shorts|v)\/([^/?&#]{11})/);
        if (pathMatch && /^[\w-]{11}$/.test(pathMatch[1])) return pathMatch[1];
    } catch {
        // Geçersiz URL — basit regex fallback
        const m = url.match(/[?&]v=([^?&"']{11})/);
        if (m && /^[\w-]{11}$/.test(m[1])) return m[1];
    }
    return null;
}

/**
 * Prank video popup'ını gösterir — tüm kullanıcılarda (socket event ile tetiklenir).
 * iOS/mobil için otomatik oynatma engelini aşmak adına büyük bir "TAP" butonu gösterilir.
 */
function showPrankPlayer(videoId) {
    // Varsa eskiyi kapat ve listener'ını temizle
    const old = document.getElementById('prank-player-overlay');
    if (old) {
        if (old._ytMsgHandler) window.removeEventListener('message', old._ytMsgHandler);
        old.remove();
    }

    const origin = window.location.origin;
    const overlay = document.createElement('div');
    overlay.id = 'prank-player-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(0,0,0,0.88);
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(10px);
        animation: prankFadeIn 0.4s ease;
    `;

    overlay.innerHTML = `
        <style>
            @keyframes prankFadeIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
            @keyframes prankPulse  { 0%,100% { box-shadow: 0 0 20px rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 45px rgba(239,68,68,0.9), 0 0 80px rgba(239,68,68,0.3); } }
        </style>
        <div style="
            width: min(92vw, 680px);
            background: linear-gradient(135deg, #0a0000 0%, #150500 100%);
            border: 1px solid #dc2626;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 0 60px rgba(239,68,68,0.35), 0 0 120px rgba(239,68,68,0.1);
            position: relative;
        ">
            <!-- Header -->
            <div style="
                background: linear-gradient(90deg, #1a0000, #2d0000, #1a0000);
                border-bottom: 1px solid rgba(220,38,38,0.35);
                padding: 10px 16px;
                display: flex; align-items: center; justify-content: space-between;
            ">
                <span style="color:#ef4444; font-weight:700; font-size:0.95rem; text-shadow: 0 0 10px rgba(239,68,68,0.6); display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-music" style="animation: prankPulse 1.5s infinite;"></i>
                    🎵 &nbsp;Zorunlu Dinleti
                </span>
                <button onclick="closePrankPlayer()"
                    style="background:rgba(220,38,38,0.15); border:1px solid rgba(220,38,38,0.3); color:#ef4444; border-radius:6px; width:30px; height:30px; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; transition:all 0.2s;"
                    onmouseenter="this.style.background='rgba(220,38,38,0.35)'" onmouseleave="this.style.background='rgba(220,38,38,0.15)'">
                    ✕
                </button>
            </div>

            <!-- Player -->
            <div id="prank-iframe-wrap" style="position:relative; padding-bottom:56.25%; height:0; background:#000;">
                <iframe id="prank-iframe"
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0"
                    style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowfullscreen>
                </iframe>
                <!-- Mobil fallback: dokunmadan autoplay engelini aşmak için üst katman -->
                <div id="prank-tap-overlay"
                    style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);cursor:pointer;gap:12px;"
                    onclick="document.getElementById('prank-tap-overlay').remove();">
                    <div style="font-size:3.5rem; filter:drop-shadow(0 0 20px rgba(239,68,68,0.8)); animation:prankPulse 1s infinite;">🎵</div>
                    <div style="color:#fff; font-size:1.1rem; font-weight:700;">Sesi Açmak İçin Dokun</div>
                    <div style="color:#94a3b8; font-size:0.78rem;">Tap to play audio</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // YouTube iframe postMessage ile hata dinle
    // enablejsapi olmadan da YouTube bazı hataları window.message ile yayar
    const ytMsgHandler = function(e) {
        if (!e.data) return;
        try {
            const raw = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
            // YouTube'un gönderdiği hata mesajları farklı formatlarda olabilir
            const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            const errorCode = msg?.info?.errorCode ?? msg?.error ?? null;
            if (errorCode && [2, 5, 100, 101, 150, 153].includes(Number(errorCode))) {
                _showEmbedError(videoId);
            }
        } catch { /* JSON parse hatası, yoksay */ }
    };
    window.addEventListener('message', ytMsgHandler);
    overlay._ytMsgHandler = ytMsgHandler;

    // Masaüstünde autoplay çalışıyorsa tap overlay'i 1.5sn sonra soldur
    setTimeout(() => {
        const tap = document.getElementById('prank-tap-overlay');
        if (tap) tap.style.opacity = '0.3';  // soluyor ama mobilde baskısız
    }, 1500);
}

/** YouTube embed hata ekranını gösterir (embed izni kapalı olan videolar için) */
function _showEmbedError(videoId) {
    const wrap = document.getElementById('prank-iframe-wrap');
    if (!wrap || wrap.dataset.errorShown) return;
    wrap.dataset.errorShown = '1';
    wrap.innerHTML = `
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
                    background:linear-gradient(135deg,#0a0000,#150500);gap:14px;padding:24px;text-align:center;">
            <div style="font-size:3rem;filter:drop-shadow(0 0 16px rgba(239,68,68,0.7));">🚫</div>
            <div style="color:#ef4444;font-weight:700;font-size:1rem;">Bu video embed edilemiyor</div>
            <div style="color:#94a3b8;font-size:0.8rem;max-width:320px;line-height:1.5;">
                Video sahibi üçüncü taraf sitelerde oynatmayı devre dışı bırakmış.<br>
                Başka bir video deneyin ya da YouTube'da açın.
            </div>
            <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" rel="noopener"
               style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#ef4444;
                      padding:9px 22px;border-radius:8px;text-decoration:none;font-size:0.85rem;
                      display:flex;align-items:center;gap:8px;transition:background 0.2s;"
               onmouseenter="this.style.background='rgba(239,68,68,0.3)'"
               onmouseleave="this.style.background='rgba(239,68,68,0.15)'">
                <i class="fa-brands fa-youtube"></i> YouTube'da Aç
            </a>
        </div>
    `;
}

/** Prank player popup'ını kapatır ve arka planda çalışan listener'ı temizler */
function closePrankPlayer() {
    const overlay = document.getElementById('prank-player-overlay');
    if (overlay) {
        if (overlay._ytMsgHandler) window.removeEventListener('message', overlay._ytMsgHandler);
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0.95)';
        overlay.style.transition = 'all 0.25s';
        setTimeout(() => overlay.remove(), 250);
    }
}

/**
 * Çal butonu: Video ID'yi backend'e gönderir → backend Socket.io ile herkese yayınlar.
 * Ayrıca kendi panelinde de local player gösterir.
 */
async function playYoutubeAudio() {
    const input = document.getElementById('yt-player-input');
    const status = document.getElementById('yt-player-status');
    if (!input) return;

    const url = input.value.trim();
    if (!url) {
        if (status) { status.textContent = '⚠️ Link boş bırakılamaz.'; status.style.color = '#f59e0b'; }
        return;
    }

    const videoId = extractYoutubeId(url);
    if (!videoId) {
        if (status) { status.textContent = '❌ Geçerli bir YouTube linki değil.'; status.style.color = '#ef4444'; }
        return;
    }

    if (status) { status.textContent = ''; }

    // Sunucuya gönder → herkese prank_play eventi yayınlar (sen dahil)
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/v1/prank/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ videoId })
        });
        const data = await res.json();
        if (res.ok) {
            if (status) { status.style.color = '#22c55e'; status.textContent = `✅ ${data.message}`; }
        } else {
            if (status) { status.style.color = '#ef4444'; status.textContent = `❌ ${data.error}`; }
        }
    } catch {
        if (status) { status.style.color = '#ef4444'; status.textContent = '❌ Sunucu bağlantı hatası.'; }
    }
}

/** Tüm istemcilerdeki prank player'ı durdurur (backend üzerinden) */
async function stopYoutubeAudio() {
    // Önce kendi ekranını kapat
    closePrankPlayer();
    const input = document.getElementById('yt-player-input');
    if (input) input.value = '';
    const status = document.getElementById('yt-player-status');
    if (status) status.textContent = '';

    // Backend'e durdur sinyali gönder → herkese prank_stop eventi yayınlar
    try {
        const token = localStorage.getItem('authToken');
        await fetch('/api/v1/prank/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
    } catch { /* sessiz hata */ }
}

// ==================== PERFORMANS OPTİMİZASYONU ====================
// Grafikleri çok sık güncellemek performansı düşürür
// Bu değişkenler throttling (kısıtlama) için kullanılır
let lastChartUpdate = 0;
const CHART_THROTTLE_MS = 500;       // Minimum güncelleme aralığı (ms)

// ==================== HARİTA DEĞİŞKENLERİ ====================
let mainMap, fullMap;                // Leaflet harita nesneleri
let mainMarker, fullMarker;          // Konum işaretçileri
let fullPath;                        // Rota çizgisi (polyline)
const defaultPos = [37.0560, 35.3560]; // Varsayılan konum (Adana - Çukurova Üni)
let isTrackingMode = true;           // Harita takip modu (true: konumu takip et)
let lastKnownPos = defaultPos;       // Son bilinen GPS konumu
let routeSegments = [];              // Hız bazlı rota renklendirme için segment dizisi
let routePolylines = [];             // Haritaya eklenen tüm renkli polyline'lar (araç değişiminde temizlemek için)

// ==================== GRAFİK DEĞİŞKENLERİ ====================
// Chart.js grafik nesneleri
let speedChart, energyChart, socChart, tempChart, isoChart;

// ==================== HARİTA İKONLARI ====================
// Harita konum işaretçisi (Google Maps tarzı mavi nokta)
const blueCircleIcon = L.divIcon({
    className: 'blue-dot-marker',
    html: '<div style="width:20px;height:20px;background:#4285f4;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// ==================== YARDIMCI FONKSİYONLAR ====================

// Tarihi Türkiye saat dilimine (UTC+3) çevirir
function formatTR(dateInput) {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    // UTC zamana 3 saat ekle (Türkiye saati)
    const trDate = new Date(date.getTime() + (3 * 60 * 60 * 1000));

    const yyyy = trDate.getUTCFullYear();
    const mm = String(trDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(trDate.getUTCDate()).padStart(2, '0');
    const hh = String(trDate.getUTCHours()).padStart(2, '0');
    const mi = String(trDate.getUTCMinutes()).padStart(2, '0');
    const ss = String(trDate.getUTCSeconds()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

// ==================== SAYFA YÜKLEME ====================
// Sayfa yüklendiğinde çalışan ana başlatma fonksiyonu
document.addEventListener('DOMContentLoaded', () => {
    applyStoredTheme();     // Kayıtlı temayı uygula
    initNavigation();       // Menü navigasyonunu kur
    initMainMap();          // Dashboard haritasını oluştur
    initStopwatch();        // Kronometreyi başlat
    setInterval(updateClock, 1000);  // Saati her saniye güncelle

    // ---- ARAÇ SEÇİCİ ----
    // Android WebView'da inline onchange güvenilmez olduğu için
    // event listener ile bağla (hem web hem Android'de çalışır)
    const deviceSelect = document.getElementById('device-select');
    if (deviceSelect) {
        // 'change' event - standard seçim
        deviceSelect.addEventListener('change', () => {
            switchVehicle(deviceSelect.value);
        });
        // Android WebView'da bazı cihazlarda 'change' gecikmeli tetiklenir,
        // 'touchend' ile anlık tetikle
        deviceSelect.addEventListener('touchend', () => {
            setTimeout(() => switchVehicle(deviceSelect.value), 50);
        });

        // İlk yüklemede başlangıç aracının rengini uygula
        // (CSS cache'den yüklenebileceği için JS ile garantile)
        const initCfg = VEHICLE_CONFIG[currentDeviceId];
        if (initCfg && initCfg.color) {
            deviceSelect.style.borderColor = initCfg.color;
            deviceSelect.style.boxShadow = `0 0 10px ${initCfg.color}55`;
        }
    }

    // Sayfa açılınca mevcut son veriyi çek
    // (Sunucu bağlantısı olmasa bile en son kayıtlı veri görünsün)
    fetchLatestData();

    // Splash Screen Logic
    const splash = document.getElementById('splash-screen');
    if (splash) {
        // Eğer daha önce gösterildiyse hemen kaldır (Hızlı Yenileme)
        if (sessionStorage.getItem('splashShown')) {
            splash.style.display = 'none';
            splash.remove();
        } else {
            // İlk açılışta animasyonu göster
            setTimeout(() => {
                splash.classList.add('hidden');
                setTimeout(() => splash.remove(), 1000);
                sessionStorage.setItem('splashShown', 'true');
            }, 2000);
        }
    }
});

// Son telemetri verisini API'den çeker (aktif araç için)
async function fetchLatestData() {
    try {
        const res = await fetch(`${API_BASE}/api/v1/telemetry/latest?device_id=${currentDeviceId}`);
        const json = await res.json();
        if (json.data) {
            // Dashboard widget'larını güncelle
            updateDashboardWidgets(json.data);

            // NOT: lastDataTime burada GÜNCELLENMEMELİ!
            // fetchLatestData veritabanından eski veri çeker,
            // test butonu sadece CANLI socket verisi ile aktif olmalı.

            // Haritaları güncelle (GPS verisi varsa)
            if (json.data.gps) {
                updateMainMap(json.data);
                if (fullMap) updateFullMap(json.data);
            }

            // Grafikler açıksa onları da güncelle
            if (currentView === 'charts' && chartsInitialized) {
                updateCharts(json.data);
            }
        }
    } catch (err) {
        console.error('Son veri çekilemedi:', err);
    }
}

// ==================== NAVİGASYON SİSTEMİ ====================

// Sol menü navigasyonunu ve sayfa geçişlerini başlatır
function initNavigation() {
    // Eski #menu-toggle hala varsa, yeni drawer'a yönlendir
    const oldMenuBtn = document.getElementById('menu-toggle');
    if (oldMenuBtn) {
        oldMenuBtn.addEventListener('click', () => {
            toggleMobileDrawer();
        });
    }

    // Menü öğelerine tıklama olayları (mobil + desktop uyumlu)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const handleNavClick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log('🔄 Nav item clicked:', item.dataset.page);

            // Aktif sınıfı güncelle
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Hedef sayfayı göster
            const targetPage = item.dataset.page;
            document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
            document.getElementById(`view-${targetPage}`).classList.add('active');

            currentView = targetPage;

            // Drawer'ı kapat (mobilde)
            closeMobileDrawer();

            // Yarış modu için tam ekran sınıfı
            if (targetPage === 'race') {
                document.body.classList.add('race-mode-active');
            } else {
                document.body.classList.remove('race-mode-active');
            }

            // Sayfa bazlı özel işlemler
            if (targetPage === 'charts' && !chartsInitialized) {
                initCharts();
                chartsInitialized = true;
                // Chart'lar oluşturulduktan sonra mevcut temayı uygula
                updateChartTheme(document.body.classList.contains('light-mode'));
                fetchLatestData();
            }
            if (targetPage === 'map') {
                setTimeout(initFullMap, 400);
                setTimeout(fetchLatestData, 500);
            }
            if (targetPage === 'history') {
                loadSessions();
            }
            if (targetPage === 'media') {
                loadTeamGallery();
                applyRoleRestrictions();  // Owner prank panelini her medya açılışında yeniden kontrol et
            }
        };

        // Tek event listener (mobil + desktop uyumlu)
        // touch-action: manipulation CSS'i 300ms gecikmeyi kaldırıyor
        item.addEventListener('click', handleNavClick);
    });
}

// Mobil drawer'ı açar/kapatır
function toggleMobileDrawer() {
    const isOpen = document.body.classList.contains('drawer-open');
    if (isOpen) {
        closeMobileDrawer();
    } else {
        openMobileDrawer();
    }
}

// Mobil drawer'ı açar
function openMobileDrawer() {
    document.body.classList.add('drawer-open');
    const btn = document.getElementById('global-menu-toggle');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    }
}

// Mobil drawer'ı kapatır
function closeMobileDrawer() {
    document.body.classList.remove('drawer-open');
    const btn = document.getElementById('global-menu-toggle');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
}

// Eski toggleRaceMenu uyumluluğu (geriye dönük uyumluluk)
function toggleRaceMenu() {
    toggleMobileDrawer();
}

// ==================== SOCKET.IO OLAY DİNLEYİCİLERİ ====================

// Sunucuya bağlandığında çalışır
socket.on('connect', () => {
    updateStatus(true);
    socket.emit('subscribe', currentDeviceId);  // Aktif aracın verilerini al
    fetchLatestData(); // Bağlanınca son veriyi çek (Persistence)
});

// Sunucu bağlantısı koptuğunda çalışır
socket.on('disconnect', () => updateStatus(false));

// Şaka bildirimi geldiğinde çalışır — TÜM bağlı istemciler alır (admin, üye, owner fark etmez)
socket.on('prank_notify', (data) => {
    const { title = '⚠️ Uyarı!', message = 'Dikkat!', type = 'danger', icon = 'fa-bell' } = data;
    showNotification(title, message, type, icon);
});

// Şaka video oynatma eventi — tüm istemcilerde full-screen popup açar
socket.on('prank_play', (data) => {
    if (data && data.videoId) showPrankPlayer(data.videoId);
});

// Şaka video durdurma eventi — tüm istemcilerdeki popup'ı kapatır
socket.on('prank_stop', () => {
    closePrankPlayer();
});

// Yeni telemetri verisi geldiğinde çalışır
socket.on('telemetry', (data) => {
    // Aktif araç ve alias ID'lerini kabul et (arac-01 → a1 geriye uyumluluk)
    const acceptedIds = resolveSocketIds(currentDeviceId);
    if (!acceptedIds.includes(data.device_id)) return;

    // Test butonu için son veri zamanını kaydet
    lastDataTime = Date.now();
    updateTestButtonState();

    // Dashboard widget'larını güncelle
    updateDashboardWidgets(data);

    // Grafikleri throttle ile güncelle (performans için)
    const now = Date.now();
    if (currentView === 'charts' && chartsInitialized && (now - lastChartUpdate > CHART_THROTTLE_MS)) {
        updateCharts(data);
        lastChartUpdate = now;
    }

    // Haritaları güncelle (aktif sayfaya göre)
    if (currentView === 'map' && fullMap) {
        updateFullMap(data);
    }
    if (currentView === 'dashboard') {
        updateMainMap(data);
    }

    // Strateji ekranını güncelle
    if (currentView === 'strategy') {
        updateStrategyView(data);
    }
});

// ==================== DASHBOARD GÜNCELLEME ====================

// Dashboard ve yarış modundaki tüm widget'ları günceller
function updateDashboardWidgets(data) {
    // Motor verileri
    if (data.motor) {
        updateText('val-speed', data.motor.speed_kph?.toFixed(1));
        updateBar('bar-speed', (data.motor.speed_kph / 120) * 100);
        updateText('val-rpm', data.motor.rpm);
        updateText('val-duty', data.motor.duty_pct?.toFixed(1) + ' %');

        // Yarış modu büyük hız göstergesi
        updateText('race-speed', Math.round(data.motor.speed_kph || 0));
        // Yarış modu duty cycle
        updateText('race-duty', data.motor.duty_pct?.toFixed(1));
        updateDutyBarVisual(data.motor.duty_pct || 0);
    }

    // BMS (Batarya Yönetim Sistemi) verileri
    if (data.bms) {
        updateText('val-soc', data.bms.soc_pct?.toFixed(1) + ' %');
        updateBar('bar-soc', data.bms.soc_pct);
        updateText('val-voltage', data.bms.voltage_v?.toFixed(3));
        updateText('val-temp', data.bms.temp_c?.toFixed(2));
        updateText('val-current', data.bms.current_a?.toFixed(3));
        updateText('val-energy', data.bms.energy_mwh + ' mWh');

        // Progress bar güncellemeleri
        const current = data.bms.current_a || 0;
        const voltage = data.bms.voltage_v || 0;
        const temp = data.bms.temp_c || 0;

        // Akım barı (0-50A)
        updateBar('bar-current', (current / 50) * 100);

        // Voltaj barı (72-84V -> 0-100%)
        const voltagePercent = ((voltage - 72) / 12) * 100;
        updateBar('bar-voltage', Math.max(0, Math.min(100, voltagePercent)));

        // Sıcaklık barı (0-100°C)
        const barTemp = document.getElementById('bar-temp');
        updateBar('bar-temp', temp);

        // Gradient Sıkışmasını Önle:
        // Arka plan boyutunu kapsayıcı genişliğine sabitle, böylece bar uzadıkça renkler "açığa çıkar"
        if (barTemp && barTemp.parentElement) {
            const parentWidth = barTemp.parentElement.clientWidth || 250;
            barTemp.style.backgroundSize = `${parentWidth}px 100%`;
        }

        // ==================== SICAKLIK UYARI SİSTEMİ ====================
        const tempCard = document.getElementById('temp-card');
        const badge = document.getElementById('temp-warning-badge');
        const icon = document.getElementById('temp-warning-icon');
        const text = document.getElementById('temp-warning-text');

        // Önceki sınıfları temizle
        tempCard.classList.remove('temp-normal', 'temp-fan', 'temp-buzzer', 'temp-critical');

        let currentTempState = 'normal';

        if (temp >= 70) {
            // KONTAKTÖR MODU (>70) - Kırmızı
            currentTempState = 'critical';
            tempCard.classList.add('temp-critical');
            badge.style.display = 'inline-flex';
            icon.src = 'img/contactor_icon.svg?v=' + new Date().getTime();
            text.innerText = 'KONTAKTÖR';
        } else if (temp >= 50) {
            // BUZZER MODU (50-70) - Turuncu
            currentTempState = 'buzzer';
            tempCard.classList.add('temp-buzzer');
            badge.style.display = 'inline-flex';
            icon.src = 'img/buzzer_icon.svg?v=' + new Date().getTime();
            text.innerText = 'BUZZER';
        } else if (temp >= 30) {
            // FAN MODU (30-50) - Sarı
            currentTempState = 'fan';
            tempCard.classList.add('temp-fan');
            badge.style.display = 'inline-flex';
            icon.src = 'img/fan_icon.svg';
            text.innerText = 'FAN';
        } else {
            // NORMAL MOD (<30) - Yeşil
            currentTempState = 'normal';
            tempCard.classList.add('temp-normal');
            badge.style.display = 'none';
        }

        // Sıcaklık durumu değiştiyse bildirim gönder
        if (currentTempState !== lastTempState && lastTempState !== null) {
            if (currentTempState === 'fan') {
                showNotification('🌡️ Sıcaklık Uyarısı', `Sıcaklık ${temp.toFixed(0)}° üstüne çıktı ve FAN çalıştı`, 'warning', 'fa-fan');
            } else if (currentTempState === 'buzzer') {
                showNotification('⚠️ Sıcaklık Yüksek!', `Sıcaklık ${temp.toFixed(0)}° üstüne çıktı ve Buzzer aktif!`, 'danger', 'fa-bell');
            } else if (currentTempState === 'critical') {
                showNotification('🚨 Kritik Sıcaklık!', `Sıcaklık kritik! Kontaktör açıldı!`, 'danger', 'fa-plug-circle-xmark');
            }
        }
        lastTempState = currentTempState;

        // ==================== AKIM UYARI SİSTEMİ ====================
        const currentCard = document.getElementById('current-card');
        const isCurrentHigh = current >= CURRENT_THRESHOLD;

        if (isCurrentHigh) {
            currentCard.classList.add('current-warning');
            // Sadece false→true geçişinde bildirim gönder (null=ilk yükleme, bildirim atma)
            if (lastCurrentWarning === false) {
                showNotification('⚡ Akım Uyarısı', `Akım ${CURRENT_THRESHOLD}A üstüne çıktı`, 'warning', 'fa-bolt');
            }
        } else {
            currentCard.classList.remove('current-warning');
        }
        lastCurrentWarning = isCurrentHigh;

        // Yarış modu metrikleri
        updateText('race-voltage', data.bms.voltage_v?.toFixed(2));
        updateText('race-current', data.bms.current_a?.toFixed(2));
        updateText('race-temp', data.bms.temp_c?.toFixed(2));
    }

    // İzolasyon verileri
    if (data.iso) {
        updateText('val-iso-pos', data.iso.res_1_kohm?.toFixed(0) + ' kΩ');
        updateText('val-iso-neg', data.iso.res_2_kohm?.toFixed(0) + ' kΩ');
    }

    // Hidrojen sensör verileri
    if (data.hydrogen) {
        updateText('val-h2', data.hydrogen.ppm + ' ppm');
        updateText('val-h2-temp', data.hydrogen.temp_c?.toFixed(1) + ' °C');
    }

    // Son güncelleme zamanı (Türkiye saati)
    const updateTime = data.ts_server || new Date();
    const dateTimeStr = formatTR(updateTime);
    document.getElementById('val-last-update').innerText = dateTimeStr;
}

// ==================== HARİTA İŞLEVLERİ ====================

// Dashboard sayfasındaki küçük haritayı oluşturur
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

// Dashboard haritasını yeni konumla günceller
function updateMainMap(data) {
    if (validateGPS(data)) {
        const pos = [data.gps.lat_deg, data.gps.lon_deg];
        mainMarker.setLatLng(pos);
        if (isMainTracking) {
            mainMap.panTo(pos);
        }
    }
}

// Dashboard harita takip modunu değiştirir
function toggleMainTracking() {
    isMainTracking = !isMainTracking;
    updateMainTrackingButton();
    if (isMainTracking && mainMarker) {
        mainMap.panTo(mainMarker.getLatLng());
    }
}

// Dashboard harita takip butonunun görünümünü günceller
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

// Detaylı harita sayfasını oluşturur (rota çizimi ve hız renklendirme)
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

// Detaylı haritayı günceller ve hıza göre renkli rota çizer
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
            const segment = L.polyline([lastPos, pos], { color: color, weight: 4, opacity: 0.8 }).addTo(fullMap);
            routePolylines.push(segment);  // Temizlenebilmesi için takip et
        }

        routeSegments.push({ latlng: pos, speed: speed });
    }
}

// Harita takip modunu aktifleştirir
function toggleTrackingMode() {
    isTrackingMode = true;
    if (fullMap && lastKnownPos) {
        fullMap.panTo(lastKnownPos);
    }
    updateTrackingButton();
}

// Detaylı harita takip butonunu günceller
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

// Hız değerine göre renk döndürür (yeşil=yavaş, kırmızı=hızlı)
function getSpeedColor(speed) {
    if (speed < 20) return '#10b981';  // Yeşil (yavaş)
    if (speed < 50) return '#f59e0b';  // Sarı/Turuncu (orta)
    return '#ef4444';                   // Kırmızı (hızlı)
}

// GPS verisinin geçerli olup olmadığını kontrol eder
function validateGPS(data) {
    if (!data.gps) return false;
    const lat = data.gps.lat_deg;
    const lon = data.gps.lon_deg;

    // Sayısal değer, NaN değil ve 0 değil kontrolü
    return typeof lat === 'number' && !isNaN(lat) && lat !== 0 &&
        typeof lon === 'number' && !isNaN(lon) && lon !== 0;
}

// ==================== GRAFİK İŞLEVLERİ ====================

// Tüm Chart.js grafiklerini oluşturur
function initCharts() {
    // Chart.js varsayılan renkleri
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';

    // Ortak grafik ayarları
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,  // Container'a uyum
        animation: { duration: 0 },   // Performans için animasyon kapalı
        scales: { x: { display: false } }
    };

    // 1. HIZ & RPM GRAFİĞİ (Çift eksen)
    speedChart = new Chart(document.getElementById('chart-speed'), {
        type: 'line',
        data: {
            labels: [], datasets: [
                { label: 'Hız (km/h)', data: [], borderColor: '#3b82f6', yAxisID: 'y', tension: 0.3, fill: true, backgroundColor: 'rgba(59,130,246,0.1)' },
                { label: 'RPM', data: [], borderColor: '#8b5cf6', yAxisID: 'y1', tension: 0.3 }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { display: false },
                y: {
                    position: 'left',
                    title: { display: true, text: 'Hız (km/h)', color: '#3b82f6' }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'RPM', color: '#8b5cf6' }
                }
            }
        }
    });

    // 2. VOLTAJ & AKIM GRAFİĞİ (Çift eksen)
    energyChart = new Chart(document.getElementById('chart-energy'), {
        type: 'line',
        data: {
            labels: [], datasets: [
                { label: 'Voltaj (V)', data: [], borderColor: '#10b981', yAxisID: 'y', tension: 0.3, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                { label: 'Akım (A)', data: [], borderColor: '#f59e0b', yAxisID: 'y1', tension: 0.3, fill: true, backgroundColor: 'rgba(245, 158, 11, 0.1)' }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { display: false },
                y: {
                    position: 'left',
                    title: { display: true, text: 'Voltaj (V)', color: '#10b981' }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Akım (A)', color: '#f59e0b' }
                }
            }
        }
    });

    // 3. SICAKLIK GRAFİĞİ
    tempChart = new Chart(document.getElementById('chart-temp'), {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Sıcaklık (°C)', data: [], borderColor: '#ef4444', tension: 0.3, fill: true, backgroundColor: 'rgba(239,68,68,0.1)' }] },
        options: commonOptions
    });

    // 4. SOC (Şarj Durumu) GRAFİĞİ
    socChart = new Chart(document.getElementById('chart-soc'), {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'SOC (%)', data: [], borderColor: '#f59e0b', tension: 0.3, fill: true, backgroundColor: 'rgba(245,158,11,0.1)' }] },
        options: commonOptions
    });

    // 5. İZOLASYON DİRENCİ GRAFİĞİ
    isoChart = new Chart(document.getElementById('chart-iso'), {
        type: 'line',
        data: {
            labels: [], datasets: [
                { label: 'İzo+ (kΩ)', data: [], borderColor: '#06b6d4', tension: 0.3, yAxisID: 'y', fill: true, backgroundColor: 'rgba(6, 182, 212, 0.1)' },
                { label: 'İzo- (kΩ)', data: [], borderColor: '#ec4899', tension: 0.3, yAxisID: 'y1', fill: true, backgroundColor: 'rgba(236, 72, 153, 0.1)' }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { display: false },
                y: {
                    position: 'left',
                    title: { display: true, text: 'İzo+ (kΩ)', color: '#06b6d4' }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'İzo- (kΩ)', color: '#ec4899' }
                }
            }
        }
    });
}

// Tüm grafiklere yeni veri noktası ekler (Plan 2.1: tek toplu update)
function updateCharts(data) {
    const now = formatTR(data.ts_server).split(' ')[1]; // Sadece saat kısmı (HH:MM:SS)

    // Hız & RPM
    addPoint(speedChart, now, data.motor?.speed_kph || 0, 0);
    addPoint(speedChart, now, data.motor?.rpm || 0, 1, true);

    // Sıcaklık & SOC
    addPoint(tempChart, now, data.bms?.temp_c || 0);
    addPoint(socChart, now, data.bms?.soc_pct || 0);

    // Voltaj & Akım
    addPoint(energyChart, now, data.bms?.voltage_v || 0, 0);
    addPoint(energyChart, now, data.bms?.current_a || 0, 1, true);

    // İzolasyon (sadece a1'de mevcut)
    addPoint(isoChart, now, data.iso?.res_1_kohm || 0, 0);
    addPoint(isoChart, now, data.iso?.res_2_kohm || 0, 1, true);

    // Tüm chart'ları tek seferde güncelle (Plan 2.1)
    // 'none' animasyonu atlar → daha hızlı render, özellikle yüksek frekanslı veri akışında kritik
    [speedChart, energyChart, tempChart, socChart, isoChart].forEach(c => c && c.update('none'));
}

// Bir grafiğe yeni veri noktası ekler — chart.update() YAPILMAZ
// updateCharts() sonda tüm chartları bir kerede update eder (Plan 2.1)
function addPoint(chart, label, value, datasetIndex = 0, skipLabel = false) {
    const maxPoints = 50;  // Maksimum görünür nokta sayısı

    // Label sadece ilk dataset için eklenir (diğerleri skipLabel=true ile geçer)
    if (!skipLabel) {
        if (chart.data.labels.length > maxPoints) chart.data.labels.shift();
        chart.data.labels.push(label);
    }

    // En eski noktayı sil, yeni noktayı ekle
    if (chart.data.datasets[datasetIndex].data.length > maxPoints) {
        chart.data.datasets[datasetIndex].data.shift();
    }
    chart.data.datasets[datasetIndex].data.push(value);
    // ⚠️ chart.update() burada yok — updateCharts() sonu toplu yapar
}

// ==================== OTURUM YÖNETİMİ ====================

// Sistem oturumlarını yükler ve listeler (aktif araç için)
async function loadSessions() {
    const container = document.getElementById('session-list');
    container.innerHTML = '<p>Yükleniyor...</p>';

    try {
        const res = await fetch(`${API_BASE}/api/v1/telemetry/startups?device_id=${currentDeviceId}`);
        const json = await res.json();

        container.innerHTML = '';

        if (json.data && json.data.length > 0) {
            json.data.forEach(session => {
                const card = document.createElement('div');
                card.className = 'session-card';
                card.onclick = () => openSession(session._id, session.session_name);

                // Tarihi Türkiye saatine çevir
                const trDate = formatTR(session.session_start);

                card.innerHTML = `
                    <h4><i class="fa-solid fa-play-circle"></i> Oturum: ${trDate}</h4>
                    <p>${session.record_count} veri kaydı</p>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '<p style="padding:1rem;color:#94a3b8;">Henüz oturum kaydı yok. Simülasyonu başlatın!</p>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Hata oluştu!</p>';
    }
}

// Seçilen oturumun verilerini yükler ve tablo olarak gösterir
async function openSession(sessionId, sessionName) {
    currentSessionId = sessionId;
    currentViewType = 'session';
    currentTestId = null;

    // Görünümü değiştir
    document.getElementById('session-list-container').style.display = 'none';
    document.getElementById('session-detail-container').style.display = 'block';
    document.getElementById('test-description-section').style.display = 'none';

    document.getElementById('session-title').innerText = sessionName;

    const tbody = document.getElementById('session-detail-body');
    tbody.innerHTML = '<tr><td colspan="8">Yükleniyor...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/api/v1/telemetry/session/${sessionId}?device_id=${currentDeviceId}`);
        const json = await res.json();

        currentSessionData = json.data || [];
        renderHistoryTable(currentSessionData);

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="8" style="color:red;">Hata oluştu!</td></tr>';
    }
}

/**
 * Shell (a2) için farklı kaynaklardan gelen BMS ve motor verilerini
 * saniye başına tek satırda birleştirir. Her saniye dilimindeki satırlar
 * merge edilerek eksik alanlar doldurulur.
 * Hidromobil (a1) bu fonksiyonu kullanmaz.
 * @param {Array} data - Ham telemetri kayıt dizisi
 * @returns {Array} Birleştirilmiş kayıt dizisi
 */
function mergeRowsBySecond(data) {
    const buckets = new Map(); // key: unix saniye

    data.forEach(row => {
        const sec = Math.floor(new Date(row.ts_server).getTime() / 1000);

        if (!buckets.has(sec)) {
            // İlk satırı temel al (ts_server için)
            buckets.set(sec, {
                ts_server: row.ts_server,
                motor: {},
                bms: {},
                gps: {}
            });
        }

        const merged = buckets.get(sec);

        // Motor alanları: mevcut null/undefined ise üzerine yaz
        if (row.motor) {
            if (row.motor.speed_kph != null && merged.motor.speed_kph == null)
                merged.motor.speed_kph = row.motor.speed_kph;
            if (row.motor.duty_pct != null && merged.motor.duty_pct == null)
                merged.motor.duty_pct = row.motor.duty_pct;
            if (row.motor.rpm != null && merged.motor.rpm == null)
                merged.motor.rpm = row.motor.rpm;
        }

        // BMS alanları
        if (row.bms) {
            if (row.bms.voltage_v != null && merged.bms.voltage_v == null)
                merged.bms.voltage_v = row.bms.voltage_v;
            if (row.bms.current_a != null && merged.bms.current_a == null)
                merged.bms.current_a = row.bms.current_a;
            if (row.bms.temp_c != null && merged.bms.temp_c == null)
                merged.bms.temp_c = row.bms.temp_c;
            if (row.bms.soc_pct != null && merged.bms.soc_pct == null)
                merged.bms.soc_pct = row.bms.soc_pct;
            if (row.bms.energy_mwh != null && merged.bms.energy_mwh == null)
                merged.bms.energy_mwh = row.bms.energy_mwh;
        }

        // GPS alanları
        if (row.gps) {
            if (row.gps.lat_deg != null && merged.gps.lat_deg == null)
                merged.gps.lat_deg = row.gps.lat_deg;
            if (row.gps.lon_deg != null && merged.gps.lon_deg == null)
                merged.gps.lon_deg = row.gps.lon_deg;
        }
    });

    // Map'i sıralı diziye çevir
    return Array.from(buckets.values()).sort(
        (a, b) => new Date(a.ts_server) - new Date(b.ts_server)
    );
}

// Telemetri verilerini tablo olarak render eder
function renderHistoryTable(data) {
    const tbody = document.getElementById('session-detail-body');
    tbody.innerHTML = '';

    // Shell için ayrı gelen BMS/motor satırlarını saniye bazında birleştir
    const vehicleCfg = VEHICLE_CONFIG[currentDeviceId] || {};
    const rows = (!vehicleCfg.hasIso && !vehicleCfg.hasH2) ? mergeRowsBySecond(data) : data;

    if (rows && rows.length > 0) {
        // Performans için DocumentFragment kullan
        const fragment = document.createDocumentFragment();
        rows.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatTR(row.ts_server).split(' ')[1]}</td>
                <td>${row.motor?.speed_kph?.toFixed(1) || '-'}</td>
                <td>${row.motor?.duty_pct?.toFixed(1) != null ? row.motor.duty_pct.toFixed(1) + ' %' : '-'}</td>
                <td>${row.bms?.voltage_v?.toFixed(3) || '-'}</td>
                <td>${row.bms?.current_a?.toFixed(3) || '-'}</td>
                <td>${row.bms?.soc_pct?.toFixed(1) || '-'}</td>
                <td>${row.bms?.temp_c?.toFixed(2) || '-'}</td>
                <td>${row.motor?.rpm || '-'}</td>
            `;
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
    } else {
        tbody.innerHTML = '<tr><td colspan="8">Bu pakette veri yok.</td></tr>';
    }
}

// Oturum detayından listeye geri döner
function backToSessions() {
    document.getElementById('session-detail-container').style.display = 'none';
    document.getElementById('session-list-container').style.display = 'block';
    currentSessionId = null;
    currentSessionData = [];
}

// Oturum verilerini CSV dosyası olarak indirir (Excel uyumlu UTF-8 BOM)
// Araç tipine göre (Shell vs Hidromobil) farklı başlıklar ve sütunlar kullanılır.
function downloadSessionCSV() {
    if (!currentSessionData || currentSessionData.length === 0) {
        alert('İndirilecek veri yok!');
        return;
    }

    // Dosya adı için tarih formatla
    const sessionStart = currentSessionData[0]?.ts_server;
    const trDateStr = sessionStart ? formatTR(sessionStart).replace(/[: ]/g, '-') : 'oturum';

    const vehicleCfg = VEHICLE_CONFIG[currentDeviceId] || { hasIso: false, hasH2: false };

    // Shell için ayrı gelen BMS/motor satırlarını saniye bazında birleştir
    const exportData = (!vehicleCfg.hasIso && !vehicleCfg.hasH2)
        ? mergeRowsBySecond(currentSessionData)
        : currentSessionData;

    // ---- Ortak sütunlar (her iki araç için) ----
    // CSV başlıkları (Excel uyumlu ASCII karakterler)
    const headers = ['Zaman', 'Hiz_kmh', 'Duty_pct', 'Voltaj_V', 'Akim_A', 'SOC_pct', 'Sicaklik_C', 'RPM'];

    // ---- Hidromobil (a1) özel sütunlar ----
    if (vehicleCfg.hasIso) {
        headers.push('Izo_Pos_kOhm', 'Izo_Neg_kOhm');
    }
    if (vehicleCfg.hasH2) {
        headers.push('H2_ppm', 'H2_Sicaklik_C', 'Flowmeter');
    }

    // Veri satırlarını oluştur
    const rows = exportData.map(row => {
        const timeStr = formatTR(row.ts_server);

        // Ortak alanlar
        const cols = [
            timeStr,
            row.motor?.speed_kph?.toFixed(1) || '',
            row.motor?.duty_pct?.toFixed(1) || '',
            row.bms?.voltage_v?.toFixed(3) || '',
            row.bms?.current_a?.toFixed(3) || '',
            row.bms?.soc_pct?.toFixed(1) || '',
            row.bms?.temp_c?.toFixed(2) || '',
            row.motor?.rpm || ''
        ];

        // Hidromobil özel alanlar
        if (vehicleCfg.hasIso) {
            cols.push(
                row.iso?.res_1_kohm?.toFixed(0) || '',
                row.iso?.res_2_kohm?.toFixed(0) || ''
            );
        }
        if (vehicleCfg.hasH2) {
            cols.push(
                row.hydrogen?.ppm || '',
                row.hydrogen?.temp_c?.toFixed(2) || '',
                row.hydrogen?.flowmeter || ''
            );
        }

        return cols;
    });

    // UTF-8 BOM (Excel Türkçe karakter uyumu için)
    const BOM = '\uFEFF';
    let csv = BOM + headers.join(',') + '\n';
    rows.forEach(r => csv += r.join(',') + '\n');

    // Dosyayı indir
    const vehicleName = vehicleCfg.name || currentDeviceId;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${vehicleName}_${trDateStr}.csv`;
    link.click();
}

// ==================== DOM YARDIMCI FONKSİYONLAR ====================

// DOM elemanının metin içeriğini günceller
function updateText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val !== undefined ? val : '-';
}

// İlerleme çubuğunun genişliğini günceller
function updateBar(id, val) {
    const el = document.getElementById(id);
    if (el) {
        const w = Math.min(Math.max(val || 0, 0), 100);
        el.style.width = w + '%';
        // SOC çubuğu için düşük seviyede kırmızı uyarı
        if (id === 'bar-soc') el.style.backgroundColor = w < 20 ? '#ef4444' : '#3b82f6';
    }
}

// Duty cycle bar'ı dikey (landscape) veya yatay (portrait) günceller
function updateDutyBarVisual(pct) {
    const fill = document.getElementById('race-duty-fill');
    if (!fill) return;
    const val = Math.min(Math.max(pct || 0, 0), 100);
    if (window.matchMedia('(max-width: 767px) and (orientation: landscape)').matches) {
        // Dikey bar: width sabit 100%, sadece height animate edilir (alttan yukarı)
        // Önce transition'siz width'i sabitle (yatay animasyon görünmesin)
        fill.style.transition = 'none';
        fill.style.width = '100%';
        // Sonraki frame'de height'i animate et
        requestAnimationFrame(() => {
            fill.style.transition = '';
            fill.style.height = val + '%';
        });
    } else {
        // Yatay bar: height sabit 100%, sadece width animate edilir
        fill.style.transition = 'none';
        fill.style.height = '100%';
        requestAnimationFrame(() => {
            fill.style.transition = '';
            fill.style.width = val + '%';
        });
    }
}

// Bağlantı durumu göstergesini günceller
function updateStatus(connected) {
    const el = document.querySelector('.connection-status');
    const txt = document.getElementById('conn-text');
    if (connected) {
        el.classList.add('connected');
        txt.innerText = 'Bağlandı';
    } else {
        el.classList.remove('connected');
        txt.innerText = 'Koptu';
    }
}

// Sağ üstteki saat göstergesini günceller
function updateClock() {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString();
}

// ==================== KRONOMETRE ====================

// Kronometre durum değişkenleri
let stopwatchInterval = null;        // setInterval referansı
let stopwatchCentiseconds = 0;       // Toplam süre (salise cinsinden)
let lapCount = 0;                    // Tur sayısı
let lastLapCentiseconds = 0;         // Son tur zamanı
let lapData = [];                    // Tur verileri [{lapNum, lapTime, totalTime}]

// Kronometre durumunu localStorage'a kaydeder
function saveStopwatchState() {
    const state = {
        centiseconds: stopwatchCentiseconds,
        lapCount: lapCount,
        lastLapCentiseconds: lastLapCentiseconds,
        lapData: lapData,
        isRunning: stopwatchInterval !== null
    };
    localStorage.setItem('stopwatchState', JSON.stringify(state));
}

// Kronometre durumunu localStorage'dan yükler
function loadStopwatchState() {
    const saved = localStorage.getItem('stopwatchState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            stopwatchCentiseconds = state.centiseconds || 0;
            lapCount = state.lapCount || 0;
            lastLapCentiseconds = state.lastLapCentiseconds || 0;
            lapData = state.lapData || [];
            return state.isRunning || false;
        } catch (e) {
            console.error('Stopwatch state parse error:', e);
        }
    }
    return false;
}

// Her iki ekrandaki kronometre gösterimini günceller (dashboard + yarış)
function updateAllStopwatchDisplays() {
    const hours = Math.floor(stopwatchCentiseconds / 360000);
    const minutes = Math.floor((stopwatchCentiseconds % 360000) / 6000);
    const seconds = Math.floor((stopwatchCentiseconds % 6000) / 100);
    const cs = stopwatchCentiseconds % 100;

    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    const s = String(seconds).padStart(2, '0');
    const c = String(cs).padStart(2, '0');

    // Dashboard kronometresi
    const swH1 = document.getElementById('sw-h1');
    const swH2 = document.getElementById('sw-h2');
    const swM1 = document.getElementById('sw-m1');
    const swM2 = document.getElementById('sw-m2');
    const swS1 = document.getElementById('sw-s1');
    const swS2 = document.getElementById('sw-s2');
    const swC1 = document.getElementById('sw-c1');
    const swC2 = document.getElementById('sw-c2');

    if (swH1) swH1.textContent = h[0];
    if (swH2) swH2.textContent = h[1];
    if (swM1) swM1.textContent = m[0];
    if (swM2) swM2.textContent = m[1];
    if (swS1) swS1.textContent = s[0];
    if (swS2) swS2.textContent = s[1];
    if (swC1) swC1.textContent = c[0];
    if (swC2) swC2.textContent = c[1];

    // Stratejist kronometresi
    const stratH1 = document.getElementById('strat-sw-h1');
    const stratH2 = document.getElementById('strat-sw-h2');
    const stratM1 = document.getElementById('strat-sw-m1');
    const stratM2 = document.getElementById('strat-sw-m2');
    const stratS1 = document.getElementById('strat-sw-s1');
    const stratS2 = document.getElementById('strat-sw-s2');
    const stratC1 = document.getElementById('strat-sw-c1');
    const stratC2 = document.getElementById('strat-sw-c2');

    if (stratH1) stratH1.textContent = h[0];
    if (stratH2) stratH2.textContent = h[1];
    if (stratM1) stratM1.textContent = m[0];
    if (stratM2) stratM2.textContent = m[1];
    if (stratS1) stratS1.textContent = s[0];
    if (stratS2) stratS2.textContent = s[1];
    if (stratC1) stratC1.textContent = c[0];
    if (stratC2) stratC2.textContent = c[1];
}

// Tur listelerini günceller (her iki ekran için)
function updateAllLapLists() {
    const dashboardLapList = document.getElementById('lap-list');
    const strategyLapList = document.getElementById('strategy-lap-list');

    // Her iki listeyi de temizle ve yeniden oluştur
    [dashboardLapList, strategyLapList].forEach(lapList => {
        if (!lapList) return;
        lapList.innerHTML = '';

        // En yeni turdan en eskiye doğru ekle
        for (let i = lapData.length - 1; i >= 0; i--) {
            const lap = lapData[i];
            const lapItem = document.createElement('div');
            lapItem.className = 'lap-item';
            lapItem.innerHTML = `
                <span class="lap-num">Tur ${lap.lapNum}</span>
                <span class="lap-time">${formatStopwatchSimple(lap.lapTime)}</span>
                <span class="lap-total">${formatStopwatchSimple(lap.totalTime)}</span>
            `;
            lapList.appendChild(lapItem);
        }
    });
}

// Kronometreyi başlatır
function startStopwatchTimer() {
    if (stopwatchInterval) return; // Zaten çalışıyorsa çık

    stopwatchInterval = setInterval(() => {
        stopwatchCentiseconds++;
        updateAllStopwatchDisplays();
        // Her saniyede bir kaydet (performans için)
        if (stopwatchCentiseconds % 100 === 0) {
            saveStopwatchState();
        }
    }, 10);
}

// Kronometreyi durdurur
function stopStopwatchTimer() {
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        saveStopwatchState();
    }
}

// Tur ekler
function addLap() {
    if (!stopwatchInterval && stopwatchCentiseconds === 0) return;

    lapCount++;
    const lapTime = stopwatchCentiseconds - lastLapCentiseconds;
    lastLapCentiseconds = stopwatchCentiseconds;

    // Tur verisini kaydet
    lapData.push({
        lapNum: lapCount,
        lapTime: lapTime,
        totalTime: stopwatchCentiseconds
    });

    // Tüm listeleri güncelle
    updateAllLapLists();

    // Stratejist ekranındaki tur sayısını güncelle
    raceStrategy.currentLap = lapCount;
    const currentLapEl = document.getElementById('current-lap');
    if (currentLapEl) {
        currentLapEl.innerText = lapCount;
    }

    // Hedef tur sayısına ulaşıldıysa testi otomatik bitir
    const targetLaps = raceStrategy.targetLaps || 10;
    console.log(`🏁 Tur kontrolü: ${lapCount}/${targetLaps}, test aktif: ${isTestRecording}`);

    if (lapCount >= targetLaps && isTestRecording === true) {
        console.log('🏁 Hedef tura ulaşıldı, test durduruluyor...');
        showNotification(
            `🏁 Hedef tur tamamlandı (${lapCount}/${targetLaps})! Test durduruluyor.`,
            'success'
        );
        // Doğrudan durdur (async fonksiyonu try-catch ile çağır)
        try {
            stopTestRecording();
        } catch (err) {
            console.error('Otomatik test durdurma hatası:', err);
        }
    }

    // Kaydet
    saveStopwatchState();
}

// Kronometreyi sıfırlar
function resetStopwatch() {
    stopStopwatchTimer();
    stopwatchCentiseconds = 0;
    lapCount = 0;
    lastLapCentiseconds = 0;
    lapData = [];

    updateAllStopwatchDisplays();
    updateAllLapLists();

    // Stratejist tur sayısını sıfırla
    raceStrategy.currentLap = 0;
    const currentLapEl = document.getElementById('current-lap');
    if (currentLapEl) {
        currentLapEl.innerText = '0';
    }

    // localStorage'dan da sil
    localStorage.removeItem('stopwatchState');
}

// Kronometre bileşenini başlatır ve olay dinleyicilerini ekler
function initStopwatch() {
    // localStorage'dan durumu yükle
    const wasRunning = loadStopwatchState();

    // Görünümü güncelle
    updateAllStopwatchDisplays();
    updateAllLapLists();

    // Eğer önceden çalışıyorsa devam ettir
    if (wasRunning) {
        startStopwatchTimer();
    }

    // Stratejist TUR butonu
    const stratLapBtn = document.getElementById('strat-sw-lap');
    if (stratLapBtn) {
        stratLapBtn.addEventListener('click', addLap);
    }

    // Stratejist SIFIRLA butonu
    const stratResetBtn = document.getElementById('strat-sw-reset');
    if (stratResetBtn) {
        stratResetBtn.addEventListener('click', resetStopwatch);
    }
}

// Saliseleri dakika:saniye formatına çevirir
function formatStopwatchSimple(totalCentiseconds) {
    const minutes = Math.floor(totalCentiseconds / 6000);
    const seconds = Math.floor((totalCentiseconds % 6000) / 100);

    return String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');
}

// ==================== MEDYA / GALERI ====================

/**
 * Medya uygulamasını açar.
 * Android WebView: intent:// şeması ile önce native uygulamayı dener,
 * uygulama yüklü değilse tarayıcıya düşer.
 * Web tarayıcısı: direkt yeni sekme açar.
 *
 * @param {string} app     - 'spotify' | 'youtube' | 'ytmusic'
 * @param {string} webUrl  - fallback web URL'i
 */
function openMediaApp(app, webUrl) {
    const intentMap = {
        spotify:  'intent://open.spotify.com/#Intent;scheme=https;package=com.spotify.music;S.browser_fallback_url=https%3A%2F%2Fopen.spotify.com;end',
        youtube:  'intent://www.youtube.com/#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=https%3A%2F%2Fwww.youtube.com;end',
        ytmusic:  'intent://music.youtube.com/#Intent;scheme=https;package=com.google.android.apps.youtube.music;S.browser_fallback_url=https%3A%2F%2Fmusic.youtube.com;end',
        linkedin: 'intent://www.linkedin.com/in/aliakalin/#Intent;scheme=https;package=com.linkedin.android;S.browser_fallback_url=https%3A%2F%2Fwww.linkedin.com%2Fin%2Faliakalin%2F;end',
    };

    const isAndroidWebView = !!window.AndroidNotification;
    if (isAndroidWebView && intentMap[app]) {
        // Native app → intent şeması; MainActivity.java shouldOverrideUrlLoading yakalar
        window.location.href = intentMap[app];
    } else {
        window.open(webUrl, '_blank');
    }
}

// YouTube'da arama yapar
function searchYoutube() {
    const query = document.getElementById('yt-search-input').value.trim();
    if (!query) return;
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    // Android WebView'da window.open çalışmayabileceği için intent ile aç
    const isAndroidWebView = !!window.AndroidNotification;
    if (isAndroidWebView) {
        const intent = `intent://www.youtube.com/results?search_query=${encodeURIComponent(query)}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(searchUrl)};end`;
        window.location.href = intent;
    } else {
        window.open(searchUrl, '_blank');
    }
}

// Enter tuşu ile YouTube araması
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('yt-search-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchYoutube();
        });
    }
});

// ==================== GOOGLE DRIVE GALERİSİ ====================

// Galeri durum değişkenleri
let currentGalleryImages = [];   // Galeri görsel listesi
let currentImageIndex = 0;       // Lightbox'taki aktif görsel indeksi

// Google Drive galerisi — backend proxy üzerinden yükler (Script URL gizli kalır)
async function loadTeamGallery() {
    const grid = document.getElementById('team-gallery-grid');
    if (!grid) return;

    grid.innerHTML = '<p style="color:#ffffff; text-align:center; width:100%;">Google Drive taranıyor...</p>';

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE}/api/v1/gallery`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 503) {
            grid.innerHTML = `
                <div style="text-align:center; width:100%; color:#f59e0b;">
                    <p>⚠️ Google Drive Bağlantısı Yapılandırılmadı</p>
                    <p style="font-size:0.8rem; color:#94a3b8;">
                        Sunucuda <b>GOOGLE_SCRIPT_URL</b> ortam değişkeni tanımlı değil.
                    </p>
                </div>
            `;
            return;
        }

        if (!res.ok) throw new Error('Drive API yanıt vermedi');

        const responseData = await res.json();
        currentGalleryImages = responseData.data || [];

        if (currentGalleryImages.length === 0) {
            grid.innerHTML = '<p style="color:#94a3b8; width:100%; text-align:center;">Klasör boş veya erişim izni yok.</p>';
            return;
        }

        // Galeri grid'ini oluştur
        grid.innerHTML = '';
        currentGalleryImages.forEach((img, index) => {
            const imgEl = document.createElement('img');
            imgEl.src = img.url;
            imgEl.className = 'gallery-item';
            imgEl.onclick = () => openLightbox(index);
            imgEl.loading = 'lazy';
            imgEl.title = img.name || 'Fotoğraf';
            grid.appendChild(imgEl);
        });

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p style="color:red; text-align:center; width:100%;">Bağlantı Hatası! Sunucu loglarını kontrol edin.</p>';
    }
}

// ==================== LIGHTBOX (TAM EKRAN GÖRSEL) ====================

// Lightbox modalını açar ve seçilen görseli gösterir
function openLightbox(index) {
    currentImageIndex = index;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');

    if (lightbox && lightboxImg) {
        lightboxImg.src = currentGalleryImages[currentImageIndex].url;
        lightbox.classList.add('active');
    }
}

// Lightbox modalını kapatır
function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

// Lightbox'ta önceki/sonraki görsele geçer
function changeImage(n) {
    currentImageIndex += n;

    // Döngüsel geçiş
    if (currentImageIndex >= currentGalleryImages.length) {
        currentImageIndex = 0;
    } else if (currentImageIndex < 0) {
        currentImageIndex = currentGalleryImages.length - 1;
    }

    const lightboxImg = document.getElementById('lightbox-img');
    if (lightboxImg) {
        lightboxImg.src = currentGalleryImages[currentImageIndex].url;
    }
}

// Klavye kontrolleri (Lightbox için)
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox.classList.contains('active')) return;

    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeImage(-1);
    if (e.key === 'ArrowRight') changeImage(1);
});

// ==================== ÖZEL PAKETLER (CUSTOM SESSIONS) ====================

// Aktif sekme (system: otomatik oturumlar, custom: kullanıcı paketleri, tests: test kayıtları)
let activeSessionTab = 'system';

// ==================== TEST KAYDI ====================
let isTestRecording = false;  // Test kaydı aktif mi?
let testStartTime = null;     // Test başlangıç zamanı

// Geçmiş sayfasında sekme değiştirir
function switchSessionTab(tab) {
    activeSessionTab = tab;

    // Sekme butonlarını güncelle
    document.getElementById('tab-system').classList.toggle('active', tab === 'system');
    document.getElementById('tab-custom').classList.toggle('active', tab === 'custom');
    document.getElementById('tab-tests').classList.toggle('active', tab === 'tests');

    // İlgili listeyi göster/gizle
    document.getElementById('session-list').style.display = tab === 'system' ? 'grid' : 'none';
    document.getElementById('custom-packet-list').style.display = tab === 'custom' ? 'grid' : 'none';
    document.getElementById('test-list').style.display = tab === 'tests' ? 'grid' : 'none';

    // Paket oluştur butonunu sadece custom sekmesinde göster
    document.getElementById('btn-create-packet').style.display = tab === 'custom' ? 'block' : 'none';

    // Verileri yükle
    if (tab === 'system') loadSessions();
    else if (tab === 'custom') loadCustomPackets();
    else if (tab === 'tests') loadTests();
}

// Aktif sekmenin listesini yeniler
function refreshCurrentSessionList() {
    if (activeSessionTab === 'system') loadSessions();
    else if (activeSessionTab === 'custom') loadCustomPackets();
    else if (activeSessionTab === 'tests') loadTests();
}

// Yeni paket oluşturma modalını açar
function openCreatePacketModal() {
    document.getElementById('packet-modal').classList.add('active');

    const now = new Date();
    const ago = new Date(now.getTime() - 1000 * 60 * 60); // 1 saat önce

    // Yerel datetime formatına çevir
    const toLocalISO = (d) => {
        const off = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - off).toISOString().slice(0, 16);
    };

    document.getElementById('packet-start').value = toLocalISO(ago);
    document.getElementById('packet-end').value = toLocalISO(now);
}

// Paket oluşturma modalını kapatır
function closeCreatePacketModal() {
    document.getElementById('packet-modal').classList.remove('active');
}

// Özel paketleri API'den yükler ve listeler
async function loadCustomPackets() {
    const listDiv = document.getElementById('custom-packet-list');
    listDiv.innerHTML = '<p style="color:#aaa;">Yükleniyor...</p>';

    try {
        const res = await fetch(`${API_BASE}/api/v1/custom-sessions?device_id=${currentDeviceId}`);
        const packets = await res.json();

        listDiv.innerHTML = '';
        if (packets.length === 0) {
            listDiv.innerHTML = '<p style="color:#aaa; grid-column:1/-1; text-align:center;">Henüz özel paket oluşturulmadı.</p>';
            return;
        }

        packets.forEach(pkt => {
            const card = document.createElement('div');
            card.className = 'session-card';
            card.onclick = () => loadCustomPacketData(pkt._id);

            const startStr = new Date(pkt.start_time).toLocaleString('tr-TR');
            const endStr = new Date(pkt.end_time).toLocaleString('tr-TR');

            card.innerHTML = `
                <div class="session-icon"><i class="fa-solid fa-box-archive"></i></div>
                <div class="session-info">
                    <div class="session-date">${pkt.name}</div>
                    <div class="session-duration" style="font-size:0.75rem;">${startStr} <br> ${endStr}</div>
                </div>
                <button onclick="deleteCustomPacket(event, '${pkt._id}')" class="sw-btn" style="background:#ef4444; padding:5px 10px; margin-left:auto; z-index:2;">Sil</button>
            `;
            listDiv.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        listDiv.innerHTML = '<p style="color:red;">Hata oluştu.</p>';
    }
}

// Yeni özel paket oluşturur ve kaydeder
async function saveCustomPacket() {
    const name = document.getElementById('packet-name').value;
    const start = document.getElementById('packet-start').value;
    const end = document.getElementById('packet-end').value;

    if (!name || !start || !end) {
        alert('Lütfen tüm alanları doldurun');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/v1/custom-sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, start_time: start, end_time: end, device_id: currentDeviceId })
        });

        if (res.ok) {
            closeCreatePacketModal();
            loadCustomPackets();
        } else {
            alert('Paket oluşturulamadı');
        }
    } catch (err) {
        console.error(err);
        alert('Sunucu hatası');
    }
}

// Özel paketi siler
async function deleteCustomPacket(e, id) {
    e.stopPropagation(); // Karta tıklamayı engelle

    if (!confirm('Bu paketi silmek istediğinize emin misiniz? Veriler silinmez, sadece paket tanımı silinir.')) return;

    try {
        await fetch(`${API_BASE}/api/v1/custom-sessions/${id}`, { method: 'DELETE' });
        loadCustomPackets();
    } catch (err) {
        alert('Silinemedi');
    }
}

// Özel paketin verilerini detay görünümünde açar
async function loadCustomPacketData(id) {
    // Görünümü değiştir
    document.getElementById('session-list-container').style.display = 'none';
    document.getElementById('session-detail-container').style.display = 'block';
    document.getElementById('test-description-section').style.display = 'none';
    currentViewType = 'custom';
    currentTestId = null;

    document.getElementById('session-title').innerText = "Yükleniyor...";
    const tbody = document.getElementById('session-detail-body');
    tbody.innerHTML = '<tr><td colspan="7">Veriler getiriliyor...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/api/v1/custom-sessions/${id}/data`);
        const result = await res.json();

        const session = result.session;
        currentSessionId = session._id;
        currentSessionData = result.data; // CSV export için

        document.getElementById('session-title').innerText = `${session.name} (${result.count} Veri)`;

        renderHistoryTable(currentSessionData);

    } catch (err) {
        console.error(err);
        document.getElementById('session-title').innerText = 'Hata: ' + err.message;
        alert('Veri yüklenirken hata oluştu: ' + err.message);
    }
}

// ==================== TEST KAYDI FonksİYONLARI ====================

// Test butonu durumunu kontrol eder ve araç açılış/kapanış bildirimi gönderir
function updateTestButtonState() {
    const btn = document.getElementById('btn-test-record');
    if (!btn) return;
    const now = Date.now();
    const hasData = !!(lastDataTime && (now - lastDataTime) < 10000);

    // ---- Araç kapandı bildirimi ----
    // Sadece active→inactive geçişinde, sayfa yeni yüklendiyse (null) bildirim atma.
    if (lastDataActive === true && !hasData) {
        const vehicleName = (VEHICLE_CONFIG[currentDeviceId] || {}).name || currentDeviceId;
        showNotification(
            '🔴 Araç Kapandı',
            `${vehicleName} aracı kapandı`,
            'danger',
            'fa-circle-xmark'
        );
    }
    lastDataActive = hasData;

    // ---- Test butonu durumu ----
    // Test kayıt halindeyse butonu devre dışı bırakma
    if (isTestRecording) {
        btn.disabled = false;
        btn.classList.remove('no-data');
        return;
    }

    if (hasData) {
        btn.disabled = false;
        btn.classList.remove('no-data');
        btn.title = 'Testi başlat';
    } else {
        btn.disabled = true;
        btn.classList.add('no-data');
        btn.title = 'Veri akışı yok - test başlatılamıyor';
    }
}

// Her 2 saniyede bir buton durumunu kontrol et
setInterval(updateTestButtonState, 2000);

// Test kaydını başlatır veya durdurur
function toggleTestRecording() {
    const btn = document.getElementById('btn-test-record');
    if (!btn) return;

    // Kayıt durdurma her zaman mümkün olmalı
    if (isTestRecording) {
        stopTestRecording();
        return;
    }

    // Başlatma için veri akışı kontrolU
    const now = Date.now();
    const hasData = lastDataTime && (now - lastDataTime) < 10000;

    if (!hasData) {
        showNotification('Veri akışı yok! Test başlatılamıyor.', 'warning');
        btn.disabled = true;
        btn.classList.add('no-data');
        return;
    }

    startTestRecording();
}

// Test kaydını başlatır
function startTestRecording() {
    isTestRecording = true;
    testStartTime = new Date();

    // Buton görünümünü güncelle
    const btn = document.getElementById('btn-test-record');
    const text = document.getElementById('test-btn-text');
    btn.classList.add('recording');
    text.innerText = 'Testi Durdur';

    // Kronometreyi başlat (yeni merkezi fonksiyon)
    startStopwatchTimer();

    // Stratejist için yarış başlangıç zamanını kaydet
    raceStrategy.raceStartTime = testStartTime;
    raceStrategy.isRaceActive = true;


}

// Test kaydını durdurur ve API'ye kaydeder
async function stopTestRecording() {
    // Önce durumu hemen güncelle (çift tetikleme önleme)
    if (!isTestRecording) {
        console.log('⚠️ stopTestRecording: Test zaten durmuş');
        return;
    }
    isTestRecording = false;

    const endTime = new Date();
    console.log('🛑 Test durduruluyor...');

    // Kronometreyi HEMEN durdur
    stopStopwatchTimer();

    // Stratejist yarış durumunu güncelle
    raceStrategy.isRaceActive = false;

    // Buton görünümünü güncelle
    const btn = document.getElementById('btn-test-record');
    const text = document.getElementById('test-btn-text');
    if (btn) btn.classList.remove('recording');
    if (text) text.innerText = 'Testi Başlat';

    // Test ismini oluştur: "Başlangıç - Bitiş"
    const formatDate = (d) => d.toLocaleString('tr-TR');
    const name = `${formatDate(testStartTime)} - ${formatDate(endTime)}`;

    try {
        const res = await fetch(`${API_BASE}/api/v1/tests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                start_time: testStartTime.toISOString(),
                end_time: endTime.toISOString(),
                total_laps: raceStrategy.currentLap,
                device_id: currentDeviceId
            })
        });

        if (res.ok) {
            showNotification('✅ Test başarıyla kaydedildi!', 'success');
        } else {
            showNotification('❌ Test kaydedilemedi', 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('❌ Sunucu hatası: Test kaydedilemedi', 'error');
    }

    // Durumu sıfırla
    testStartTime = null;
}

// Testleri API'den yükler ve listeler
async function loadTests() {
    const listDiv = document.getElementById('test-list');
    listDiv.innerHTML = '<p style="color:#aaa;">Yükleniyor...</p>';

    try {
        const res = await fetch(`${API_BASE}/api/v1/tests?device_id=${currentDeviceId}`);
        const tests = await res.json();

        listDiv.innerHTML = '';
        if (tests.length === 0) {
            listDiv.innerHTML = '<p style="color:#aaa; grid-column:1/-1; text-align:center;">Henüz test kaydı yok.</p>';
            return;
        }

        tests.forEach(test => {
            const card = document.createElement('div');
            card.className = 'session-card';

            const startStr = formatTR(test.start_time);
            const endStr   = formatTR(test.end_time);

            // İsim varsa erlenmayer simgesinin sağında göster
            const labelSpan = test.label
                ? `<span style="font-size:0.88rem; font-weight:600; color:#f1f5f9; margin-left:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${test.label}</span>`
                : '';

            card.innerHTML = `
                <div style="display:flex; align-items:flex-start; flex:1; min-width:0;">
                    <div class="session-icon" style="flex-shrink:0; display:flex; align-items:center;">
                        <i class="fa-solid fa-flask"></i>${labelSpan}
                    </div>
                </div>
                <div class="session-info" style="flex:1; min-width:0; margin-left:10px;">
                    <div class="session-date" style="font-size:0.78rem; color:#94a3b8;">${startStr}</div>
                    <div class="session-date" style="font-size:0.78rem; color:#94a3b8;">${endStr}</div>
                </div>
                <div style="margin-left:10px;">
                    <button class="sw-btn btn-test-delete" data-id="${test._id}"
                        style="background:#ef4444; padding:5px 10px; z-index:2;">Sil</button>
                </div>
            `;

            // Kart tıklaması (buton hariç)
            card.addEventListener('click', () => loadTestData(test._id));

            // Sil butonu
            card.querySelector('.btn-test-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTest(test._id);
            });

            listDiv.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        listDiv.innerHTML = '<p style="color:red;">Hata oluştu.</p>';
    }
}

// Testi siler
async function deleteTest(id) {
    if (!confirm('Bu testi silmek istediğinize emin misiniz?')) return;

    try {
        await fetch(`${API_BASE}/api/v1/tests/${id}`, { method: 'DELETE' });
        loadTests();
    } catch (err) {
        console.error(err);
        alert('Silinemedi');
    }
}

// Test ismi (label) editörünü aç — detail view'da açıklama gibi inline
function editTestLabelDetail() {
    const editor = document.getElementById('test-label-editor');
    const input = document.getElementById('test-label-input');
    input.value = document.getElementById('test-label-text').textContent;
    editor.style.display = 'block';
    input.focus();
}

// Test ismini kaydet (PATCH)
async function saveTestLabel() {
    if (!currentTestId) return;
    const newLabel = document.getElementById('test-label-input').value.trim();
    try {
        await fetch(`${API_BASE}/api/v1/tests/${currentTestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: newLabel })
        });
        document.getElementById('test-label-text').textContent = newLabel;
        document.getElementById('label-btn-text').textContent = newLabel ? 'İsmi Düzenle' : 'İsim Ekle';
        document.getElementById('test-label-editor').style.display = 'none';
        // Listede de güncellensin diye cache'i sıfırla (arka planda)
        loadTests();
    } catch (err) {
        console.error(err);
        alert('İsim güncellenemedi');
    }
}

// Test ismi editörünü kapat
function cancelTestLabel() {
    document.getElementById('test-label-editor').style.display = 'none';
}

// Açıklama düzenleyiciyi aç/göster
function editTestDescription() {
    const editor = document.getElementById('test-description-editor');
    const textarea = document.getElementById('test-description-input');
    textarea.value = document.getElementById('test-description-text').textContent;
    editor.style.display = 'block';
    textarea.focus();
}

// Açıklama kaydet (PATCH)
async function saveTestDescription() {
    if (!currentTestId) return;
    const desc = document.getElementById('test-description-input').value.trim();
    try {
        await fetch(`${API_BASE}/api/v1/tests/${currentTestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: desc })
        });
        document.getElementById('test-description-text').textContent = desc;
        document.getElementById('desc-btn-text').textContent = desc ? 'Açıklama Düzenle' : 'Açıklama Ekle';
        cancelTestDescription();
        showNotification('✅ Açıklama kaydedildi', '', 'success', 'fa-circle-check');
    } catch (err) {
        console.error(err);
        alert('Açıklama kaydedilemedi');
    }
}

// Açıklama düzenleyiciyi kapat
function cancelTestDescription() {
    document.getElementById('test-description-editor').style.display = 'none';
}

// Test verilerini yükler ve tablo/grafikte gösterir
async function loadTestData(id) {
    document.getElementById('session-detail-container').style.display = 'block';
    document.getElementById('session-list-container').style.display = 'none';
    document.getElementById('session-title').innerText = 'Yükleniyor...';
    document.getElementById('test-description-section').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/api/v1/tests/${id}/data`);
        const result = await res.json();

        const test = result.test;
        currentSessionId = test._id;
        currentSessionData = result.data;
        currentViewType = 'test';
        currentTestId = test._id;

        document.getElementById('session-title').innerText = `${test.name} (${result.count} Veri)`;

        // İsim (label) bölümünü göster ve doldur
        const labelText = document.getElementById('test-label-text');
        const labelBtnText = document.getElementById('label-btn-text');
        labelText.textContent = test.label || '';
        labelBtnText.textContent = test.label ? 'İsmi Düzenle' : 'İsim Ekle';
        document.getElementById('test-label-editor').style.display = 'none';

        // Açıklama bölümünü göster ve doldur
        const descSection = document.getElementById('test-description-section');
        const descText = document.getElementById('test-description-text');
        const descBtnText = document.getElementById('desc-btn-text');
        descSection.style.display = 'block';
        descText.textContent = test.description || '';
        descBtnText.textContent = test.description ? 'Açıklama Düzenle' : 'Açıklama Ekle';
        document.getElementById('test-description-editor').style.display = 'none';

        renderHistoryTable(currentSessionData);

    } catch (err) {
        console.error(err);
        document.getElementById('session-title').innerText = 'Hata: ' + err.message;
        alert('Veri yüklenirken hata oluştu: ' + err.message);
    }
}

// ==================== STRATEJİST HESAPLAMALARI (Verimlilik Yarışı) ====================

// Yarış ayarları ve strateji verilerini saklamak için
let raceStrategy = {
    targetLaps: 10,            // Hedef tur sayısı
    targetTimeMin: 30,         // Hedef süre (dakika)
    lapDistanceM: 3000,        // Tur uzunluğu (metre)
    targetSpeedKph: 0,         // Hesaplanan hedef hız
    targetLapTimeSec: 0,       // Hedef tur süresi (saniye)
    totalConsumedWh: 0,        // Toplam harcanan enerji
    currentLap: 0,             // Mevcut tur
    avgConsumptionWhKm: 0,     // Ortalama tüketim (Wh/km)
    raceStartTime: null,       // Yarış başlangıç zamanı
    isRaceActive: false        // Yarış aktif mi
};

// Yarış stratejisini hesaplar
function calculateRaceStrategy() {
    const targetLaps = parseInt(document.getElementById('target-laps').value) || 10;
    const targetTimeMin = parseInt(document.getElementById('target-time').value) || 30;
    const lapDistanceM = parseInt(document.getElementById('lap-distance').value) || 3000;

    // Değerleri kaydet
    raceStrategy.targetLaps = targetLaps;
    raceStrategy.targetTimeMin = targetTimeMin;
    raceStrategy.lapDistanceM = lapDistanceM;

    // Toplam mesafe (km)
    const totalDistanceKm = (targetLaps * lapDistanceM) / 1000;

    // Hedef hız hesapla: Mesafe / Süre
    const targetSpeedKph = totalDistanceKm / (targetTimeMin / 60);
    raceStrategy.targetSpeedKph = targetSpeedKph;

    // Hedef tur süresi (saniye)
    const targetLapTimeSec = (targetTimeMin * 60) / targetLaps;
    raceStrategy.targetLapTimeSec = targetLapTimeSec;

    // UI'ı güncelle
    animateValue('target-speed', targetSpeedKph.toFixed(1));

    const lapMins = Math.floor(targetLapTimeSec / 60);
    const lapSecs = Math.floor(targetLapTimeSec % 60);
    animateValue('target-lap-time', `${lapMins}:${lapSecs.toString().padStart(2, '0')}`);

    // Hedef tur sayısını güncelle
    document.getElementById('total-laps').innerText = targetLaps;

    // Bildirim göster
    showNotification('🏎️ Strateji Hesaplandı',
        `Hedef hız: ${targetSpeedKph.toFixed(1)} km/h | Tur süresi: ${lapMins}:${lapSecs.toString().padStart(2, '0')}`,
        'success', 'fa-check');

    // Pace durumunu güncelle
    updatePaceStatus();
}

// Strateji ekranını günceller (telemetri verisiyle)
function updateStrategyView(data) {
    if (!data.bms) return;

    const voltage = data.bms.voltage_v || 0;
    const current = data.bms.current_a || 0;
    const speed = data.motor?.speed_kph || 0;
    const energyMwh = data.bms.energy_mwh || 0;

    // Anlık güç (W)
    const power = voltage * current;

    // Anlık tüketim (Wh/km) - sadece hareket halindeyken hesapla
    let currentConsumption = 0;
    if (speed > 1) {
        currentConsumption = power / speed;
    }

    // Ortalama tüketim güncelleme (hareketli ortalama)
    if (currentConsumption > 0 && currentConsumption < 200) { // Mantıklı aralıkta
        raceStrategy.avgConsumptionWhKm = raceStrategy.avgConsumptionWhKm * 0.95 + currentConsumption * 0.05;
    }

    // Toplam harcanan enerji (mWh -> Wh)
    const totalConsumedWh = energyMwh / 1000;
    raceStrategy.totalConsumedWh = totalConsumedWh;

    // UI Güncellemeleri
    animateValue('current-wh-km', currentConsumption.toFixed(1));
    animateValue('instant-power', power.toFixed(0) + ' W');
    animateValue('avg-wh-km', raceStrategy.avgConsumptionWhKm.toFixed(1) + ' Wh/km');
    animateValue('total-consumed', totalConsumedWh.toFixed(1) + ' Wh');
    animateValue('current-speed', speed.toFixed(1) + ' km/h');

    // Enerji/Tur hesapla (ortalama)
    if (raceStrategy.currentLap > 0) {
        const energyPerLap = totalConsumedWh / raceStrategy.currentLap;
        animateValue('energy-per-lap', energyPerLap.toFixed(1) + ' Wh');

        // Tahmini toplam enerji
        const projectedTotal = energyPerLap * raceStrategy.targetLaps;
        animateValue('projected-total', projectedTotal.toFixed(0) + ' Wh');

        // Enerji bütçesi bar güncelleme
        updateEnergyBudget(totalConsumedWh, projectedTotal);
    }

    // Pace durumunu güncelle
    updatePaceStatus(speed);
}

// Pace durumunu günceller (hedefe göre hız karşılaştırması)
function updatePaceStatus(currentSpeed = 0) {
    const paceStatus = document.getElementById('pace-status');
    if (!paceStatus) return;

    const targetSpeed = raceStrategy.targetSpeedKph;

    if (targetSpeed <= 0) {
        paceStatus.className = 'pace-detail status-indicator-pace';
        paceStatus.querySelector('.pace-val').innerText = 'Ayarlanmadı';
        return;
    }

    const speedDiff = currentSpeed - targetSpeed;
    const paceVal = paceStatus.querySelector('.pace-val');

    if (Math.abs(speedDiff) < 2) {
        // Hedefte ±2 km/h tolerans
        paceStatus.className = 'pace-detail status-indicator-pace on-target';
        paceVal.innerText = '✓ Hedefte';
    } else if (speedDiff > 0) {
        // Hedefin üstünde
        paceStatus.className = 'pace-detail status-indicator-pace ahead';
        paceVal.innerText = `↑ +${speedDiff.toFixed(1)} km/h`;
    } else {
        // Hedefin altında
        paceStatus.className = 'pace-detail status-indicator-pace behind';
        paceVal.innerText = `↓ ${speedDiff.toFixed(1)} km/h`;
    }
}

// Enerji bütçesi bar güncelleme
function updateEnergyBudget(consumed, projected) {
    const budgetFill = document.getElementById('budget-fill');
    const budgetMarker = document.getElementById('budget-marker');
    const budgetTarget = document.getElementById('budget-target');
    const budgetMax = document.getElementById('budget-max');
    const budgetStatus = document.getElementById('budget-status');

    if (!budgetFill) return;

    // Max enerji tahmini (şimdilik sabit, ileride ayarlanabilir)
    const maxEnergy = projected * 1.5;

    // Yüzde hesapla
    const consumedPct = Math.min((consumed / maxEnergy) * 100, 100);
    const projectedPct = Math.min((projected / maxEnergy) * 100, 100);

    budgetFill.style.width = consumedPct + '%';
    budgetMarker.style.left = projectedPct + '%';

    budgetTarget.innerText = `Hedef: ${projected.toFixed(0)} Wh`;
    budgetMax.innerText = maxEnergy.toFixed(0) + ' Wh';

    // Durum güncelleme
    if (consumed < projected * 0.8) {
        budgetStatus.className = 'budget-status';
        budgetStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Verimli gidiyorsunuz!</span>';
    } else if (consumed < projected) {
        budgetStatus.className = 'budget-status warning';
        budgetStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><span>Hedefe yaklaşıyorsunuz</span>';
    } else {
        budgetStatus.className = 'budget-status danger';
        budgetStatus.innerHTML = '<i class="fa-solid fa-circle-xmark"></i><span>Hedefi aştınız!</span>';
    }
}

// Değer animasyonu ile günceller (smooth counter)
function animateValue(elementId, newValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const valueStr = newValue.toString();
    if (el.innerText !== valueStr) {
        el.classList.add('counting');
        el.innerText = valueStr;
        setTimeout(() => el.classList.remove('counting'), 200);
    }
}

// Strateji notlarını localStorage'a kaydeder
function saveStrategyNotes() {
    const notes = document.getElementById('strategy-notes').value;
    localStorage.setItem('strategyNotes', notes);
    showNotification('📝 Notlar Kaydedildi', 'Yarış notlarınız başarıyla kaydedildi.', 'info', 'fa-check');
}

// Strateji notlarını yükler
function loadStrategyNotes() {
    const notes = localStorage.getItem('strategyNotes');
    if (notes) {
        const textarea = document.getElementById('strategy-notes');
        if (textarea) textarea.value = notes;
    }
}

// ==================== SAYFA BAŞLANGIÇ ====================
// Sayfa yüklendiğinde kimlik doğrulama kontrolü yap
checkAuth();

// Strateji notlarını yükle
loadStrategyNotes();
