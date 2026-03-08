// src/models/customSession.js
// Kullanıcının belirlediği zaman aralığındaki telemetri verilerini
// gruplamak için kullanılan özel paket tanımlarını saklar.
const mongoose = require('mongoose');

const customSessionSchema = new mongoose.Schema({
    // Paket ismi - Kullanıcı tarafından belirlenen açıklayıcı isim
    // Örn: "Yokuş Testi 1", "Pist Denemesi Tur 3"
    name: {
        type: String,
        required: true
    },

    // Başlangıç zamanı - Paketin kapsadığı telemetri verilerinin
    // başlangıç tarih/saati (UTC olarak saklanır)
    start_time: {
        type: Date,
        required: true
    },

    // Bitiş zamanı - Paketin kapsadığı telemetri verilerinin
    // bitiş tarih/saati (UTC olarak saklanır)
    end_time: {
        type: Date,
        required: true
    },

    // Hangi araca ait olduğunu belirtir (a1: Hidromobil, a2: Shell)
    device_id: {
        type: String,
        required: true,
        default: 'a1',
        enum: ['a1', 'a2']
    },

    // Oluşturulma tarihi - Paketin ne zaman tanımlandığı
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Mongoose modeli oluştur ve dışa aktar
module.exports = mongoose.model('CustomSession', customSessionSchema);
