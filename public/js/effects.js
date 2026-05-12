/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  1.5 ADANA Telemetri — Visual Effects Engine v1.0       ║
 * ║  React Bits (DavidHDev) → Vanilla JS Port               ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * 1. SpotlightCard   — kart üzerinde fare spot ışığı
 * 2. CountUp         — sayısal değerlerin animasyonlu sayması
 * 3. ClickSpark      — buton tıklamalarında kıvılcım efekti
 * 4. DotField        — hareketli nokta arka planı (canvas)
 * 5. DecryptedText   — sayfa açılışında metin çözme efekti
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   1. SPOTLIGHT CARD
   Fare kartın üzerinde gezinirken radial gradient spot ışığı
   Kullanım: data-spotlight="true" attribute'u ekle karta
   ───────────────────────────────────────────────────────────── */
function initSpotlightCards() {
    const cards = document.querySelectorAll('[data-spotlight]');
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--spot-x', `${x}px`);
            card.style.setProperty('--spot-y', `${y}px`);
            card.classList.add('spotlight-active');
        });
        card.addEventListener('mouseleave', () => {
            card.classList.remove('spotlight-active');
        });
    });
}


/* ─────────────────────────────────────────────────────────────
   2. COUNT-UP ANIMATION
   Sayısal değer değiştiğinde smooth sayma animasyonu.
   Mevcut animateValue fonksiyonunu upgrade eder.
   ───────────────────────────────────────────────────────────── */
const _countUpAnimations = new Map(); // elementId → rafId

function countUpTo(el, targetStr, duration = 350) {
    if (!el) return;

    // Sayısal olmayan string'lerde direkt yaz
    const targetNum = parseFloat(targetStr);
    if (isNaN(targetNum)) {
        el.textContent = targetStr;
        return;
    }

    const currentNum = parseFloat(el.textContent) || 0;
    const diff = targetNum - currentNum;
    if (Math.abs(diff) < 0.01) return; // Fark çok küçük, gerek yok

    // Önceki animasyonu iptal et
    if (_countUpAnimations.has(el.id)) {
        cancelAnimationFrame(_countUpAnimations.get(el.id));
    }

    const startTime = performance.now();
    const decimals = (targetStr.split('.')[1] || '').length;

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = currentNum + diff * ease;
        el.textContent = current.toFixed(decimals);

        if (progress < 1) {
            _countUpAnimations.set(el.id, requestAnimationFrame(step));
        } else {
            el.textContent = targetStr;
            _countUpAnimations.delete(el.id);
        }
    }

    _countUpAnimations.set(el.id, requestAnimationFrame(step));
}

// Mevcut animateValue fonksiyonunu CountUp ile upgrade et
function upgradeAnimateValue() {
    const originalAnimateValue = window.animateValue;
    if (!originalAnimateValue) return;

    window.animateValue = function(elementId, newValue) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const valueStr = newValue.toString();
        if (el.textContent === valueStr) return;

        // Sayısal ise countUp, değilse direkt değiştir
        const num = parseFloat(valueStr);
        if (!isNaN(num) && !valueStr.includes(':')) {
            countUpTo(el, valueStr, 300);
        } else {
            // Orijinal davranışı kullan
            originalAnimateValue(elementId, newValue);
        }
    };
}


/* ─────────────────────────────────────────────────────────────
   3. CLICK SPARK
   Butona tıklandığında tıklanan noktadan kıvılcım parçacıkları
   Kullanım: data-spark="true" attribute'u ekle butona
   ───────────────────────────────────────────────────────────── */
function initClickSparks() {
    // Hem data-spark butonlarına hem de tüm .sw-btn butonlara uygula
    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-spark], .sw-btn, .params-btn-apply, .btn-simulate, #btn-run-sim');
        if (!btn) return;
        spawnSparks(e.clientX, e.clientY, btn);
    });
}

function spawnSparks(x, y, sourceEl) {
    const colors = ['#6366f1', '#818cf8', '#a5b4fc', '#34d399', '#60a5fa', '#f59e0b'];
    const count = 10;

    for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.className = 'click-spark-particle';

        // Rastgele açı ve mesafe
        const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
        const distance = 28 + Math.random() * 36;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        const size = 3 + Math.random() * 4;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const duration = 400 + Math.random() * 200;

        Object.assign(spark.style, {
            left: x + 'px',
            top: y + 'px',
            width: size + 'px',
            height: size + 'px',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            '--dx': dx + 'px',
            '--dy': dy + 'px',
            animationDuration: duration + 'ms',
        });

        document.body.appendChild(spark);

        // Animasyon bitince temizle
        spark.addEventListener('animationend', () => spark.remove());
    }
}


/* ─────────────────────────────────────────────────────────────
   4. DOT FIELD BACKGROUND
   Dashboard arka planında yavaş hareket eden nokta ağı (canvas)
   ───────────────────────────────────────────────────────────── */
