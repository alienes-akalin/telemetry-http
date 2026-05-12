/**
 * 1.5 ADANA Telemetri — Visual Effects Engine v3.0 (STABLE)
 *
 * Sadece layout ve nav'a DOKUNMAYAN güvenli efektler:
 *  1. Spotlight  — ::before pseudo ile fare ışığı
 *  2. CountUp    — sayısal değer animasyonu
 *  3. ClickSpark — buton kıvılcım efekti
 *  4. DotField   — arkaplan nokta canvas
 *  5. DecryptedText — logo metin çözme
 *
 * KALDIRILDI (layout bozulması yüzünden):
 *  × Moving Border   — canvas DOM ekleme layout'u kırıyordu
 *  × GSAP Stagger    — fill:'forwards' opacity:0 kartları gizliyordu
 *  × Lenis           — nav click + Leaflet scroll'u bozuyordu
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   1. SPOTLIGHT — sadece CSS ::before kullanır, DOM'a dokunmaz
   ───────────────────────────────────────────────────────────── */
function initSpotlight() {
    document.addEventListener('mousemove', e => {
        const card = e.target.closest('.stat-card, .card');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--spot-x', (e.clientX - r.left) + 'px');
        card.style.setProperty('--spot-y', (e.clientY - r.top) + 'px');
        card.classList.add('spotlight-active');
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
        document.querySelectorAll('.spotlight-active')
            .forEach(c => c.classList.remove('spotlight-active'));
    }, { capture: true, passive: true });
}

/* ─────────────────────────────────────────────────────────────
   2. COUNT-UP — mevcut animateValue'yu upgrade eder
   ───────────────────────────────────────────────────────────── */
const _cuMap = new Map();

function _countUp(el, target, dur) {
    if (!el) return;
    const to  = parseFloat(target);
    if (isNaN(to)) { el.textContent = target; return; }
    const from = parseFloat(el.textContent) || 0;
    const diff = to - from;
    if (Math.abs(diff) < 0.005) return;
    if (_cuMap.has(el.id)) cancelAnimationFrame(_cuMap.get(el.id));
    const t0  = performance.now();
    const dec = (target.split('.')[1] || '').length;
    const step = now => {
        const p = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3); // cubic ease-out
        el.textContent = (from + diff * e).toFixed(dec);
        if (p < 1) _cuMap.set(el.id, requestAnimationFrame(step));
        else { el.textContent = target; _cuMap.delete(el.id); }
    };
    _cuMap.set(el.id, requestAnimationFrame(step));
}

function upgradeAnimateValue() {
    const orig = window.animateValue;
    if (!orig) return;
    window.animateValue = function(id, val) {
        const el  = document.getElementById(id);
        const str = String(val);
        if (!el || el.textContent === str) return;
        const n = parseFloat(str);
        (!isNaN(n) && !str.includes(':'))
            ? _countUp(el, str, 280)
            : orig(id, val);
    };
}

/* ─────────────────────────────────────────────────────────────
   3. CLICK SPARK — position:fixed, sayfayı etkilemez
   ───────────────────────────────────────────────────────────── */
function initClickSparks() {
    document.addEventListener('click', e => {
        const btn = e.target.closest('.sw-btn, .params-btn-apply, #btn-run-sim');
        if (!btn) return;
        const colors = ['#6366f1','#818cf8','#34d399','#60a5fa','#f59e0b'];
        for (let i = 0; i < 8; i++) {
            const sp  = document.createElement('div');
            sp.className = 'click-spark-particle';
            const ang = (Math.PI * 2 / 8) * i + (Math.random() - .5) * .5;
            const d   = 24 + Math.random() * 28;
            const col = colors[i % colors.length];
            Object.assign(sp.style, {
                left: e.clientX + 'px', top: e.clientY + 'px',
                width: (3 + Math.random() * 3) + 'px',
                height: (3 + Math.random() * 3) + 'px',
                background: col, boxShadow: `0 0 5px ${col}`,
                '--dx': Math.cos(ang) * d + 'px',
                '--dy': Math.sin(ang) * d + 'px',
                animationDuration: (380 + Math.random() * 160) + 'ms',
            });
            document.body.appendChild(sp);
            sp.addEventListener('animationend', () => sp.remove(), { once: true });
        }
    });
}

/* ─────────────────────────────────────────────────────────────
   4. DOT FIELD — position:fixed canvas, hiçbir şeye dokunmaz
   ───────────────────────────────────────────────────────────── */
function initDotField() {
    if (document.getElementById('dot-field-canvas')) return;
    const cv  = document.createElement('canvas');
    cv.id     = 'dot-field-canvas';
    Object.assign(cv.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '0', pointerEvents: 'none', opacity: '.13',
    });
    document.body.insertBefore(cv, document.body.firstChild);
    const ctx = cv.getContext('2d');
    const GAP = 34;
    let ox = 0, oy = 0;

    const resize = () => { cv.width = innerWidth; cv.height = innerHeight; };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    (function draw() {
        ctx.clearRect(0, 0, cv.width, cv.height);
        ox = (ox + .09) % GAP; oy = (oy + .045) % GAP;
        const light = document.body.classList.contains('light-mode');
        const c = light ? '51,65,85' : '148,163,184';
        for (let x = -GAP; x < cv.width + GAP; x += GAP)
            for (let y = -GAP; y < cv.height + GAP; y += GAP) {
                ctx.beginPath();
                ctx.arc(x + ox, y + oy, 1.1, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${c},.55)`;
                ctx.fill();
            }
        requestAnimationFrame(draw);
    })();
}

/* ─────────────────────────────────────────────────────────────
   5. DECRYPTED TEXT — sadece metin içeriğini değiştirir
   ───────────────────────────────────────────────────────────── */
const _DC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%!?';

function decryptText(el, final, dur, delay) {
    if (!el) return;
    const chars = final.split('');
    setTimeout(() => {
        let f = 0, total = Math.round(dur / 38);
        const iv = setInterval(() => {
            f++;
            const p = f / total;
            el.textContent = chars.map((ch, i) => {
                if (ch === ' ') return ' ';
                if (p > (i / chars.length) * .75 + .15) return ch;
                return _DC[Math.floor(Math.random() * _DC.length)];
            }).join('');
            if (f >= total) { clearInterval(iv); el.textContent = final; }
        }, 38);
    }, delay);
}

function initDecryptedText() {
    document.querySelectorAll('.logo-main').forEach((el, i) => {
        const txt = el.textContent.trim();
        if (txt) decryptText(el, txt, 880, 260 + i * 70);
    });
}

/* ─────────────────────────────────────────────────────────────
   BAŞLATICI
   ───────────────────────────────────────────────────────────── */
function initAllEffects() {
    initDotField();
    initSpotlight();
    initClickSparks();
    upgradeAnimateValue();
    initDecryptedText();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllEffects);
} else {
    setTimeout(initAllEffects, 50);
}
