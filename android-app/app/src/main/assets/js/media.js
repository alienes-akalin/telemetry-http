// public/js/media.js
// ============================================================
// MEDYA VE GALERİ MODÜLÜ
// ============================================================
// YouTube arama ve Google Drive galeri işlevleri
// Ana dosyadan ayrıştırılmış modül (performans optimizasyonu)
// ============================================================

// Google Apps Script Web App URL'si
// Bu URL, Google Drive klasöründeki fotoğrafları listeler
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyx4-akMy4ifuFqIHzs9KozxU9Sleo4SdooiTHTaprZGXRkDlKr37fGRiQWEDrkaDrMqQ/exec';

// Galeri durum değişkenleri
let currentGalleryImages = [];   // Galeri görsel listesi
let currentImageIndex = 0;       // Lightbox'taki aktif görsel indeksi

/**
 * YouTube'da arama yapar
 * Mobilde YouTube uygulamasını açabilir
 */
function searchYoutube() {
    const query = document.getElementById('yt-search-input').value;
    if (query) {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
    }
}

/**
 * Google Drive'dan takım galerisi fotoğraflarını yükler
 */
async function loadTeamGallery() {
    const grid = document.getElementById('team-gallery-grid');
    if (!grid) return;

    grid.innerHTML = '<p style="color:#ffffff; text-align:center; width:100%;">Google Drive taranıyor...</p>';

    // Script URL'si yapılandırılmamışsa uyarı göster
    if (!GOOGLE_SCRIPT_URL) {
        grid.innerHTML = `
            <div style="text-align:center; width:100%; color:#f59e0b;">
                <p>⚠️ Google Drive Bağlantısı Yapılandırılmadı</p>
                <p style="font-size:0.8rem; color:#94a3b8;">
                    Lütfen "Google Drive Kurulum Rehberi"ndeki adımları takip edin<br>
                    ve oluşturduğunuz <b>Script URL</b>'sini 
                    <code>public/js/media.js</code> dosyasına yapıştırın.
                </p>
            </div>
        `;
        return;
    }

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL);
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
            imgEl.loading = 'lazy';  // Lazy loading
            imgEl.title = img.name || 'Fotoğraf';
            grid.appendChild(imgEl);
        });

    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p style="color:red; text-align:center; width:100%;">Bağlantı Hatası! Script URL kontrol edin.</p>';
    }
}

// ==================== LIGHTBOX (TAM EKRAN GÖRSEL) ====================

/**
 * Lightbox modalını açar ve seçilen görseli gösterir
 * @param {number} index - Gösterilecek görsel indeksi
 */
function openLightbox(index) {
    currentImageIndex = index;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');

    if (lightbox && lightboxImg) {
        lightboxImg.src = currentGalleryImages[currentImageIndex].url;
        lightbox.classList.add('active');
    }
}

/**
 * Lightbox modalını kapatır
 */
function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

/**
 * Lightbox'ta önceki/sonraki görsele geçer
 * @param {number} n - Yön (-1: önceki, 1: sonraki)
 */
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

// ==================== EVENT LISTENERS ====================

// Enter tuşu ile YouTube araması
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('yt-search-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchYoutube();
        });
    }
});

// Klavye kontrolleri (Lightbox için)
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || !lightbox.classList.contains('active')) return;

    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') changeImage(-1);
    if (e.key === 'ArrowRight') changeImage(1);
});
