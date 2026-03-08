// src/routes/gallery.js
// Google Drive galeri proxy endpoint'i.
// GOOGLE_SCRIPT_URL'yi .env'den okur ve frontend'e iletir — key client-side'da görünmez.

const express = require('express');
const https = require('https');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const logger = require('../logger');

/**
 * Google Apps Script URL'sine HTTPS GET isteği atar, redirect takip eder, JSON döner.
 * Google Apps Script web app'leri genellikle 302 redirect döndürür.
 */
function fetchJson(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Çok fazla redirect'));

    https.get(url, (res) => {
      // Redirect'i takip et
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        return resolve(fetchJson(res.headers.location, redirectCount + 1));
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Drive API yanıt kodu: ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON parse hatası'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * GET /api/v1/gallery
 * Google Apps Script üzerinden Drive galerisi fotoğraflarını döner.
 * Kimlik doğrulaması gerektirir (JWT).
 */
router.get('/', authenticateToken, async (req, res) => {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;

  if (!scriptUrl) {
    return res.status(503).json({ error: 'Galeri yapılandırılmamış' });
  }

  try {
    const data = await fetchJson(scriptUrl);
    res.json(data);
  } catch (err) {
    logger.error('Gallery proxy hatası:', err.message);
    res.status(502).json({ error: 'Drive API yanıt vermedi' });
  }
});

module.exports = router;

