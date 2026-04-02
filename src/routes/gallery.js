// src/routes/gallery.js
// Google Drive galeri proxy endpoint'i.
// Sunucudaki Node fetch/https modulleri Google'a baglanamadiginda
// curl kullanarak veri cekilir (curl TLS/DNS'i daha iyi yonetir).

const express = require('express');
const { execSync } = require('child_process');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const authenticateToken = authMiddleware.authenticateToken || authMiddleware;
const logger = require('../logger');

/**
 * GET /api/v1/gallery
 * Google Apps Script uzerinden Drive galerisi fotograflarini doner.
 * curl ile istek atar — VDS'te Node fetch'ten daha guvenilir.
 */
router.get('/', authenticateToken, async (req, res) => {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;

  if (!scriptUrl) {
    logger.warn('Gallery: GOOGLE_SCRIPT_URL tanimli degil');
    return res.status(503).json({ error: 'Galeri yapilandirilmamis (GOOGLE_SCRIPT_URL eksik)' });
  }

  try {
    // curl ile Google Apps Script'e istek at
    // -s: sessiz, -L: redirect takip, --max-time: toplam timeout, --connect-timeout: baglanti timeout
    const output = execSync(
      `curl -s -L --max-time 60 --connect-timeout 30 "${scriptUrl}"`,
      { encoding: 'utf8', timeout: 65000 }
    );

    const data = JSON.parse(output);
    logger.info('Gallery: basarili', { imageCount: data?.data?.length || 0 });
    res.json(data);

  } catch (err) {
    let msg = err.message;
    if (err.status) msg = `curl cikis kodu: ${err.status}`;
    if (err.stderr) msg += ` (${err.stderr.trim()})`;

    logger.error('Gallery proxy hatasi', { error: msg, url: scriptUrl?.substring(0, 60) });
    res.status(502).json({ error: `Drive API yanit vermedi: ${msg}` });
  }
});

module.exports = router;
