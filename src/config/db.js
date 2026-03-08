// src/config/db.js
// MongoDB bağlantısını kurar ve bağlantı olaylarını dinler.
const mongoose = require('mongoose');
const logger = require('../logger');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/telemetry';

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 20,              // Varsayılan 5 → 20 (30 eşzamanlı sorgu kuyruğa girmez)
      minPoolSize: 5,               // Minimum 5 bağlantı her zaman hazır
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    // URI'deki şifreyi logdan gizle
    logger.info('MongoDB connected', { uri: mongoUri.replace(/\/\/.*@/, '//<credentials>@') });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

  } catch (err) {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  }
};

module.exports = connectDB;
