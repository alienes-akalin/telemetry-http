// tools/export-logs-to-csv.js
// Amaç: logs klasöründeki her app-*.log dosyası için
// ayrı bir CSV dosyası üretmek (ayraç: ';').

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOG_DIR = path.join(process.cwd(), 'logs');
const OUTPUT_DIR = path.join(process.cwd(), 'exports');

// Hangi mesajları CSV'ye dahil edeceğimizi buradan kontrol ederiz
const INCLUDE_MESSAGES = new Set([
  'Telemetry (POST) saved',
  'Telemetry (GET) saved'
]);

// CSV kolonları
const HEADERS = [
  'log_timestamp',
  'log_message',
  'id',
  'ip',

  'device_id',
  'ts_device',
  'ts_gps',

  'gps_lat_deg',
  'gps_lon_deg',

  'bms_temp_c',
  'bms_current_a',
  'bms_soc_pct',
  'bms_energy_wh_used',
  'bms_charge_mah_used',

  'motor_rpm',
  'motor_speed_kph',
  'motor_duty_pct',

  'iso_res_neg_kohm',
  'iso_res_pos_kohm',

  'vcu_sys1_a',
  'vcu_sys2_a',
  'vcu_sys3_a',
  'vcu_sys4_a',
  'vcu_sys5_a',

  'h2_ppm',
  'h2_bottle_temp_c'
];

// Noktalı virgül (;) ayraç kullanacağız
const SEP = ';';

// CSV kaçış fonksiyonu:
// Değer içinde ;, " veya satır sonu varsa, tırnak içine al ve " işaretlerini çiftle.
function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes('"') || str.includes(SEP) || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function processSingleLogFile(file) {
  const fullPath = path.join(LOG_DIR, file);
  const baseName = file.replace(/\.log$/i, '');
  const outFile = path.join(OUTPUT_DIR, `${baseName}.csv`);

  console.log(`İşleniyor: ${fullPath}`);
  console.log(`→ Çıktı:  ${outFile}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(fullPath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  const outputStream = fs.createWriteStream(outFile, { encoding: 'utf8' });

  // Header satırı
  outputStream.write(HEADERS.join(SEP) + '\n');

  let rowCount = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (e) {
      // JSON değilse (örneğin çıplak console.log) atla
      continue;
    }

    if (!INCLUDE_MESSAGES.has(obj.message)) {
      continue;
    }

    const row = [
      obj.timestamp || '',
      obj.message || '',
      obj.id || '',
      obj.ip || '',

      obj.device_id || '',
      obj.ts_device || '',
      obj.ts_gps || '',

      obj.gps_lat_deg ?? '',
      obj.gps_lon_deg ?? '',

      obj.bms_temp_c ?? '',
      obj.bms_current_a ?? '',
      obj.bms_soc_pct ?? '',
      obj.bms_energy_wh_used ?? '',
      obj.bms_charge_mah_used ?? '',

      obj.motor_rpm ?? '',
      obj.motor_speed_kph ?? '',
      obj.motor_duty_pct ?? '',

      obj.iso_res_neg_kohm ?? '',
      obj.iso_res_pos_kohm ?? '',

      obj.vcu_sys1_a ?? '',
      obj.vcu_sys2_a ?? '',
      obj.vcu_sys3_a ?? '',
      obj.vcu_sys4_a ?? '',
      obj.vcu_sys5_a ?? '',

      obj.h2_ppm ?? '',
      obj.h2_bottle_temp_c ?? ''
    ];

    const csvLine = row.map(csvEscape).join(SEP);
    outputStream.write(csvLine + '\n');
    rowCount++;
  }

  outputStream.end();
  console.log(`→ ${rowCount} satır yazıldı.\n`);
}

async function processLogs() {
  // logs klasörü kontrol
  if (!fs.existsSync(LOG_DIR)) {
    console.error('logs klasörü bulunamadı:', LOG_DIR);
    process.exit(1);
  }

  // exports klasörü oluştur
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.startsWith('app-') && f.endsWith('.log'));

  if (files.length === 0) {
    console.error('logs klasöründe app-*.log dosyası bulunamadı.');
    process.exit(1);
  }

  console.log('Bulunan log dosyaları:');
  files.forEach(f => console.log('  ', f));
  console.log('');

  for (const file of files) {
    await processSingleLogFile(file);
  }

  console.log('Tüm log dosyaları işlendi.');
}

processLogs().catch(err => {
  console.error('Bir hata oluştu:', err);
  process.exit(1);
});
