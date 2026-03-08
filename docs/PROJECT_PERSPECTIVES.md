# 1.5 ADANA Telemetri Projesi: Geliştirme Perspektifleri

Bu belge, projenin gelecekteki gelişimi için **Ürün Yönetimi**, **Backend Mimarisi** ve **Frontend Deneyimi** açılarından detaylı bir vizyon sunar.

---

## 🎯 1. Product Manager (Ürün Yöneticisi) Perspektifi

**Odak:** Kullanıcı Değeri, Önceliklendirme ve Yol Haritası

Bir Ürün Yöneticisi olarak, teknik detaylardan çok "bu özelliği neden yapıyoruz?" ve "kullanıcıya ne faydası var?" sorularına odaklanırım.

### 🚀 Vizyon: "Veri Odaklı Yarış Stratejisi"
Amacımız sadece verileri göstermek değil, takımın yarış sırasında **doğru kararları en hızlı şekilde** almasını sağlamaktır.

### Önerilen Özellik Setleri (Yol Haritası)

#### Faz 1: Operasyonel Farkındalık (Mevcut Durum + İyileştirmeler)
*   **Akıllı Alarm Yönetimi:** Pilotun veya pitteki ekibin gözünden kaçabilecek kritik durumların (hücre voltaj dengesizliği, ani sıcaklık artışı) proaktif bildirimi.
*   **Oturum Etiketleme:** Kaydedilen verilere "Antrenman 1", "Sıralama Turu", "Yarış" gibi etiketler ekleyerek sonradan analizi kolaylaştırma.

#### Faz 2: Stratejik Analiz
*   **Tur Karşılaştırma:** "En iyi turumuzda enerji tüketimi nasıldı?" sorusuna cevap veren, turları üst üste bindiren grafikler.
*   **Enerji Tahmini:** Mevcut tüketime göre "Kalan tur sayısı" veya "Yarış sonu batarya durumu" tahmini.

#### Faz 3: Takım Entegrasyonu
*   **Rol Bazlı Dashboard:** 
    *   *Pilot Ekranı:* Sadece Hız, Kalan Menzil, Kritik Uyarılar (Dikkat dağıtmayan arayüz).
    *   *Mühendis Ekranı:* Detaylı hücre voltajları, sıcaklık haritaları, detaylı grafikler.
    *   *Stratejist Ekranı:* Tur zamanları, enerji projeksiyonları.

---

## 🔧 2. Backend Specialist (Arka Uç Uzmanı) Perspektifi

**Odak:** Performans, Güvenlik, Ölçeklenebilirlik ve Veri Bütünlüğü

Bir Backend Uzmanı olarak, sistemin "kaputunun altındaki" motorun sorunsuz, güvenli ve hızlı çalışmasını hedeflerim.

### 🏗️ Mimari Öneriler

#### Veri Akışı Optimizasyonu (WebSocket & Delta Compression)
Telemetri verileri çok sık (örn. 100ms'de bir) gelir. Her seferinde tüm veri setini göndermek yerine, sadece **değişen verileri** göndermek (Delta Compression) ağ trafiğini %80-90 oranında azaltır. Bu, özellikle yarış alanındaki kötü internet koşullarında kritiktir.

#### Veritabanı Stratejisi (Time-Series Data)
Telemetri verisi "Zaman Serisi" (Time-Series) verisidir. MongoDB genel amaçlı harika bir veritabanı olsa da, `TimescaleDB` veya MongoDB'nin `Time Series Collection` özelliği kullanılarak:
*   Sorgu performansı artırılır.
*   Disk alanı kullanımı azaltılır.
*   "Son 1 saatlik ortalama sıcaklık" gibi sorgular milisaniyeler içinde gelir.

#### Güvenlik Katmanı
*   **API Rate Limiting:** Kötü niyetli veya hatalı çalışan bir cihazın sunucuyu kilitlemesini önlemek için istek sınırlandırma.
*   **Audit Logging:** Kim, ne zaman, hangi ayarı değiştirdi? (Örn: "Ahmet, fan açılma sıcaklığını 45°C'den 50°C'ye yükseltti").

---

## 🎨 3. Frontend Specialist (Ön Yüz Uzmanı) Perspektifi

**Odak:** Kullanıcı Deneyimi (UX), Arayüz Tasarımı (UI) ve Performans

Bir Frontend Uzmanı olarak, karmaşık verilerin kullanıcı tarafından "bir bakışta" anlaşılmasını ve uygulamanın "yağ gibi akmasını" sağlarım.

### 🖥️ UX/UI İyileştirme Önerileri

#### "Cognitive Load" (Bilişsel Yük) Yönetimi
Bilişsel yük, kullanıcının o an işlemeye çalıştığı bilgi miktarıdır. Yarış heyecanı sırasında bu yükü minimize etmeliyiz.
*   **Kademeli Bilgi Gösterimi:** Ana ekranda sadece en kritik 5 veri. Detaylar için üzerine tıklama veya ayrı sekmeler.
*   **Görsel Hiyerarşi:** Önemli veriler (Hız, Sıcaklık Uyarısı) büyük ve parlak; az önemli veriler (Log zamanı, IP adresi) küçük ve soluk.

#### Performans Odaklı Render
*   **Canvas/WebGL Grafikler:** React/HTML grafikleri çok veri olduğunda kasabilir. `Canvas` veya `WebGL` tabanlı kütüphaneler (örn: uPlot) ile saniyede binlerce veri noktası akıcı şekilde çizdirilebilir.
*   **Virtual Scrolling:** Geçmiş veri listelerinde (loglar) binlerce satır olsa bile, sadece ekranda görünenleri render ederek (Virtualization) tarayıcının donması engellenir.

#### Mobil Deneyim (Progressive Web App - PWA)
*   **Offline Mode:** İnternet kesilse bile son verilerin ekranda kalması ve uygulamanın "Bağlantı koptu" uyarısıyla çökmemesi.
*   **Touch Targets:** Mobilde butonların ve menülerin parmakla kolayca basılabilecek büyüklükte (min 44px) olması.

---

## 🚀 Özet: Hangi Rol Neye Bakar?

| Rol | Soru | Odak |
| :--- | :--- | :--- |
| **Product Manager** | "Bu özellik, yarışı kazanmamıza nasıl yardım eder?" | Strateji & Değer |
| **Backend Specialist** | "Bu veri akışını 1000 cihaz olsa da kaldırabilir miyiz?" | Altyapı & Güvenlik |
| **Frontend Specialist** | "Pilot bu uyarıyı güneş altında görebilir mi?" | Deneyim & Arayüz |
