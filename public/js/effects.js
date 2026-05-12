/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  1.5 ADANA Telemetri — Visual Effects Engine v2.0           ║
 * ║  React Bits Port + Aceternity UI + GSAP-style + Lenis       ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  1. SpotlightCard   — kart fare spotlight efekti            ║
 * ║  2. CountUp         — smooth sayısal animasyon              ║
 * ║  3. ClickSpark      — buton kıvılcım efekti                 ║
 * ║  4. DotField        — hareketli nokta arka planı            ║
 * ║  5. DecryptedText   — metin çözme animasyonu                ║
 * ║  6. MovingBorder    — dönen gradyan kenar animasyonu (yeni) ║
 * ║  7. GSAP Transitions— sekme geçişi animasyonları  (yeni)   ║
 * ║  8. Lenis Scroll    — pürüzsüz kaydırma          (yeni)    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   6. MOVING BORDER (Aceternity UI Port)
   Kritik/uyarı kartlarında dönen konik gradyan kenarlık.
   JS, CSS @property (Houdini) ve requestAnimationFrame kullanır.
   ═══════════════════════════════════════════════════════════════ */
const _movingBorders = [];

function initMovingBorders() {
    // Uygulanacak kartlar: critical stat-card, warning stat-card ve alert sınıflı öğeler
    const targets = document.querySelectorAll(
        '.stat-card.critical, .stat-card.warning, [data-moving-border]'
    );

    targets.forEach(el => {
        if (el.dataset.mbInited) return;
        el.dataset.mbInited = 'true';

        // Wrapper: mevcut kartı sarmala
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-wrapper';
        // Orijinal boyutları koru
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);

        // Dönen kenarlık canvas'ı
        const canvas = document.createElement('canvas');
        canvas.className = 'mb-canvas';
        wrapper.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        let angle = Math.random() * Math.PI * 2; // Her kart farklı açıdan başlasın
        let animId = null;
        let isActive = true;

        // Renge göre gradyan renkleri belirle
        const isCritical = el.classList.contains('critical');
        const color1 = isCritical ? '#ef4444' : '#f59e0b';
        const color2 = isCritical ? '#7c3aed' : '#f97316';
        const color3 = isCritical ? '#3b82f6' : '#fbbf24';

        function resize() {
            canvas.width  = wrapper.offsetWidth;
            canvas.height = wrapper.offsetHeight;
        }

        function draw() {
            if (!isActive) return;
            resize();
            const W = canvas.width;
            const H = canvas.height;
            ctx.clearRect(0, 0, W, H);

            angle += 0.008; // Dönüş hızı

            const cx = W / 2;
            const cy = H / 2;
            const r  = Math.max(W, H) * 0.75;

            // Dönen konik gradyan simülasyonu (iki nokta arasında yay)
            const x1 = cx + Math.cos(angle) * r;
            const y1 = cy + Math.sin(angle) * r;
            const x2 = cx + Math.cos(angle + Math.PI) * r;
            const y2 = cy + Math.sin(angle + Math.PI) * r;

            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0,   color1 + '00');
            grad.addColorStop(0.3, color1 + 'CC');
            grad.addColorStop(0.5, color2 + 'FF');
            grad.addColorStop(0.7, color3 + 'CC');
            grad.addColorStop(1,   color3 + '00');

            const bw = 2; // kenar kalınlığı (piksel)
            const br = parseFloat(getComputedStyle(el).borderRadius) || 12;

            // Dış kenar yolu
            roundRect(ctx, 0, 0, W, H, br);
            ctx.save();
            ctx.clip();

            // Gradyan ile doldur
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();

            // İç kısımı sil (sadece kenar kalsın)
            ctx.clearRect(bw, bw, W - bw * 2, H - bw * 2);

            animId = requestAnimationFrame(draw);
        }

        _movingBorders.push({ stop: () => { isActive = false; cancelAnimationFrame(animId); } });
        draw();

        // Resize observer
        new ResizeObserver(resize).observe(wrapper);
    });
}

// Canvas'ta yuvarlak dikdörtgen çizer
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}


