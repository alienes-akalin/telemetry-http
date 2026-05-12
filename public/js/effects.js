/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  1.5 ADANA Telemetri — Visual Effects Engine v2.1 (SAFE)   ║
 * ║                                                              ║
 * ║  [DÜZELTME] DOM manipülasyonu kaldırıldı → layout güvenli  ║
 * ║  [DÜZELTME] Stagger fill:'forwards' → görünmezlik yok      ║
 * ║  [DÜZELTME] Lenis yalnızca main-content'e uygulandı        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════
   6. MOVING BORDER — GÜVENLİ VERSİYON
   DOM manipülasyonu YOK. Kart üzerine position:absolute canvas
   eklenir, layout değişmez. data-mb-inited ile tekrar çalışmaz.
   ═══════════════════════════════════════════════════════════════ */
function initMovingBorders() {
    const targets = document.querySelectorAll(
        '.stat-card.critical:not([data-mb-inited]), .stat-card.warning:not([data-mb-inited])'
    );

    targets.forEach(el => {
        el.setAttribute('data-mb-inited', 'true');

        // Kartın position'ı zaten relative — CSS'de ayarlı
        // DOM'a WRAPPER EKLEMİYORUZ. Doğrudan card'a canvas ekliyoruz.
        const canvas = document.createElement('canvas');
        canvas.className = 'mb-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        // Canvas'ı kartın ilk child'ı yap (z-index:0 → içerik üstte kalır)
        el.insertBefore(canvas, el.firstChild);

        const ctx   = canvas.getContext('2d');
        let angle   = Math.random() * Math.PI * 2;
        let rafId   = null;
        let running = true;

        const isCrit = el.classList.contains('critical');
        const c1 = isCrit ? '#ef4444' : '#f59e0b';
        const c2 = isCrit ? '#7c3aed' : '#f97316';
        const c3 = isCrit ? '#60a5fa' : '#fbbf24';

        function resize() {
            canvas.width  = el.offsetWidth;
            canvas.height = el.offsetHeight;
        }

        function draw() {
            if (!running) return;
            resize();
            const W = canvas.width, H = canvas.height;
            if (!W || !H) { rafId = requestAnimationFrame(draw); return; }

            ctx.clearRect(0, 0, W, H);
            angle += 0.007;

            const cx = W / 2, cy = H / 2;
            const r  = Math.max(W, H) * 0.8;
            const x1 = cx + Math.cos(angle) * r;
            const y1 = cy + Math.sin(angle) * r;
            const x2 = cx + Math.cos(angle + Math.PI) * r;
            const y2 = cy + Math.sin(angle + Math.PI) * r;

            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0,   c1 + '00');
            grad.addColorStop(0.3, c1 + 'BB');
            grad.addColorStop(0.5, c2 + 'EE');
            grad.addColorStop(0.7, c3 + 'BB');
            grad.addColorStop(1,   c3 + '00');

            const bw = 2; // kenar kalınlığı px
            const br = 14; // border-radius

            // Sadece kenar şeridini boya
            ctx.save();
            _roundRectPath(ctx, 0, 0, W, H, br);
            ctx.clip();
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
            // İç alanı temizle (sadece kenar kalır)
            ctx.clearRect(bw, bw, W - bw * 2, H - bw * 2);
            ctx.restore();

            rafId = requestAnimationFrame(draw);
        }

        draw();

        // Sayfa görünürlüğünde pause/resume (batarya tasarrufu)
        document.addEventListener('visibilitychange', () => {
            running = !document.hidden;
            if (running) draw();
        });
    });
}

function _roundRectPath(ctx, x, y, w, h, r) {
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
   7. GSAP-STYLE PAGE TRANSITIONS — GÜVENLİ VERSİYON
   - fill:'forwards' kullanılır (opacity:0 başlangıç kalmaz)
   - Stagger sadece görünür kartlara uygulanır
   - app.js flow'unu kesmez
   ═══════════════════════════════════════════════════════════════ */

function animateViewIn(el) {
    if (!el) return;
    el.animate(
        [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'translateY(0)'    },
        ],
        {
            duration: 280,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'forwards',
        }
    );
}

function staggerCardsIn(viewEl) {
    if (!viewEl) return;

    // Yalnızca doğrudan görünür kartlar — iç içe geçmiş kartları dışla
    const cards = Array.from(viewEl.querySelectorAll(
        ':scope > * .stat-card, :scope > * .card:not(.stat-card)'
    )).slice(0, 12); // max 12 kart (performans)

    cards.forEach((card, i) => {
        card.animate(
            [
                { opacity: 0, transform: 'translateY(10px)' },
                { opacity: 1, transform: 'translateY(0)'    },
            ],
            {
                duration: 240,
                delay: Math.min(i * 45, 400), // max toplam delay: 400ms
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'forwards',
            }
        );
    });
}

