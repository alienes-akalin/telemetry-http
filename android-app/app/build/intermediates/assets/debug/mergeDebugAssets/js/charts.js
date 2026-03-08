// public/js/charts.js
// ============================================================
// CHART.JS GRAFİK MODÜLÜ
// ============================================================
// Telemetri verilerini görselleştiren grafikler
// Ana dosyadan ayrıştırılmış modül (performans optimizasyonu)
// ============================================================

// Grafik değişkenleri (global scope - app.js ile paylaşım için)
let speedChart, energyChart, socChart, tempChart, isoChart;
let chartsInitialized = false;

/**
 * Tüm Chart.js grafiklerini oluşturur
 * Her grafik farklı telemetri metriklerini görselleştirir
 */
function initCharts() {
    // Chart.js varsayılan renkleri
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';

    // Ortak grafik ayarları
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,  // Container'a uyum
        animation: { duration: 0 },   // Performans için animasyon kapalı
        scales: { x: { display: false } }
    };

    // 1. HIZ & RPM GRAFİĞİ (Çift eksen)
    speedChart = new Chart(document.getElementById('chart-speed'), {
        type: 'line',
        data: {
            labels: [], datasets: [
                { label: 'Hız (km/h)', data: [], borderColor: '#3b82f6', yAxisID: 'y', tension: 0.3, fill: true, backgroundColor: 'rgba(59,130,246,0.1)' },
                { label: 'RPM', data: [], borderColor: '#8b5cf6', yAxisID: 'y1', tension: 0.3 }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { display: false },
                y: {
                    position: 'left',
                    title: { display: true, text: 'Hız (km/h)', color: '#3b82f6' }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'RPM', color: '#8b5cf6' }
                }
            }
        }
    });

    // 2. VOLTAJ & AKIM GRAFİĞİ (Çift eksen)
    energyChart = new Chart(document.getElementById('chart-energy'), {
        type: 'line',
        data: {
            labels: [], datasets: [
                { label: 'Voltaj (V)', data: [], borderColor: '#10b981', yAxisID: 'y', tension: 0.3, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                { label: 'Akım (A)', data: [], borderColor: '#f59e0b', yAxisID: 'y1', tension: 0.3, fill: true, backgroundColor: 'rgba(245, 158, 11, 0.1)' }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { display: false },
                y: {
                    position: 'left',
                    title: { display: true, text: 'Voltaj (V)', color: '#10b981' }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Akım (A)', color: '#f59e0b' }
                }
            }
        }
    });

    // 3. SICAKLIK GRAFİĞİ
    tempChart = new Chart(document.getElementById('chart-temp'), {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Sıcaklık (°C)', data: [], borderColor: '#ef4444', tension: 0.3, fill: true, backgroundColor: 'rgba(239,68,68,0.1)' }] },
        options: commonOptions
    });

    // 4. SOC (Şarj Durumu) GRAFİĞİ
    socChart = new Chart(document.getElementById('chart-soc'), {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'SOC (%)', data: [], borderColor: '#f59e0b', tension: 0.3, fill: true, backgroundColor: 'rgba(245,158,11,0.1)' }] },
        options: commonOptions
    });

    // 5. İZOLASYON DİRENCİ GRAFİĞİ
    isoChart = new Chart(document.getElementById('chart-iso'), {
        type: 'line',
        data: {
            labels: [], datasets: [
                { label: 'İzo+ (kΩ)', data: [], borderColor: '#06b6d4', tension: 0.3, yAxisID: 'y', fill: true, backgroundColor: 'rgba(6, 182, 212, 0.1)' },
                { label: 'İzo- (kΩ)', data: [], borderColor: '#ec4899', tension: 0.3, yAxisID: 'y1', fill: true, backgroundColor: 'rgba(236, 72, 153, 0.1)' }
            ]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { display: false },
                y: {
                    position: 'left',
                    title: { display: true, text: 'İzo+ (kΩ)', color: '#06b6d4' }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'İzo- (kΩ)', color: '#ec4899' }
                }
            }
        }
    });

    chartsInitialized = true;
}

/**
 * Tüm grafiklere yeni veri noktası ekler
 * @param {Object} data - Telemetri verisi
 */
function updateCharts(data) {
    const now = formatTR(data.ts_server).split(' ')[1]; // Sadece saat kısmı

    // Hız & RPM
    addPoint(speedChart, now, data.motor?.speed_kph || 0, 0);
    addPoint(speedChart, now, data.motor?.rpm || 0, 1, true);

    // Sıcaklık & SOC
    addPoint(tempChart, now, data.bms?.temp_c || 0);
    addPoint(socChart, now, data.bms?.soc_pct || 0);

    // Voltaj & Akım
    addPoint(energyChart, now, data.bms?.voltage_v || 0, 0);
    addPoint(energyChart, now, data.bms?.current_a || 0, 1, true);

    // İzolasyon
    addPoint(isoChart, now, data.iso?.res_1_kohm || 0, 0);
    addPoint(isoChart, now, data.iso?.res_2_kohm || 0, 1, true);
}

/**
 * Bir grafiğe yeni veri noktası ekler
 * @param {Chart} chart - Chart.js grafik nesnesi
 * @param {string} label - X ekseni etiketi (zaman)
 * @param {number} value - Y ekseni değeri
 * @param {number} datasetIndex - Veri seti indeksi (çift eksen için)
 * @param {boolean} skipLabel - Label eklemeyi atla (aynı zaman için 2. dataset)
 */
function addPoint(chart, label, value, datasetIndex = 0, skipLabel = false) {
    const maxPoints = 50;  // Maksimum görünür nokta sayısı

    // Label ekle (ilk dataset için)
    if (!skipLabel) {
        if (chart.data.labels.length > maxPoints) chart.data.labels.shift();
        chart.data.labels.push(label);
    }

    // Veri noktası ekle
    if (chart.data.datasets[datasetIndex].data.length > maxPoints) {
        chart.data.datasets[datasetIndex].data.shift();
    }
    chart.data.datasets[datasetIndex].data.push(value);

    chart.update();
}
