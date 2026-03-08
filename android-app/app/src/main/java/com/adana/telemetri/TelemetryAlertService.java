package com.adana.telemetri;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

/**
 * Arka plan telemetri alarm servisi.
 *
 * Foreground Service olarak çalışır — uygulama kapalı veya telefon kilitli
 * olsa bile sunucudan periyodik olarak alarm durumunu kontrol eder.
 *
 * Akış:
 *   10 sn aralıkla GET /api/v1/telemetry/alerts → alarm varsa bildirim göster
 *   Aynı alarm tekrar ederse bildirim tekrarlanmaz (state takibi ile).
 */
public class TelemetryAlertService extends Service {

    private static final String TAG = "TelemetryAlertService";
    private static final String ALERTS_URL = "https://telemetry-aliakalin.com.tr/api/v1/telemetry/alerts";
    private static final long POLL_INTERVAL_MS = 10_000; // 10 saniye

    // Bildirim kanalları
    private static final String CHANNEL_SERVICE = "telemetry_service";
    private static final String CHANNEL_ALERTS = "telemetry_alerts";

    // Alarm bildirim ID'leri (cihaz+tip bazlı sabit, aynı alarm güncellenir)
    private static final int NOTIF_SERVICE = 100;
    private static final int NOTIF_ALERT_BASE = 200;

    private Handler handler;
    private Runnable pollRunnable;

    // Son alarm durumları — aynı alarm tekrar bildirmesin
    private final Set<String> activeAlerts = new HashSet<>();
    // Önceki turda aktif veri akışı olan araçlar — başlangıç bildirimi için
    private final Set<String> previouslyActiveDevices = new HashSet<>();

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Foreground bildirim — servis çalıştığını gösterir
        Notification serviceNotif = buildServiceNotification();
        startForeground(NOTIF_SERVICE, serviceNotif);

        // Polling başlat
        startPolling();

        // Servis öldürülürse yeniden başlat
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null && pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);

            // Servis kanalı — düşük öncelik, sessiz
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_SERVICE, "Telemetri İzleme", NotificationManager.IMPORTANCE_LOW);
            serviceChannel.setDescription("Arka planda telemetri izleme servisi");
            nm.createNotificationChannel(serviceChannel);

            // Alarm kanalı — yüksek öncelik, ses + titreşim
            NotificationChannel alertChannel = new NotificationChannel(
                    CHANNEL_ALERTS, "Telemetri Alarmları", NotificationManager.IMPORTANCE_HIGH);
            alertChannel.setDescription("Sıcaklık ve akım uyarı bildirimleri");
            alertChannel.enableVibration(true);
            nm.createNotificationChannel(alertChannel);
        }
    }

    private Notification buildServiceNotification() {
        Intent notifIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notifIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_SERVICE)
                .setContentTitle("Telemetri İzleniyor")
                .setContentText("Her iki araç için alarm kontrolü aktif")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    private void startPolling() {
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                new Thread(() -> checkAlerts()).start();
                handler.postDelayed(this, POLL_INTERVAL_MS);
            }
        };
        handler.post(pollRunnable);
    }

    private void checkAlerts() {
        try {
            URL url = new URL(ALERTS_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            if (conn.getResponseCode() != 200) {
                Log.w(TAG, "Alert check failed: HTTP " + conn.getResponseCode());
                return;
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            reader.close();

            JSONObject json = new JSONObject(sb.toString());
            JSONArray alerts = json.getJSONArray("alerts");
            JSONArray activeDevicesJson = json.optJSONArray("activeDevices");

            // ==================== VERİ AKIŞI BİLDİRİMİ ====================
            Set<String> currentActiveDevices = new HashSet<>();
            if (activeDevicesJson != null) {
                for (int i = 0; i < activeDevicesJson.length(); i++) {
                    currentActiveDevices.add(activeDevicesJson.getString(i));
                }
            }

            // Yeni aktif olan araçlar için bildirim gönder
            for (String device : currentActiveDevices) {
                if (!previouslyActiveDevices.contains(device)) {
                    showAlertNotification("dataflow:" + device,
                            "📡 Veri Akışı Başladı",
                            device + " canlı veri gönderiyor");
                }
            }
            previouslyActiveDevices.clear();
            previouslyActiveDevices.addAll(currentActiveDevices);

            // ==================== ALARM BİLDİRİMLERİ ====================
            // Mevcut turda gelen alarm key'lerini topla
            Set<String> currentKeys = new HashSet<>();

            for (int i = 0; i < alerts.length(); i++) {
                JSONObject alert = alerts.getJSONObject(i);
                String device = alert.getString("device");
                String type = alert.getString("type");
                String title = alert.getString("title");
                String message = alert.getString("message");

                String key = device + ":" + type;
                currentKeys.add(key);

                // Daha önce bildirildiyse tekrarlama
                if (activeAlerts.contains(key)) continue;

                // Yeni alarm — bildirim göster
                showAlertNotification(key, title, message);
                activeAlerts.add(key);
            }

            // Çözülen alarmları temizle (bir sonraki tetiklendiğinde tekrar bildirilir)
            activeAlerts.retainAll(currentKeys);

        } catch (Exception e) {
            Log.e(TAG, "Alert check error: " + e.getMessage());
        }
    }

    private void showAlertNotification(String key, String title, String message) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, key.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ALERTS)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi);

        NotificationManager nm = getSystemService(NotificationManager.class);
        // Sabit ID: aynı alarm güncellenir, farklı alarmlar ayrı gösterilir
        nm.notify(NOTIF_ALERT_BASE + Math.abs(key.hashCode() % 50), builder.build());
    }
}