function hookViewTransitions() {
    // useCapture:false — app.js'nin işini bitirmesini BEKLE
    // RAF double-buffer ile animasyon sıralaması güvenli
    document.addEventListener('click', e => {
        const navItem = e.target.closest('.nav-item[data-page]');
        if (!navItem) return;
        const page = navItem.dataset.page;

        // app.js DOM'u güncelledikten sonra animasyonu başlat
        // app.js click handler'ı sync çalıştığı için 2×rAF yeterli
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const view = document.getElementById(`view-${page}`);
                if (view && view.classList.contains('active')) {
                    animateViewIn(view);
                    setTimeout(() => staggerCardsIn(view), 40);
                }
            });
        });
    });
}


/* ═══════════════════════════════════════════════════════════════
   8. LENIS SMOOTH SCROLL — GÜVENLİ VERSİYON
   Yalnızca .main-content scroll'una uygulanır.
   Leaflet ve diğer scroll container'lar etkilenmez.
   ═══════════════════════════════════════════════════════════════ */
let lenisInstance = null;

function initLenis() {
    if (typeof Lenis === 'undefined') {
        // Lenis yüklü değil — sessizce geç
        return;
    }

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    try {
        lenisInstance = new Lenis({
            wrapper: mainContent,     // Yalnızca main-content'e uygula
            content: mainContent.firstElementChild || mainContent,
            duration: 1.0,
            easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothTouch: false,       // Mobilde native
            syncTouch: false,
            prevent: el => {          // Bu elementleri Lenis'ten muaf tut
                return (
                    el.closest('#main-map')      ||
                    el.closest('#full-map')       ||
                    el.closest('.leaflet-container') ||
                    el.closest('.card-body.scrollable') ||
                    el.closest('[data-lenis-prevent]')
                );
            },
        });

        function lenisRaf(time) {
            lenisInstance.raf(time);
            requestAnimationFrame(lenisRaf);
        }
        requestAnimationFrame(lenisRaf);

    } catch (err) {
        // Lenis init başarısız oldu — sessizce geç, uygulama çalışmaya devam eder
        lenisInstance = null;
    }
}


/* ═══════════════════════════════════════════════════════════════
   1. SPOTLIGHT CARD
   ═══════════════════════════════════════════════════════════════ */
function initSpotlightCards() {
    const SELECTOR = '.stat-card, .card, [data-spotlight]';

    document.addEventListener('mousemove', e => {
        const card = e.target.closest(SELECTOR);
        if (!card || card.closest('#main-map, #full-map, .leaflet-container')) return;

        const rect = card.getBoundingClientRect();
        card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);

        if (!card.classList.contains('spotlight-active')) {
            // Diğer aktif spotlight'ları kapat
            document.querySelectorAll('.spotlight-active').forEach(c => {
                if (c !== card) c.classList.remove('spotlight-active');
            });
            card.classList.add('spotlight-active');
        }
    });

    document.addEventListener('mouseleave', () => {
        document.querySelectorAll('.spotlight-active').forEach(c =>
            c.classList.remove('spotlight-active')
        );
    }, { capture: true });
}


/* ═══════════════════════════════════════════════════════════════
   2. COUNT-UP
   ═══════════════════════════════════════════════════════════════ */
const _countUpMap = new Map();

function countUpTo(el, targetStr, duration = 320) {
    if (!el) return;
    const targetNum = parseFloat(targetStr);
    if (isNaN(targetNum)) { el.textContent = targetStr; return; }

    const currentNum = parseFloat(el.textContent) || 0;
    const diff = targetNum - currentNum;
    if (Math.abs(diff) < 0.005) return;

    if (_countUpMap.has(el.id)) cancelAnimationFrame(_countUpMap.get(el.id));

    const t0 = performance.now();
    const dec = (targetStr.split('.')[1] || '').length;

    function step(now) {
        const p = Math.min((now - t0) / duration, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = (currentNum + diff * e).toFixed(dec);
        if (p < 1) {
            _countUpMap.set(el.id, requestAnimationFrame(step));
        } else {
            el.textContent = targetStr;
            _countUpMap.delete(el.id);
        }
    }
    _countUpMap.set(el.id, requestAnimationFrame(step));
}

function upgradeAnimateValue() {
    const orig = window.animateValue;
    if (!orig) return;
    window.animateValue = function(elementId, newValue) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const s = newValue.toString();
        if (el.textContent === s) return;
        const n = parseFloat(s);
        if (!isNaN(n) && !s.includes(':')) {
            countUpTo(el, s, 300);
        } else {
            orig(elementId, newValue);
        }
    };
}


/* ═══════════════════════════════════════════════════════════════
   3. CLICK SPARK
   ═══════════════════════════════════════════════════════════════ */
function initClickSparks() {
    document.addEventListener('click', e => {
        const btn = e.target.closest('.sw-btn, .params-btn-apply, #btn-run-sim, [data-spark]');
        if (!btn) return;
        _spawnSparks(e.clientX, e.clientY);
    });
}

