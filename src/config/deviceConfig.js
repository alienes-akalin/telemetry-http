// src/config/deviceConfig.js
// Merkezi cihaz konfigürasyon modülü — tüm route'lar buradan import eder.
// Yeni araç eklemek için sadece bu dosyayı güncelle.

// Cihaz ID geriye uyumluluk eşleştirmesi (kısa format → eski format)
const DEVICE_ALIASES = {
    'a1': ['a1', 'arac-01'],
    'a2': ['a2', 'arac-02']
};

// Geçerli cihaz ID whitelist'i
const VALID_DEVICE_IDS = Object.keys(DEVICE_ALIASES);

// Araç özellikleri: hangi cihazın ISO/H2 sensörü var?
const VEHICLE_CONFIG = {
    'a1': { name: 'Hidromobil', hasIso: true, hasH2: true },
    'arac-01': { name: 'Hidromobil', hasIso: true, hasH2: true },
    'a2': { name: 'Shell', hasIso: false, hasH2: false },
    'arac-02': { name: 'Shell', hasIso: false, hasH2: false }
};

/**
 * Verilen device_id için tüm kabul edilen alias'ları döndürür.
 * @param {string} deviceId - Kısa cihaz ID'si ('a1', 'a2' vb.)
 * @returns {string[]} ID listesi ($in operatörü için)
 */
const resolveDeviceIds = (deviceId) => DEVICE_ALIASES[deviceId] || [deviceId];

/**
 * device_id'ı whitelist'e karşı doğrular.
 * @param {string} id - Kontrol edilecek cihaz ID'si
 * @returns {boolean}
 */
const isValidDeviceId = (id) => typeof id === 'string' && VALID_DEVICE_IDS.includes(id);

module.exports = {
    DEVICE_ALIASES,
    VALID_DEVICE_IDS,
    VEHICLE_CONFIG,
    resolveDeviceIds,
    isValidDeviceId
};