let dotFieldCanvas = null;
let dotFieldCtx = null;
let dotFieldAnimId = null;

function initDotField() {
    const existing = document.getElementById('dot-field-canvas');
    if (existing) return; // Zaten var

    dotFieldCanvas = document.createElement('canvas');
    dotFieldCanvas.id = 'dot-field-canvas';
    Object.assign(dotFieldCanvas.style, {
        position: 'fixed',
        top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '0',
        pointerEvents: 'none',
        opacity: '0.18',
    });

    // Main layout'un arkasına ekle
    const appWrapper = document.querySelector('.app-wrapper') || document.body;
    appWrapper.insertBefore(dotFieldCanvas, appWrapper.firstChild);

    dotFieldCtx = dotFieldCanvas.getContext('2d');
    resizeDotField();
    window.addEventListener('resize', resizeDotField);
    animateDotField();
}

const DOT_SPACING = 34;
let dotFieldOffset = { x: 0, y: 0 };
let dotFieldMouse = { x: -9999, y: -9999 };

function resizeDotField() {
    if (!dotFieldCanvas) return;
    dotFieldCanvas.width = window.innerWidth;
    dotFieldCanvas.height = window.innerHeight;
}

function animateDotField() {
    if (!dotFieldCtx || !dotFieldCanvas) return;
    const W = dotFieldCanvas.width;
    const H = dotFieldCanvas.height;

    dotFieldCtx.clearRect(0, 0, W, H);

    dotFieldOffset.x = (dotFieldOffset.x + 0.12) % DOT_SPACING;
    dotFieldOffset.y = (dotFieldOffset.y + 0.06) % DOT_SPACING;

    const isLight = document.body.classList.contains('light-mode');
    const dotColor = isLight ? '51,65,85' : '148,163,184';

    for (let x = -DOT_SPACING; x < W + DOT_SPACING; x += DOT_SPACING) {
        for (let y = -DOT_SPACING; y < H + DOT_SPACING; y += DOT_SPACING) {
            const px = x + dotFieldOffset.x;
            const py = y + dotFieldOffset.y;

            dotFieldCtx.beginPath();
            dotFieldCtx.arc(px, py, 1.2, 0, Math.PI * 2);
            dotFieldCtx.fillStyle = `rgba(${dotColor}, 0.7)`;
            dotFieldCtx.fill();
        }
    }

    dotFieldAnimId = requestAnimationFrame(animateDotField);
}


/* ─────────────────────────────────────────────────────────────
   5. DECRYPTED TEXT
   Sayfa ilk açıldığında başlık metni rastgele karakterlerden
   gerçek metne "çözülüyor" efekti
   ───────────────────────────────────────────────────────────── */
const DECRYPT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>';

function decryptText(el, finalText, duration = 1200, delay = 0) {
    if (!el) return;
    const chars = finalText.split('');
    let frame = 0;
    const totalFrames = Math.round(duration / 40);

    setTimeout(() => {
        const interval = setInterval(() => {
            frame++;
            const progress = frame / totalFrames;

            el.textContent = chars.map((char, i) => {
                // Her karakter, kendi pozisyonuna göre farklı sürede çözülür
                const revealAt = (i / chars.length) * 0.75; // 0.75 ile tüm süre dolmadan biter
                if (progress > revealAt + 0.15) {
                    return char; // Çözüldü
                }
                if (char === ' ') return ' ';
                return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
            }).join('');

            if (frame >= totalFrames) {
                clearInterval(interval);
                el.textContent = finalText;
            }
        }, 40);
    }, delay);
}

function initDecryptedText() {
    // Logo ana metni
    const logoMain = document.querySelector('.logo-main');
    if (logoMain) {
        const originalText = logoMain.textContent;
        decryptText(logoMain, originalText, 1000, 300);
    }

    // Mobil logo metni de varsa
    document.querySelectorAll('.logo-main').forEach((el, idx) => {
        const originalText = el.textContent;
        decryptText(el, originalText, 1000, 300 + idx * 100);
    });

    // Sayfa başlığındaki h3'ler (ilk yüklendiğinde aktif view)
    const activeH3 = document.querySelector('.view.active h3, #view-dashboard h3');
    if (activeH3) {
        const txt = activeH3.textContent.trim();
        decryptText(activeH3, txt, 800, 600);
    }
}


/* ─────────────────────────────────────────────────────────────
   BAŞLATICI
   DOM hazır olduğunda tüm efektleri başlat
   ───────────────────────────────────────────────────────────── */
function initAllEffects() {
    initDotField();
    initSpotlightCards();
    initClickSparks();
    upgradeAnimateValue();
    initDecryptedText();

    // Spotlight: dinamik olarak oluşturulan kartlara da uygula (MutationObserver)
    const observer = new MutationObserver(() => {
        initSpotlightCards();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllEffects);
} else {
    // DOM zaten hazır
    setTimeout(initAllEffects, 100);
}