/* ═══════════════════════════════════════════════════════════════
   7. GSAP-STYLE PAGE TRANSITIONS
   GSAP CDN yüklüyse kullan, yoksa kendi fallback animasyonumuzu
   çalıştır. İkisi de aynı sonucu verir.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Bir view elemanını animasyonlu olarak gösterir.
 * @param {HTMLElement} el  - Gösterilecek view
 * @param {string} from     - 'left' | 'right' | 'up' (eski view nereye gitti)
 */
function animateViewIn(el, direction = 'up') {
    if (!el) return;

    const keyframes = {
        up:    [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }],
        down:  [{ opacity: 0, transform: 'translateY(-18px)'}, { opacity: 1, transform: 'translateY(0)' }],
        left:  [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'translateX(0)' }],
        right: [{ opacity: 0, transform: 'translateX(-24px)'}, { opacity: 1, transform: 'translateX(0)' }],
    };

    const frames = keyframes[direction] || keyframes.up;

    // Web Animations API (tüm modern tarayıcılarda çalışır, GSAP olmadan)
    el.animate(frames, {
        duration: 320,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)', // Framer Motion'dan "spring" benzeri ease
        fill: 'both',
    });
}

/**
 * Bir view'in içindeki kartları stagger (sırayla) animasyonla gösterir.
 * @param {HTMLElement} viewEl
 */
function staggerCardsIn(viewEl) {
    if (!viewEl) return;
    const cards = viewEl.querySelectorAll(
        '.stat-card, .card, .chart-wrapper, .strategy-card, .mb-wrapper'
    );

    cards.forEach((card, i) => {
        card.animate(
            [
                { opacity: 0, transform: 'translateY(14px) scale(0.98)' },
                { opacity: 1, transform: 'translateY(0)   scale(1)'    },
            ],
            {
                duration: 280,
                delay: i * 55,  // Her kart 55ms sonra başlar (stagger)
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Hafif spring overshoot
                fill: 'both',
            }
        );
    });
}

/**
 * Nav geçişini ele alır — eski view'i çıkar, yeni view'i içeri alır.
 * app.js'deki nav click handler'ın ÖNÜNDE çağrılır.
 */
function hookViewTransitions() {
    const navItems = document.querySelectorAll('.nav-item');
    if (!navItems.length) return;

    navItems.forEach(item => {
        // Capture phase'de çalışsın ki app.js'den önce yakalasin
        item.addEventListener('click', () => {
            const targetPage = item.dataset.page;
            if (!targetPage) return;

            const newView = document.getElementById(`view-${targetPage}`);
            if (!newView) return;

            // Kısa bir delay ver (app.js'nin DOM'u güncellemesi için)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    animateViewIn(newView, 'up');
                    // Stagger'ı çok kısa bir gecikme ile başlat
                    setTimeout(() => staggerCardsIn(newView), 30);
                });
            });
        }, true); // useCapture: true → app.js'den önce tetiklenir
    });
}


/* ═══════════════════════════════════════════════════════════════
   8. LENIS SMOOTH SCROLL
   Lenis kütüphanesi CDN'den yüklü ise kullanır.
   Yoksa native smooth scroll'u aktifleştirir (CSS ile).
   ═══════════════════════════════════════════════════════════════ */
let lenisInstance = null;

function initLenis() {
    // Lenis CDN'den yüklüyse
    if (typeof Lenis !== 'undefined') {
        lenisInstance = new Lenis({
            duration: 1.1,
            easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Exponential ease-out
            direction: 'vertical',
            gestureDirection: 'vertical',
            smooth: true,
            mouseMultiplier: 0.9,
            smoothTouch: false,    // Mobilde native scroll daha iyi
            touchMultiplier: 2,
            infinite: false,
        });

        function lenisRaf(time) {
            lenisInstance.raf(time);
            requestAnimationFrame(lenisRaf);
        }
        requestAnimationFrame(lenisRaf);
    } else {
        // Fallback: CSS native smooth scroll
        const style = document.createElement('style');
        style.textContent = `
            html { scroll-behavior: smooth; }
            .main-content, .card-body.scrollable {
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
            }
        `;
        document.head.appendChild(style);
    }
}


