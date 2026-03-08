// src/models/user.js
// JWT authentication için kullanıcı modeli
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { Schema } = mongoose;

const UserSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,  // Büyük/küçük harf farkını ortadan kaldırır
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'member', 'viewer'],
        default: 'member'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: Date  // Her başarılı girişte güncellenir
});

/**
 * Şifre değiştiyse kayıt öncesi otomatik hash'le (bcrypt, 10 round)
 */
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Giriş sırasında şifreyi doğrular
 * @param {string} candidatePassword - Kullanıcının girdiği ham şifre
 * @returns {Promise<boolean>} Şifre doğruysa true
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

/**
 * JSON çıktısından şifre alanını çıkarır (API response güvenliği)
 */
UserSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('User', UserSchema);
