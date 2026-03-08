# tools/simulate_device_a2.ps1
# Elektrikli Arac Telemetri Simulasyonu - Arac 2 (a2) - GET Method
# NOT: Arac 2'de ISO ve Hidrojen sensoru YOKTUR
# Kullanim: .\tools\simulate_device_a2.ps1 -ServerIP "telemetry-aliakalin.com.tr" -ServerPort 80

param (
    [string]$ServerIP = "localhost",
    [int]$ServerPort = 80
)

$DeviceId = "a2"
$BaseUrl = "http://${ServerIP}:${ServerPort}/api/v1/telemetry/ingest"

Write-Host "Arac 2 (a2) Simulasyonu Baslatiliyor (GET Method)..." -ForegroundColor Magenta
Write-Host "NOT: ISO ve Hidrojen parametreleri yok." -ForegroundColor Yellow
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
$lat = 39.9440   # Biraz farkli konum (arac 1'den ayirt etmek icin)
$lon = 32.8600
$soc = 95.0
$speed = 0.0
$voltage = 80.0
$temp = 22.0
$energy = 0.0
$uptime = 0

while ($true) {
    $uptime += 2

    $rand = Get-Random -Minimum -0.5 -Maximum 0.5
    $speed = $speed + ($rand * 6)
    if ($speed -lt 0) { $speed = 0 }
    if ($speed -gt 45) { $speed = 45 }

    $soc = $soc - ($speed * 0.0004)
    if ($soc -lt 0) { $soc = 0 }
    if ($soc -gt 100) { $soc = 100 }

    $voltage = ($soc / 100) * 80.0

    $temp = $temp + ($speed * 0.015) - 0.08 + (Get-Random -Minimum -0.3 -Maximum 0.3)
    if ($temp -lt 0) { $temp = 0 }
    if ($temp -gt 80) { $temp = 80 }

    $current = (Get-Random -Minimum -80 -Maximum 250) / 10.0
    $duty = ($speed / 45) * 100
    $wheelCircumference = 1.809557368
    $rpm = [Math]::Floor(($speed * 1000 / 60) / $wheelCircumference)
    $energy = $energy + ($speed * 0.09)

    $time = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() / 10000
    $lat = 39.9440 + [Math]::Cos($time * 0.9) * 0.008
    $lon = 32.8600 + [Math]::Sin($time * 0.9) * 0.008

    # Arac 2: ISO ve Hidrojen parametreleri YOK
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
        "upt=$uptime"
    )

    $queryString = $queryParams -join "&"
    $fullUrl = "${BaseUrl}?${queryString}"

    try {
        Invoke-RestMethod -Uri $fullUrl -Method Get | Out-Null
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] [a2] Hiz: $([Math]::Round($speed,1)) km/h | SOC: $([Math]::Round($soc,1))% | V: $([Math]::Round($voltage,1))V | T: $([Math]::Round($temp,1))C" -ForegroundColor Magenta
    }
    catch {
        Write-Host "Hata: $_" -ForegroundColor Red
    }

    Start-Sleep -Seconds 2
}
