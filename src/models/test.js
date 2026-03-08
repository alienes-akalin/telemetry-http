// src/models/test.js
// Dashboard'dan başlatılan test kayıtlarını saklar.
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    start_time: {
        type: Date,
        required: true
    },
    end_time: {
        type: Date,
        required: true
    },
    total_laps: {
        type: Number,
        default: 0
    },
    // a1: Hidromobil, a2: Shell
    device_id: {
        type: String,
        required: true,
        default: 'a1',
        enum: ['a1', 'a2']
    },
    label: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Test', testSchema);
