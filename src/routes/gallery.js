// src/routes/gallery.js
// Google Drive galeri proxy endpoint'i.
// GOOGLE_SCRIPT_URL'yi .env'den okur ve frontend'e iletir — key client-side'da görünmez.

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const logger = require('../logger');

/**
 * GET /api/v1/gallery
 * Google Apps Script üzerinden Drive galerisi fotoğraflarını döner.
 * Kimlik doğrulaması gerektirir (JWT).
 */
router.get('/', authMiddleware, async (req, res) => {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;

  if (!scriptUrl) {
    return res.status(503).json({ error: 'Galeri yapılandırılmamış' });
  }

  try {
    const response = await fetch(scriptUrl);
    if (!response.ok) {
      throw new Error(`Drive API yanıt kodu: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    logger.error('Gallery proxy hatası:', err.message);
    res.status(502).json({ error: 'Drive API yanıt vermedi' });
  }
});

module.exports = router;
