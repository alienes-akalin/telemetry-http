package com.adana.telemetri;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Log;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * OTA Güncelleme Sistemi
 * 
 * Sunucudan versiyon bilgisini kontrol eder. Yeni versiyon mevcutsa
 * kullanıcıya "Güncelle" / "Devam Et" dialog'ı gösterir.
 * 
 * Akış:
 * 1. checkForUpdate() → sunucuya GET /api/v1/app/version?current=N
 * 2. Yanıt updateAvailable=true ise → showUpdateDialog()
 * 3. Kullanıcı "Güncelle" derse → downloadAndInstall()
 * 4. DownloadManager ile APK indirilir → BroadcastReceiver ile kurulum başlatılır
 */
public class UpdateChecker {

    private static final String TAG = "UpdateChecker";
    
    // Sunucu adresi — production'da domain, geliştirmede IP olabilir
    private static final String VERSION_CHECK_URL = "https://telemetry-aliakalin.com.tr/api/v1/app/version";

    private final Activity activity;
    private long downloadId = -1;

    public UpdateChecker(Activity activity) {
        this.activity = activity;
    }

    /**
     * Arka planda versiyon kontrolü yapar. 
     * UI thread'i bloklamaz — sonucu main thread'e post eder.
     */
    public void checkForUpdate() {
        new Thread(() -> {
            try {
                int currentVersionCode = getCurrentVersionCode();

                URL url = new URL(VERSION_CHECK_URL + "?current=" + currentVersionCode);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);

                int responseCode = conn.getResponseCode();
                if (responseCode != 200) {
                    Log.w(TAG, "Versiyon kontrolü başarısız: HTTP " + responseCode);
                    return;
                }

                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                JSONObject json = new JSONObject(response.toString());
                boolean updateAvailable = json.getBoolean("updateAvailable");
                
                if (updateAvailable) {
                    String versionName = json.getString("versionName");
                    String releaseNotes = json.getString("releaseNotes");
                    String downloadUrl = json.getString("downloadUrl");
                    boolean forceUpdate = json.optBoolean("forceUpdate", false);
                    double apkSizeMb = json.optDouble("apkSizeMb", -1);

                    // Dialog'u UI thread'de göster
                    activity.runOnUiThread(() -> 
                        showUpdateDialog(versionName, releaseNotes, downloadUrl, forceUpdate, apkSizeMb)
                    );
                } else {
                    Log.i(TAG, "Uygulama güncel (v" + currentVersionCode + ")");
                }

            } catch (Exception e) {
                Log.e(TAG, "Güncelleme kontrolü hatası: " + e.getMessage());
                // Sessizce başarısız ol — kullanıcıyı rahatsız etme
            }
        }).start();
    }

    /**
     * Mevcut uygulama versionCode'unu döndürür.
     */
    private int getCurrentVersionCode() {
        try {
            PackageInfo pInfo = activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return (int) pInfo.getLongVersionCode();
            } else {
                return pInfo.versionCode;
            }
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "Paket bulunamadı", e);
            return 0;
        }
    }

    /**
     * Güncelleme mevcut dialog'unu gösterir.
     * 
     * @param versionName   Yeni versiyon adı (ör: "1.2")
     * @param releaseNotes  Güncelleme notları
     * @param downloadUrl   APK indirme URL'i
     * @param forceUpdate   Zorunlu güncelleme ise "Devam Et" butonu gösterilmez
     * @param apkSizeMb     APK dosya boyutu (MB), bilinmiyorsa -1
     */
    private void showUpdateDialog(String versionName, String releaseNotes, 
                                   String downloadUrl, boolean forceUpdate, double apkSizeMb) {
        // Boyut bilgisi
        String sizeInfo = (apkSizeMb > 0) 
                ? String.format("\n\n📦 İndirilecek boyut: %.1f MB", apkSizeMb)
                : "";

        String message = "📌 Yeni sürüm: v" + versionName
                + sizeInfo
                + "\n\n" + releaseNotes
                + "\n\nGüncellemek ister misiniz?";

        AlertDialog.Builder builder = new AlertDialog.Builder(activity)
                .setTitle("Güncelleme Mevcut")
                .setMessage(message)
                .setCancelable(!forceUpdate)
                .setPositiveButton("Güncelle", (dialog, which) -> {
                    downloadAndInstall(downloadUrl, versionName);
                });

        // Zorunlu güncelleme değilse "Devam Et" butonu ekle
        if (!forceUpdate) {
            builder.setNegativeButton("Devam Et", (dialog, which) -> {
                dialog.dismiss();
            });
        }

        builder.show();
    }

    /**
     * DownloadManager ile APK'yı indirir ve kurulumu başlatır.
     * 
     * @param downloadUrl APK dosyasının tam URL'i
     * @param versionName İndirme bildiriminde gösterilecek versiyon
     */
    private void downloadAndInstall(String downloadUrl, String versionName) {
        try {
            // Önceki indirmeyi temizle
            File downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (downloadDir != null) {
                File oldApk = new File(downloadDir, "telemetri-update.apk");
                if (oldApk.exists()) {
                    oldApk.delete();
                }
            }

            Toast.makeText(activity, "Güncelleme indiriliyor...", Toast.LENGTH_SHORT).show();

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(downloadUrl))
                    .setTitle("Telemetri v" + versionName)
                    .setDescription("Güncelleme indiriliyor...")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalFilesDir(activity, 
                            Environment.DIRECTORY_DOWNLOADS, "telemetri-update.apk")
                    .setMimeType("application/vnd.android.package-archive");

            DownloadManager downloadManager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            downloadId = downloadManager.enqueue(request);

            // İndirme tamamlanınca kurulumu başlat
            BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id == downloadId) {
                        activity.unregisterReceiver(this);
                        installApk();
                    }
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                activity.registerReceiver(downloadReceiver,
                        new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                        Context.RECEIVER_EXPORTED);
            } else {
                activity.registerReceiver(downloadReceiver,
                        new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
            }

        } catch (Exception e) {
            Log.e(TAG, "İndirme başlatılamadı: " + e.getMessage());
            Toast.makeText(activity, "İndirme başarısız: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    /**
     * İndirilen APK dosyasını kurulum intent'i ile açar.
     * Android 7+ (API 24) için FileProvider kullanır.
     */
    private void installApk() {
        try {
            File downloadDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            File apkFile = new File(downloadDir, "telemetri-update.apk");

            if (!apkFile.exists()) {
                Toast.makeText(activity, "APK dosyası bulunamadı", Toast.LENGTH_LONG).show();
                return;
            }

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            
            Uri apkUri = FileProvider.getUriForFile(activity,
                    activity.getPackageName() + ".fileprovider", apkFile);
            
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            activity.startActivity(installIntent);

        } catch (Exception e) {
            Log.e(TAG, "Kurulum başlatılamadı: " + e.getMessage());
            Toast.makeText(activity, "Kurulum başarısız: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }
}
