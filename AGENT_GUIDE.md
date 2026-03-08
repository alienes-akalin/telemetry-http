# Antigravity Agent Sistemi Kullanım Rehberi

Bu rehber, `@[../telemetry-http/.agent]` dizinindeki tüm bileşenlerin detaylı açıklamasıdır. Bu sistem, yazılım geliştirme sürecinizi standardize eden, hızlandıran ve kaliteyi artıran bir "Al İşletim Sistemi"dir.

---

## 1. 🤖 Agents (Ajanlar)
**Konum:** `.agent/agents/`

Ajanlar, belirli bir uzmanlık alanına sahip kişiliklerdir. Bir görevi yerine getirirken "hangi şapkayı" takacağımızı belirlerler. Sistem, isteğinize göre uygun ajanı otomatik seçer.

| Ajan Dosyası | Uzmanlık Alanı | Ne Zaman Kullanılır? |
|--------------|----------------|----------------------|
| `backend-specialist` | Sunucu, API, Veritabanı | API endpoint yazarken, DB şeması tasarlarken. |
| `frontend-specialist` | Web Arayüzü (UI/UX) | React/Next.js bileşenleri, CSS, HTML işleri. |
| `mobile-developer` | Mobil Uygulamalar | React Native, Flutter, iOS/Android geliştirme. |
| `database-architect` | Veri Mimarisi | Karmaşık veritabanı ilişkileri ve optimizasyon. |
| `devops-engineer` | CI/CD, Dağıtım | Docker, deployment scriptleri, sunucu ayarları. |
| `security-auditor` | Güvenlik | Kod incelemesi, güvenlik açığı taraması. |
| `project-planner` | Planlama | Büyük görevleri parçalara ayırma, yol haritası. |
| `orchestrator` | Koordinasyon | Birden fazla ajanı yöneten "orkestra şefi". |
| `code-archaeologist` | Eski Kod Analizi | Legacy kodları anlama ve refactor etme. |
| `debugger` | Hata Çözme | Karmaşık bug'ların kök nedenini bulma. |
| `documentation-writer`| Dokümantasyon | README, API docs, kullanım kılavuzları yazma. |
| `test-engineer` | Test Yazımı | Unit test, entegrasyon testleri oluşturma. |
| `qa-automation-engineer`| Test Otomasyonu | E2E (Uçtan uca) test otomasyonları (Playwright vb.). |
| `product-manager` | Ürün Yönetimi | Gereksinim analizi, MVP kapsamı belirleme. |
| `product-owner` | İş Değeri | Müşteri odaklı önceliklendirme ve kararlar. |
| `performance-optimizer`| Performans | Hız optimizasyonu, darboğaz analizi. |
| `seo-specialist` | Arama Motoru Opt. | SEO ayarları, meta etiketler, sitemap. |
| `game-developer` | Oyun Geliştirme | Oyun mekanikleri, fizik motorları, grafikler. |
| `penetration-tester` | Sızma Testi | Güvenlik açıklarını aktif olarak deneme. |
| `explorer-agent` | Keşif | Dosya yapısını ve projenin genel durumunu anlama. |

**Nasıl Kullanılır:**
Genellikle otomatiktir. Ancak manuel olarak çağırmak isterseniz:
> "Sana @backend-specialist olarak soruyorum, bu API nasıl olmalı?"

---

## 2. ⚡ Workflows (İş Akışları)
**Konum:** `.agent/workflows/`

Slash (`/`) komutları ile tetiklenen adım adım prosedürlerdir.

