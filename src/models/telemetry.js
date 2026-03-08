// src/models/telemetry.js
// STM32 SIM800L cihazından gelen telemetri verilerinin şeması.
// Standart Mongoose collection kullanılıyor (MongoDB 5.0+ gerekmez).
const mongoose = require('mongoose');
const { Schema } = mongoose;

const TelemetrySchema = new Schema({
  // ==================== META VERİLER ====================
  device_id: { type: String, required: true, index: true },
  protocol: { type: String, default: 'http' },
  // 'telemetry' → normal ölçüm, 'system_startup' → cihaz başlangıç olayı
  event_type: { type: String, default: 'telemetry' },

  // ==================== ZAMAN DAMGALARI ====================
  ts_server: { type: Date, default: Date.now, index: true }, // Sunucunun kaydettiği zaman
  uptime_sec: Number,                                          // Cihazın çalışma süresi (s)

  // ==================== BMS (Batarya Yönetim Sistemi) ====================
  bms: {
    voltage_v: Number,  // Toplam paket voltajı — 27 hücre toplamı (V)
    current_a: Number,  // Çekilen akım (A). Pozitif: deşarj, Negatif: şarj
    temp_c: Number,  // Paketteki maksimum hücre sıcaklığı (°C)
    soc_pct: Number,  // State of Charge — şarj durumu (%)
    energy_mwh: Number   // Oturumda kullanılan toplam enerji (mWh)
  },

  // ==================== MOTOR ====================
  motor: {
    rpm: Number,  // Motor devir sayısı (RPM)
    speed_kph: Number,  // Araç hızı (km/h)
    duty_pct: Number   // Motor sürücü duty cycle (%)
  },

  // ==================== GPS ====================
  gps: {
    lat_deg: Number,  // Enlem (ondalık derece)
    lon_deg: Number   // Boylam (ondalık derece)
  },

  // ==================== İZOLASYON / KAÇAK ÖLÇÜMÜ ====================
  iso: {
    res_1_kohm: Number,  // Pozitif bara izolasyon direnci (kΩ)
    res_2_kohm: Number   // Negatif bara izolasyon direnci (kΩ)
  },

  // ==================== HİDROJEN SENSÖRÜ ====================
  hydrogen: {
    ppm: Number,  // H2 gaz konsantrasyonu (ppm)
    temp_c: Number,  // Hidrojen tankı sıcaklığı (°C)
    flowmeter: Number   // Anlık akış hızı (birim: cihaza göre değişir)
  }
}, {
  timestamps: true  // Mongoose'un eklediği createdAt / updatedAt alanları
});

// ==================== INDEX'LER ====================
// Bileşik index: device_id + ts_server → history ve export sorgularını hızlandırır (en kritik)
TelemetrySchema.index({ device_id: 1, ts_server: -1 });
// Bileşik index: device_id + event_type + zaman → startup event sorgularını hızlandırır
TelemetrySchema.index({ device_id: 1, event_type: 1, ts_server: -1 });

module.exports = mongoose.model('Telemetry', TelemetrySchema);