/* ═══════════════════════════════════════════════════════════════
   1. SPOTLIGHT CARD (v1'den taşındı, iyileştirildi)
   ═══════════════════════════════════════════════════════════════ */
function initSpotlightCards() {
    const selector = '.stat-card, .card, .chart-wrapper, [data-spotlight]';

    // Event delegation ile tüm kartları yakala
    document.addEventListener('mousemove', e => {
        const card = e.target.closest(selector);
        if (!card) {
            // Üzerinde kart yoksa aktif olanları temizle
            document.querySelectorAll('.spotlight-active').forEach(c => {
                c.classList.remove('spotlight-active');
            });
            return;
        }
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
        card.classList.add('spotlight-active');
    });

    document.addEventListener('mouseleave', () => {
        document.querySelectorAll('.spotlight-active').forEach(c => {
            c.classList.remove('spotlight-active');
        });
    }, true);
}


/* ═══════════════════════════════════════════════════════════════
   2. COUNT-UP ANIMATION (v1'den taşındı)
   ═══════════════════════════════════════════════════════════════ */
const _countUpAnimations = new Map();

function countUpTo(el, targetStr, duration = 350) {
    if (!el) return;
    const targetNum = parseFloat(targetStr);
    if (isNaN(targetNum)) { el.textContent = targetStr; return; }

    const currentNum = parseFloat(el.textContent) || 0;
    const diff = targetNum - currentNum;
    if (Math.abs(diff) < 0.005) return;

    if (_countUpAnimations.has(el.id)) {
        cancelAnimationFrame(_countUpAnimations.get(el.id));
    }

    const startTime = performance.now();
    const decimals = (targetStr.split('.')[1] || '').length;

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
        el.textContent = (currentNum + diff * ease).toFixed(decimals);
        if (progress < 1) {
            _countUpAnimations.set(el.id, requestAnimationFrame(step));
        } else {
            el.textContent = targetStr;
            _countUpAnimations.delete(el.id);
        }
    }
    _countUpAnimations.set(el.id, requestAnimationFrame(step));
}

function upgradeAnimateValue() {
    const originalAnimateValue = window.animateValue;
    if (!originalAnimateValue) return;

    window.animateValue = function(elementId, newValue) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const valueStr = newValue.toString();
        if (el.textContent === valueStr) return;

        const num = parseFloat(valueStr);
        if (!isNaN(num) && !valueStr.includes(':')) {
            countUpTo(el, valueStr, 300);
        } else {
            originalAnimateValue(elementId, newValue);
        }
    };
}


/* ═══════════════════════════════════════════════════════════════
   3. CLICK SPARK (v1'den taşındı)
   ═══════════════════════════════════════════════════════════════ */
function initClickSparks() {
    document.addEventListener('click', e => {
        const btn = e.target.closest('.sw-btn, .params-btn-apply, #btn-run-sim, [data-spark]');
        if (!btn) return;
        spawnSparks(e.clientX, e.clientY);
    });
}

