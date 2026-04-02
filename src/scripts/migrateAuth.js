// src/scripts/migrateAuth.js
// Tek seferlik migration script:
// 1. alienes.akalin → role: superadmin, yeni şifre
// 2. Eski admin ve member kullanıcılarını sil
const path = require('path');
const fs = require('fs');
const envFile = fs.existsSync(path.join(__dirname, '..', '..', '.env'))
  ? '.env'
  : '.env.production';
require('dotenv').config({ path: path.join(__dirname, '..', '..', envFile) });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/telemetry';

async function migrate() {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const users = db.collection('users');

    console.log('🔧 Auth migration başlıyor...\n');

    // 1. alienes.akalin → superadmin + yeni şifre
    const newPassword = 'Vettel2002Ali';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateResult = await users.updateOne(
        { username: 'alienes.akalin' },
        { $set: { role: 'superadmin', password: hashedPassword } }
    );

    if (updateResult.matchedCount > 0) {
        console.log('✅ alienes.akalin → superadmin olarak güncellendi');
        console.log('✅ Yeni şifre ayarlandı');
    } else {
        console.log('⚠️  alienes.akalin bulunamadı — oluşturuluyor...');
        await users.insertOne({
            username: 'alienes.akalin',
            password: hashedPassword,
            role: 'superadmin',
            createdAt: new Date()
        });
        console.log('✅ alienes.akalin superadmin olarak oluşturuldu');
    }

    // 2. Eski admin ve member kullanıcılarını sil (superadmin hariç)
    const deleteResult = await users.deleteMany({
        username: { $ne: 'alienes.akalin' }
    });

    console.log(`🗑️  ${deleteResult.deletedCount} eski kullanıcı silindi`);

    // Sonuç
    const remaining = await users.find().toArray();
    console.log('\n📋 Mevcut kullanıcılar:');
    remaining.forEach(u => {
        console.log(`   - ${u.username} (${u.role})`);
    });

    console.log('\n✅ Migration tamamlandı!');
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('❌ Migration hatası:', err);
    process.exit(1);
});
