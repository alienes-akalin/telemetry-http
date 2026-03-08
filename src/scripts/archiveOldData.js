/**
 * archiveOldData.js
 * 30 günden eski telemetri verilerini archive collection'a taşır
 * 
 * Kullanım:
 *   node src/scripts/archiveOldData.js
 * 
 * Cron job örneği (her gün gece 3'te çalıştır):
 *   0 3 * * * node /path/to/archiveOldData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Bağlantı ayarları
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/telemetry';
const ARCHIVE_DAYS = 30; // Kaç günden eski veriler arşivlenecek

async function archiveOldData() {
    console.log('📦 Arşivleme işlemi başlatılıyor...');
    console.log(`⏰ ${ARCHIVE_DAYS} günden eski veriler arşivlenecek`);

    try {
        // MongoDB'ye bağlan
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB bağlantısı kuruldu');

        const db = mongoose.connection.db;

        // Kaynak ve hedef collection'lar
        const sourceCollection = db.collection('telemetries');
        const archiveCollection = db.collection('telemetries_archive');

        // Tarih hesaplama
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_DAYS);
        console.log(`📅 Kesme tarihi: ${cutoffDate.toISOString()}`);

        // Eski verileri say
        const oldDataCount = await sourceCollection.countDocuments({
            ts_server: { $lt: cutoffDate }
        });

        if (oldDataCount === 0) {
            console.log('ℹ️ Arşivlenecek eski veri bulunamadı.');
            await mongoose.disconnect();
            return;
        }

        console.log(`📊 Arşivlenecek veri sayısı: ${oldDataCount}`);

        // Batch halinde taşıma (memory friendly)
        const batchSize = 1000;
        let processed = 0;

        while (processed < oldDataCount) {
            // Eski verileri getir
            const oldData = await sourceCollection
                .find({ ts_server: { $lt: cutoffDate } })
                .limit(batchSize)
                .toArray();

            if (oldData.length === 0) break;

            // Archive collection'a ekle
            await archiveCollection.insertMany(oldData);

            // Orijinal collection'dan sil
            const ids = oldData.map(doc => doc._id);
            await sourceCollection.deleteMany({ _id: { $in: ids } });

            processed += oldData.length;
            console.log(`⏳ İlerleme: ${processed}/${oldDataCount} (${Math.round(processed / oldDataCount * 100)}%)`);
        }

        console.log('✅ Arşivleme tamamlandı!');
        console.log(`📁 ${processed} kayıt 'telemetries_archive' collection'a taşındı`);

        // İstatistikler
        const mainCount = await sourceCollection.countDocuments();
        const archiveCount = await archiveCollection.countDocuments();
        console.log(`\n📊 Güncel Durum:`);
        console.log(`   Ana collection: ${mainCount} kayıt`);
        console.log(`   Arşiv collection: ${archiveCount} kayıt`);

    } catch (error) {
        console.error('❌ Arşivleme hatası:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 MongoDB bağlantısı kapatıldı');
    }
}

// Script doğrudan çalıştırıldığında
if (require.main === module) {
    archiveOldData();
}

module.exports = archiveOldData;
