package com.adana.telemetri;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.widget.ProgressBar;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private static final String URL = "https://telemetry-aliakalin.com.tr";
    private static final String CHANNEL_ID = "telemetry_alerts";
    private int notificationId = 0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        createNotificationChannel();

        // OTA güncelleme kontrolü — arka planda çalışır, UI'ı bloklamaz
        new UpdateChecker(this).checkForUpdate();

        // Android 13+ için bildirim izni iste, ardından alarm servisini başlat
        requestNotificationPermissionAndStartService();

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        // WebView Ayarları
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webSettings.setAllowFileAccess(true);
        webSettings.setGeolocationEnabled(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);

        // JavaScript Interface - Web'den native bildirim tetiklemek için
        webView.addJavascriptInterface(new AndroidNotificationInterface(), "AndroidNotification");

        // WebChromeClient - <select> dropdown, alert, confirm desteği için GEREKLİ
        webView.setWebChromeClient(new WebChromeClient());

        // URL'yi yükle
        webView.loadUrl(URL);

        // Pull-to-Refresh
        androidx.swiperefreshlayout.widget.SwipeRefreshLayout swipeRefresh = findViewById(R.id.swipeRefresh);
        swipeRefresh.setColorSchemeColors(0xFF3B82F6, 0xFF10B981);
        swipeRefresh.setProgressBackgroundColorSchemeColor(0xFF0F172A);

        swipeRefresh.setOnRefreshListener(() -> {
            webView.reload();
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                // intent:// şeması → native uygulamayı aç, yoksa browser'a düş
                if (url.startsWith("intent://")) {
                    try {
                        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        if (intent.resolveActivity(getPackageManager()) != null) {
                            startActivity(intent);
                        } else {
                            // Uygulama yüklü değil — browser_fallback_url'i tarayıcıda aç
                            String fallback = intent.getStringExtra("browser_fallback_url");
                            if (fallback != null) {
                                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallback)));
                            }
                        }
                    } catch (Exception e) {
                        Log.e("WebView", "Intent parse error: " + e.getMessage());
                    }
                    return true;
                }

                // Dosya içi navigasyon — WebView içinde kalsın
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = "Telemetri Uyarıları";
            String description = "Sıcaklık ve akım uyarı bildirimleri";
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.createNotificationChannel(channel);
        }
    }

    // JavaScript'ten çağrılabilir arayüz
    public class AndroidNotificationInterface {
        @JavascriptInterface
        public void showNotification(String title, String message) {
            // Bildirime tıklayınca uygulamayı aç
            Intent intent = new Intent(MainActivity.this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    MainActivity.this,
                    (title + message).hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle(title)
                    .setContentText(message)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            notificationManager.notify(notificationId++, builder.build());
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ==================== ALARM SERVİSİ ====================

    private static final int NOTIF_PERMISSION_CODE = 1001;

    /**
     * Android 13+ (API 33) bildirim izni gerektirir.
     * İzin verilmişse veya eski sürümse direkt servisi başlatır.
     */
    private void requestNotificationPermissionAndStartService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                        NOTIF_PERMISSION_CODE);
                return;
            }
        }
        startAlertService();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIF_PERMISSION_CODE) {
            // İzin verilsin verilmesin servisi başlat — izin yoksa bildirim görünmez ama servis çalışır
            startAlertService();
        }
    }

    private void startAlertService() {
        Intent serviceIntent = new Intent(this, TelemetryAlertService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }
}