function spawnSparks(x, y) {
    const colors = ['#6366f1', '#818cf8', '#a5b4fc', '#34d399', '#60a5fa', '#f59e0b', '#f97316'];
    for (let i = 0; i < 10; i++) {
        const spark = document.createElement('div');
        spark.className = 'click-spark-particle';
        const angle = (Math.PI * 2 / 10) * i + (Math.random() - 0.5) * 0.6;
        const dist  = 28 + Math.random() * 38;
        const size  = 3 + Math.random() * 4;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const dur   = 400 + Math.random() * 200;

        Object.assign(spark.style, {
            left: x + 'px', top: y + 'px',
            width: size + 'px', height: size + 'px',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist}px`,
            animationDuration: dur + 'ms',
        });
        document.body.appendChild(spark);
        spark.addEventListener('animationend', () => spark.remove());
    }
}


/* ═══════════════════════════════════════════════════════════════
   4. DOT FIELD BACKGROUND (v1'den taşındı)
   ═══════════════════════════════════════════════════════════════ */
let dotFieldCanvas = null;
let dotFieldCtx    = null;
let dotFieldAnimId = null;
const DOT_SPACING  = 34;
let dotOffset      = { x: 0, y: 0 };

function initDotField() {
    if (document.getElementById('dot-field-canvas')) return;

    dotFieldCanvas = document.createElement('canvas');
    dotFieldCanvas.id = 'dot-field-canvas';
    Object.assign(dotFieldCanvas.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '0', pointerEvents: 'none', opacity: '0.15',
    });
    document.body.insertBefore(dotFieldCanvas, document.body.firstChild);
    dotFieldCtx = dotFieldCanvas.getContext('2d');

    function resize() {
        dotFieldCanvas.width  = window.innerWidth;
        dotFieldCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
        const W = dotFieldCanvas.width, H = dotFieldCanvas.height;
        dotFieldCtx.clearRect(0, 0, W, H);
        dotOffset.x = (dotOffset.x + 0.10) % DOT_SPACING;
        dotOffset.y = (dotOffset.y + 0.05) % DOT_SPACING;

        const isLight = document.body.classList.contains('light-mode');
        const c = isLight ? '51,65,85' : '148,163,184';

        for (let x = -DOT_SPACING; x < W + DOT_SPACING; x += DOT_SPACING) {
            for (let y = -DOT_SPACING; y < H + DOT_SPACING; y += DOT_SPACING) {
                dotFieldCtx.beginPath();
                dotFieldCtx.arc(x + dotOffset.x, y + dotOffset.y, 1.1, 0, Math.PI * 2);
                dotFieldCtx.fillStyle = `rgba(${c}, 0.65)`;
                dotFieldCtx.fill();
            }
        }
        dotFieldAnimId = requestAnimationFrame(draw);
    }
    draw();
}


/* ═══════════════════════════════════════════════════════════════
   5. DECRYPTED TEXT (v1'den taşındı)
   ═══════════════════════════════════════════════════════════════ */
const DECRYPT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%!?<>';

function decryptText(el, finalText, duration = 1100, delay = 0) {
    if (!el || !finalText) return;
    const chars = finalText.split('');

    setTimeout(() => {
        let frame = 0;
        const totalFrames = Math.round(duration / 38);
        const interval = setInterval(() => {
            frame++;
            const progress = frame / totalFrames;
            el.textContent = chars.map((char, i) => {
                if (char === ' ') return ' ';
                const revealAt = (i / chars.length) * 0.75;
                if (progress > revealAt + 0.15) return char;
                return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
            }).join('');

            if (frame >= totalFrames) {
                clearInterval(interval);
                el.textContent = finalText;
            }
        }, 38);
    }, delay);
}

function initDecryptedText() {
    document.querySelectorAll('.logo-main').forEach((el, i) => {
        const txt = el.textContent;
        decryptText(el, txt, 950, 250 + i * 80);
    });
}


/* ═══════════════════════════════════════════════════════════════
   ANA BAŞLATICI
   ═══════════════════════════════════════════════════════════════ */
function initAllEffects() {
    // Sıra önemli: önce scroll, sonra görsel efektler
    initLenis();
    initDotField();
    initSpotlightCards();
    initClickSparks();
    upgradeAnimateValue();
    initDecryptedText();
    hookViewTransitions();

    // Moving Border: biraz gecikmeyle başlat (DOM tam hazır olsun)
    setTimeout(initMovingBorders, 400);

    // Dinamik eklenen kartlar için Moving Border'ı tekrar çalıştır
    const mbObserver = new MutationObserver(() => {
        initMovingBorders();
    });
    mbObserver.observe(document.body, { childList: true, subtree: true });

    // İlk açılışta aktif view için stagger animasyonu
    const activeView = document.querySelector('.view.active') || document.getElementById('view-dashboard');
    if (activeView) {
        setTimeout(() => staggerCardsIn(activeView), 200);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllEffects);
} else {
    setTimeout(initAllEffects, 80);
}
