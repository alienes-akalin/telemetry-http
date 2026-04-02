/**
 * TCP Telemetry Server
 * ====================
 * HTTP sunucusundan BAĞIMSIZ çalışır.
 * STM32'deki main2.c (TCP versiyonu) ile kullanılır.
 *
 * KULLANIM: node tcp_server.js
 * NOT: Bu sunucu ayrı bir portta (5000) dinler.
 */

const net = require('net');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// .env dosyasını yükle — önce .env, yoksa .env.production dene
const envFile = fs.existsSync(path.join(__dirname, '..', '.env'))
  ? '.env'
  : '.env.production';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const logger = require('./logger');

// ==================== YAPILANDIRMA ====================
const TCP_PORT = process.env.TCP_PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/telemetry';

// ==================== MONGODB BAĞLANTISI ====================
mongoose.connect(MONGODB_URI)
    .then(() => logger.info('TCP Server: MongoDB connected'))
    .catch(err => {
        logger.error('TCP Server: MongoDB connection failed', { error: err.message });
        process.exit(1);
    });

// Mevcut Telemetry modelini kullan (şema tekrarını önler)
const Telemetry = require('./models/telemetry');

// ==================== BAĞLI İSTEMCİLER ====================
const connectedClients = new Map();

// ==================== TCP SUNUCUSU ====================
const server = net.createServer((socket) => {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
    logger.info('TCP client connected', { clientId });

    connectedClients.set(clientId, {
        socket,
        connectedAt: new Date(),
        lastData: null,
        messageCount: 0
    });

    let buffer = '';

    socket.on('data', async (data) => {
        buffer += data.toString();

        // Satır satır işle (JSON'lar \n ile ayrılmış)
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Son tamamlanmamış satırı buffer'da tut

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const json = JSON.parse(line);
                    await processMessage(clientId, json);
                } catch (err) {
                    logger.warn('TCP JSON parse error', { clientId, error: err.message });
                }
            }
        }
    });

    socket.on('close', () => {
        logger.info('TCP client disconnected', { clientId });
        connectedClients.delete(clientId);
    });

    socket.on('error', (err) => {
        logger.error('TCP socket error', { clientId, error: err.message });
        connectedClients.delete(clientId);
    });
});

// ==================== MESAJ İŞLEME ====================
async function processMessage(clientId, data) {
    const client = connectedClients.get(clientId);
    if (client) {
        client.messageCount++;
        client.lastData = new Date();
    }

    // Özel event'ler
    if (data.event_type === 'tcp_connect') {
        logger.info('TCP device connected', { device_id: data.device_id });
        return;
    }

    if (data.event_type === 'system_startup') {
        logger.info('TCP device startup', { device_id: data.device_id });
        return;
    }

    // Normal telemetri verisi
    if (data.device_id) {
        try {
            await Telemetry.create({ ...data, protocol: 'tcp', ts_server: new Date() });

            const speed = data.motor?.speed_kph?.toFixed(1) || '0';
            const voltage = data.bms?.voltage_v?.toFixed(1) || '0';
            logger.debug('TCP telemetry saved', {
                device_id: data.device_id, speed_kph: speed, voltage_v: voltage
            });
        } catch (err) {
            logger.error('TCP DB save failed', { device_id: data.device_id, error: err.message });
        }
    }
}

// ==================== İSTATİSTİKLER ====================
setInterval(() => {
    if (connectedClients.size > 0) {
        logger.info('TCP connected clients', { count: connectedClients.size });
    }
}, 30000);

// ==================== SUNUCUYU BAŞLAT ====================
server.listen(TCP_PORT, () => {
    logger.info('TCP Telemetry Server started', { port: TCP_PORT });
    console.log(`\nTCP Telemetry Server listening on port ${TCP_PORT}\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('TCP Server shutting down...');

    connectedClients.forEach((client) => {
        client.socket.end();
    });

    server.close(() => {
        mongoose.connection.close();
        logger.info('TCP Server closed');
        process.exit(0);
    });
});

