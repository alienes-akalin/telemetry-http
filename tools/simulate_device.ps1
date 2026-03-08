# tools/simulate_device.ps1
# Elektrikli Araç Telemetri Simülasyonu - Araç 1 (a1) - GET Method
# ISO + Hidrojen sensörleri dahil
# Kullanım: .\tools\simulate_device.ps1 -ServerIP "telemetry-aliakalin.com.tr" -ServerPort 80

param (
    [string]$ServerIP = "localhost",
    [int]$ServerPort = 80
)

$DeviceId = "a1"
$BaseUrl = "http://${ServerIP}:${ServerPort}/api/v1/telemetry/ingest"

Write-Host "Arac 1 (a1) Simulasyonu Baslatiliyor (GET Method)..." -ForegroundColor Green
Write-Host "Hedef: $BaseUrl" -ForegroundColor Gray
Write-Host "Durdurmak icin Ctrl+C basin." -ForegroundColor Yellow

# Sistem Baslangic Sinyali
$startupUrl = "${BaseUrl}?did=${DeviceId}&evt=system_startup&upt=0"
try {
    Invoke-RestMethod -Uri $startupUrl -Method Get | Out-Null
    Write-Host "[BASLANGIC] Sistem baslangic sinyali gonderildi!" -ForegroundColor Green
}
catch {
    Write-Host "Baslangic sinyali gonderilemedi: $_" -ForegroundColor Red
}

# Baslangic Degerleri
$lat = 39.9334
$lon = 32.8597
$soc = 100.0
$speed = 0.0
$voltage = 84.0
$temp = 25.0
$energy = 0.0
$h2ppm = 0
$h2temp = 17.5
$uptime = 0

while ($true) {
    $uptime += 2

    $rand = Get-Random -Minimum -0.5 -Maximum 0.5
    $speed = $speed + ($rand * 8)
    if ($speed -lt 0) { $speed = 0 }
    if ($speed -gt 50) { $speed = 50 }

    $soc = $soc - ($speed * 0.0005)
    if ($soc -lt 0) { $soc = 0 }
    if ($soc -gt 100) { $soc = 100 }

    $voltage = ($soc / 100) * 84.0

    $temp = $temp + ($speed * 0.02) - 0.1 + (Get-Random -Minimum -0.5 -Maximum 0.5)
    if ($temp -lt 0) { $temp = 0 }
    if ($temp -gt 100) { $temp = 100 }

    $current = (Get-Random -Minimum -100 -Maximum 300) / 10.0
    $duty = ($speed / 50) * 100
    $wheelCircumference = 1.809557368
    $rpm = [Math]::Floor(($speed * 1000 / 60) / $wheelCircumference)
    $energy = $energy + ($speed * 0.1)

    $h2ppm = $h2ppm + (Get-Random -Minimum -5 -Maximum 5)
    if ($h2ppm -lt 0) { $h2ppm = 0 }
    if ($h2ppm -gt 200) { $h2ppm = 200 }

    $h2temp = $h2temp + (Get-Random -Minimum -0.5 -Maximum 0.5)
    if ($h2temp -lt 10) { $h2temp = 10 }
    if ($h2temp -gt 25) { $h2temp = 25 }

    $time = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() / 10000
    $lat = 39.9334 + [Math]::Sin($time) * 0.01
    $lon = 32.8597 + [Math]::Cos($time) * 0.01

    $queryParams = @(
        "did=$DeviceId",
        "bvt=$([Math]::Round($voltage, 1))",
        "bca=$([Math]::Round($current, 1))",
        "btc=$([Math]::Round($temp, 1))",
        "soc=$([Math]::Round($soc, 1))",
        "enr=$([Math]::Floor($energy))",
        "rpm=$rpm",
        "spd=$([Math]::Round($speed, 1))",
        "dut=$([Math]::Round($duty, 1))",
        "lat=$lat",
        "lon=$lon",
        "ir1=$(500 + (Get-Random -Minimum 0 -Maximum 10))",
        "ir2=$(500 + (Get-Random -Minimum 0 -Maximum 10))",
        "h2p=$([Math]::Floor($h2ppm))",
        "h2t=$([Math]::Round($h2temp, 1))",
        "flw=0",
        "upt=$uptime"
    )

    $queryString = $queryParams -join "&"
    $fullUrl = "${BaseUrl}?${queryString}"

    try {
        Invoke-RestMethod -Uri $fullUrl -Method Get | Out-Null
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [a1] Hiz: $([Math]::Round($speed,1)) km/h | SOC: $([Math]::Round($soc,1))% | V: $([Math]::Round($voltage,1))V | T: $([Math]::Round($temp,1))C" -ForegroundColor Cyan
    }
    catch {
        Write-Host "Hata: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds 2
}