| Komut | Açıklama |
|-------|----------|
| `/analyze-project-changes` | Projedeki son değişiklikleri analiz eder ve raporlar. |
| `/brainstorm` | Fikir geliştirme ve beyin fırtınası oturumu başlatır. |
| `/create` | Yeni bir uygulama, modül veya dosya oluşturma sihirbazı. |
| `/debug` | **Sistematik Hata Ayıklama:** Hipotez kurar, test eder ve çözer. |
| `/deploy` | Yayına alma süreci (Build -> Test -> Deploy). |
| `/enhance` | Mevcut bir özelliği geliştirmek veya iyileştirmek için kullanılır. |
| `/orchestrate` | Büyük bir görevi birden fazla ajana dağıtarak yönetir. |
| `/plan` | **Planlama Modu:** Kod yazmadan önce detaylı `implementation_plan.md` hazırlar. |
| `/preview` | Uygulamanın önizleme sunucusunu başlatır/yönetir. |
| `/status` | Projenin ve ajanların mevcut durumunu raporlar. |
| `/test` | Test oluşturma ve çalıştırma akışı. |
| `/ui-ux-pro-max` | Üst düzey UI/UX tasarımı ve geliştirmesi yapar. |

**Nasıl Kullanılır:**
Sohbet satırına komutu yazın:
> `/plan Kullanıcı giriş sayfası tasarımı`

---

## 3. 🧠 Skills (Yetenekler)
**Konum:** `.agent/skills/`

Ajanların kullandığı "bilgi ve araç paketleridir". Her biri belirli bir konuda derinlemesine rehberlik ve betikler içerir.

### Yazılım Geliştirme
- **`app-builder`**: Uygulama iskeleti kurucu.
- **`api-patterns`**: REST, GraphQL vb. API tasarım standartları.
- **`clean-code`**: Temiz kod prensipleri (SOLID, DRY).
- **`code-review-checklist`**: Kod inceleme ve kalite kontrol listeleri.
- **`documentation-templates`**: Hazır doküman şablonları.
- **`git-workflow`**: Git kullanım standartları.
- **`nodejs-best-practices`**: Node.js için en iyi uygulamalar.
- **`python-patterns`**: Pythonik kod yazma rehberi.
- **`tdd-workflow`**: Test Odaklı Geliştirme (TDD) akışı.

### Frontend & Tasarım
- **`frontend-design`**: Modern CSS, layout ve görsel tasarım.
- **`frontend-design-V2`**: Gelişmiş tasarım düşüncesi (renk, tipografi).
- **`mobile-design`**: Mobil odaklı tasarım kalıpları.
- **`nextjs-react-expert`**: React ve Next.js optimizasyon teknikleri.
- **`tailwind-patterns`**: Tailwind CSS kullanım standartları.
- **`web-design-guidelines`**: Erişilebilirlik ve kullanılabilirlik kuralları.
- **`i18n-localization`**: Çoklu dil ve yerelleştirme desteği.

### Backend & Veri
- **`database-design`**: Veritabanı şema tasarımı ve SQL/NoSQL kararları.
- **`server-management`**: Sunucu yönetimi ve yapılandırma.
- **`mcp-builder`**: Model Context Protocol sunucuları oluşturma.

### Test & Kalite
- **`testing-patterns`**: Genel test stratejileri.
- **`webapp-testing`**: Web uygulamaları için E2E testleri (Playwright).
- **`lint-and-validate`**: Kod stili ve hata denetimi (Linter).
- **`systematic-debugging`**: Hata ayıklama metodolojisi.

### Güvenlik & Performans
- **`security-scanner` / `vulnerability-scanner`**: Güvenlik açığı taraması.
- **`red-team-tactics`**: Saldırı simülasyonu ve savunma testleri.
- **`performance-profiling`**: Hız ve kaynak kullanım analizi.
- **`seo-fundamentals`**: Arama motoru optimizasyonu temelleri.
- **`geo-fundamentals`**: Generative Engine Optimization (AI motorları için optimizasyon).

