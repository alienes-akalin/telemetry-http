// src/logger.js
// Winston logger — her sunucu başlatmasında yeni log dosyası oluşturur.
// Dosya adı format: app-<ISO timestamp>.log (: ve . yerine - kullanılır)
const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs = require('fs');

// Logs klasörünü oluştur (yoksa)
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Başlangıç zamanını dosya adına yerleştir → her restart'ta yeni log dosyası
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `app-${ts}.log`;

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      dirname: logDir,
      filename,
      maxsize: 20 * 1024 * 1024, // 20 MB
      maxFiles: 10                // En eski dosyalar otomatik silinir
    })
  ]
});

module.exports = logger;
