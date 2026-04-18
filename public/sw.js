// public/sw.js
// ============================================================
// SERVİCE WORKER - PWA (Progressive Web App) Desteği
// ============================================================
// Geliştirilmiş cache stratejileri:
// - Stale-While-Revalidate (CSS/JS için)
// - Cache First (statik asset'ler)
// - Network Only (API)
// - Offline Fallback
// ============================================================

// Önbellek versiyonu - Her güncellemede artırılmalı
const CACHE_NAME = 'telemetri-v123';

// Statik dosyalar - Cache First (sadece ikonlar ve manifest)
const STATIC_ASSETS = [
    '/manifest.json',
    '/img/icon-192.png',
    '/img/icon-512.png',
    '/img/logo_white.png',
    '/img/favicon.png'
];

// Network First için (her zaman ağdan al, offline'da cache'den sun)
const NETWORK_FIRST_ASSETS = [
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/app.min.js'
];

// Offline fallback HTML
const OFFLINE_HTML = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Çevrimdışı - 1.5 Adana Telemetri</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e2e8f0;
        }
        .offline-container {
            text-align: center;
            padding: 2rem;
            background: rgba(30, 41, 59, 0.8);
            border-radius: 20px;
            border: 1px solid rgba(59, 130, 246, 0.3);
            max-width: 400px;
        }
        .offline-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            opacity: 0.7;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #3b82f6; }
        p { color: #94a3b8; margin-bottom: 1rem; }
        .retry-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
        }
        .retry-btn:hover { background: #2563eb; }
    </style>
</head>
<body>
    <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1>Bağlantı Yok</h1>
        <p>İnternet bağlantınızı kontrol edin ve tekrar deneyin.</p>
        <button class="retry-btn" onclick="location.reload()">Yeniden Dene</button>
    </div>
</body>
</html>
`;

// ==================== INSTALL ====================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(err => console.log('[SW] Cache addAll failed:', err))
    );
    self.skipWaiting();
});

// ==================== ACTIVATE ====================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            // Tüm istemcileri hemen kontrol al ve yenile
            return self.clients.claim().then(() => {
                return self.clients.matchAll({ type: 'window' }).then(clients => {
                    clients.forEach(client => client.navigate(client.url));
                });
            });
        })
    );
});

// ==================== FETCH ====================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API ve Socket.io - Network Only
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Network First: HTML, JS ve CSS dosyaları — önce ağdan al, hata olursa cache'den sun
    const isNetworkFirst = url.pathname === '/' ||
        NETWORK_FIRST_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset.split('/').pop()));

    if (isNetworkFirst) {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Diğer statik dosyalar - Cache First with Network Fallback
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                        return response;
                    })
                    .catch(() => {
                        // HTML istekleri için offline fallback
                        if (event.request.headers.get('accept')?.includes('text/html')) {
                            return new Response(OFFLINE_HTML, {
                                headers: { 'Content-Type': 'text/html' }
                            });
                        }
                    });
            })
    );
});

// ==================== BACKGROUND SYNC (Gelecek için) ====================
self.addEventListener('sync', event => {
    if (event.tag === 'sync-telemetry') {
        console.log('[SW] Background sync triggered');
    }
});