### Diğer
- **`bash-linux`**: Linux komut satırı ipuçları.
- **`powershell-windows`**: Windows terminal yönetimi.
- **`game-development`**: Oyun geliştirme araçları.
- **`feature-adviser`**: Özellik öneri sistemi.
- **`prompt-enhancer`**: AI istemlerini (prompt) iyileştirme.
- **`intelligent-routing`**: İsteği doğru ajana yönlendirme sistemi.
- **`parallel-agents`**: Çoklu ajan çalışma mantığı.
- **`plan-writing`**: Plan dosyalama formatları.
- **`behavioral-modes`**: Ajan davranış modları (Plan, Act, Check).

---

## 4. 📜 Rules (Kurallar)
**Konum:** `.agent/rules/`

Bu klasör, ajanın "Anayasası"nı içerir. `GEMINI.md` dosyası en kritik dosyadır ve şu protokolleri zorunlu kılar:

### 🛑 Socratic Gate (Sokratik Kapı)
Her karmaşık istek (yeni özellik, build vb.) öncesinde ajan **durmalı ve soru sormalıdır**.
- **Amaç:** Yanlış anlaşılmaları önlemek.
- **Kural:** Eğer isteğiniz belirsizse, ajan hemen kod yazmaz, size "3 Stratejik Soru" sorar.

### 🤖 Intelligent Agent Routing (Akıllı Yönlendirme)
Ajan, her cevabından önce **hangi uzman kimliğine bürüneceğini** seçmek zorundadır.
- Örnek: `🤖 Applying knowledge of @backend-specialist...`
- Bunu manuel olarak zorlayabilirsiniz: `@mobile-developer bu butonu düzelt` diyerek.

### 🎨 Design Rules (Tasarım Kuralları)
`frontend-specialist` ve `mobile-developer` için geçerli olan katı kurallar:
- **Purple Ban:** Mor/Menekşe renklerinin kullanımı (özel durumlar harici) yasaktır.
- **Template Ban:** Standart, sıkıcı "Bootstrap" veya "Material UI" görünümleri yerine modern, özel tasarımlar zorunludur.
- **Anti-Cliché:** Sıradan AI tasarımlarından kaçınılmalıdır.

### 🧹 Tier 0 & Tier 1 Kuralları
- **Dil:** Siz Türkçe konuşursanız Türkçe, İngilizce konuşursanız İngilizce yanıt verir.
- **Read -> Understand -> Apply:** Ajan ezbere iş yapamaz. Önce ilgili `SKILL.md` dosyasını okuyup, oradaki prensipleri anladıktan sonra kodu yazar.

---

## 5. 🛠️ Scripts (Betikler)
**Konum:** `.agent/scripts/`

Proje genelinde çalışan "Master" otomasyon araçlarıdır.

| Script | Komut | Ne Yapar? |
|--------|-------|-----------|
| `checklist.py` | `python .agent/scripts/checklist.py .` | **Ana Sağlık Kontrolü.** Güvenlik, lint, test ve diğer tüm kontrolleri sırayla çalıştırır. Projeyi teslim etmeden önce MUTLAKA çalıştırılmalıdır. |
| `verify_all.py` | `python .agent/scripts/verify_all.py` | Tüm doğrulama adımlarını tetikler. |
| `auto_preview.py`| `python .agent/scripts/auto_preview.py` | Değişiklikleri canlı izler ve önizleme sunucusunu yönetir. |
| `session_manager.py` | (Dahili) | Oturum durumunu ve bağlamı yönetir. |

**Örnek Kullanım:**
> "Projeyi tamamladım, son kontrolleri yap." -> Ajan `checklist.py` çalıştırır.

---

## � Nasıl Başlanır?

1. **Yeni misiniz?** `/analyze-project-changes` ile projeyi tanımasını sağlayın.
2. **Bir şey mi yapacaksınız?** `/plan` ile başlayın.
3. **Sorun mu var?** `/debug` komutunu kullanın.
4. **Kod mu yazacaksınız?** İlgili uzmana danışın (örn. `@frontend-specialist`).
5. **Bitirdiniz mi?** `python .agent/scripts/checklist.py .` çalıştırarak onay alın.