function _spawnSparks(x, y) {
    const colors = ['#6366f1', '#818cf8', '#34d399', '#60a5fa', '#f59e0b', '#f97316'];
    for (let i = 0; i < 8; i++) {
        const sp = document.createElement('div');
        sp.className = 'click-spark-particle';
        const angle = (Math.PI * 2 / 8) * i + (Math.random() - 0.5) * 0.5;
        const dist  = 24 + Math.random() * 32;
        const color = colors[i % colors.length];
        const dur   = 380 + Math.random() * 180;
        Object.assign(sp.style, {
            left: x + 'px', top: y + 'px',
            width:  (3 + Math.random() * 3) + 'px',
            height: (3 + Math.random() * 3) + 'px',
            background: color,
            boxShadow: `0 0 5px ${color}`,
            '--dx': `${Math.cos(angle) * dist}px`,
            '--dy': `${Math.sin(angle) * dist}px`,
            animationDuration: dur + 'ms',
        });
        document.body.appendChild(sp);
        sp.addEventListener('animationend', () => sp.remove(), { once: true });
    }
}


/* ═══════════════════════════════════════════════════════════════
   4. DOT FIELD
   ═══════════════════════════════════════════════════════════════ */
const DOT_SPACING = 34;
let _dotOffset = { x: 0, y: 0 };
let _dotCanvas  = null;
let _dotCtx     = null;

function initDotField() {
    if (document.getElementById('dot-field-canvas')) return;

    _dotCanvas = document.createElement('canvas');
    _dotCanvas.id = 'dot-field-canvas';
    Object.assign(_dotCanvas.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '0', pointerEvents: 'none', opacity: '0.14',
    });
    document.body.insertBefore(_dotCanvas, document.body.firstChild);
    _dotCtx = _dotCanvas.getContext('2d');

    const resize = () => {
        _dotCanvas.width  = window.innerWidth;
        _dotCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    (function draw() {
        const W = _dotCanvas.width, H = _dotCanvas.height;
        _dotCtx.clearRect(0, 0, W, H);
        _dotOffset.x = (_dotOffset.x + 0.09) % DOT_SPACING;
        _dotOffset.y = (_dotOffset.y + 0.045) % DOT_SPACING;
        const light = document.body.classList.contains('light-mode');
        const c = light ? '51,65,85' : '148,163,184';
        for (let x = -DOT_SPACING; x < W + DOT_SPACING; x += DOT_SPACING) {
            for (let y = -DOT_SPACING; y < H + DOT_SPACING; y += DOT_SPACING) {
                _dotCtx.beginPath();
                _dotCtx.arc(x + _dotOffset.x, y + _dotOffset.y, 1.1, 0, Math.PI * 2);
                _dotCtx.fillStyle = `rgba(${c},0.6)`;
                _dotCtx.fill();
            }
        }
        requestAnimationFrame(draw);
    })();
}


/* ═══════════════════════════════════════════════════════════════
   5. DECRYPTED TEXT
   ═══════════════════════════════════════════════════════════════ */
const _CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%!?';

function decryptText(el, finalText, duration, delay) {
    if (!el || !finalText) return;
    const chars = finalText.split('');
    setTimeout(() => {
        let f = 0;
        const total = Math.round(duration / 38);
        const iv = setInterval(() => {
            f++;
            const p = f / total;
            el.textContent = chars.map((ch, i) => {
                if (ch === ' ') return ' ';
                if (p > (i / chars.length) * 0.75 + 0.15) return ch;
                return _CHARS[Math.floor(Math.random() * _CHARS.length)];
            }).join('');
            if (f >= total) { clearInterval(iv); el.textContent = finalText; }
        }, 38);
    }, delay);
}

function initDecryptedText() {
    document.querySelectorAll('.logo-main').forEach((el, i) => {
        const txt = el.textContent;
        decryptText(el, txt, 900, 250 + i * 70);
    });
}


/* ═══════════════════════════════════════════════════════════════
   BAŞLATICI
   ═══════════════════════════════════════════════════════════════ */
function initAllEffects() {
    initDotField();          // Arka plan (DOM'a ilk ekle)
    initSpotlightCards();    // Mouse takibi
    initClickSparks();       // Buton kıvılcım
    upgradeAnimateValue();   // CountUp upgrade
    initDecryptedText();     // Logo efekti
    hookViewTransitions();   // Sekme geçişleri

    // Lenis — en son, diğer init'ler bittikten sonra
    setTimeout(initLenis, 300);

    // Moving Border — layout tam oturduğunda
    setTimeout(initMovingBorders, 600);

    // İlk yükleme stagger (çok hafif delay)
    const first = document.querySelector('.view.active, #view-dashboard');
    if (first) setTimeout(() => staggerCardsIn(first), 350);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllEffects);
} else {
    setTimeout(initAllEffects, 100);
}
