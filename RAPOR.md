# Ezan Vakti — Kod İnceleme Raporu

İncelenen dosyalar: `index.html`, `sw.js`, `manifest.json`, ikon ve ses dosyaları, tüm git geçmişi.

**Genel durum:** Repoda ve git geçmişinde **API anahtarı, şifre, token veya başka gizli bilgi bulunmadı.** Uygulama tamamen istemci taraflı (sunucu, veritabanı, kullanıcı hesabı/kimlik doğrulama yok); bu nedenle kimlik doğrulama açığı söz konusu değil. Asıl riskler dış API verisinin işlenmesi, service worker önbellekleme mantığı ve birkaç işlevsel hatadır.

---

## A. Bu PR'da düzeltilenler

| # | Öncelik | Sorun | Düzeltme |
|---|---|---|---|
| 1 | **Yüksek** | **XSS:** `api.alquran.cloud`'dan gelen sure adları, ayet metinleri ve meal, kaçışlanmadan `innerHTML` ile sayfaya basılıyordu. API ele geçirilirse veya araya giren bir vekil yanıtı değiştirirse sayfada keyfi JavaScript çalışabilirdi (localStorage verileri, bildirim izni vb. etkilenir). | `esc()` fonksiyonu eklendi; tüm API ve localStorage kaynaklı metinler kaçışlanıyor. |
| 2 | **Yüksek** | **Android'de bildirimler hiç çalışmıyordu:** Android Chrome `new Notification()` kurucusunu desteklemez (hata fırlatır, `try/catch` sessizce yutuyordu). | Bildirimler service worker üzerinden (`registration.showNotification`) gösteriliyor; olmazsa eski yönteme düşülüyor. SW'ye bildirime dokununca uygulamayı açan `notificationclick` eklendi. |
| 3 | Orta | Kayıtlı konum (`ev_loc`) doğrulanmadan kullanılıyordu; bozuk veri tüm vakitleri `NaN` yapıp sayacı bozabiliyordu, `name` alanı imsakiye ekranında HTML olarak basılıyordu. | Enlem/boylam sayı ve aralık kontrolünden geçiyor, isim kaçışlanıyor ve 60 karakterle sınırlanıyor. |
| 4 | Orta | **Namaz takibi / tesbih yanlış güne yazılıyordu:** gün anahtarı `toISOString()` (UTC) ile üretiliyordu; Türkiye'de 00:00–03:00 arası işaretlenen namaz/zikir önceki güne kaydediliyordu. | Yerel tarihle anahtar üretiliyor (mevcut kayıtlarla uyumlu, biçim aynı `YYYY-AA-GG`). |
| 5 | Orta | Gece yarısı geçince takip kartı yenilenmiyordu; uygulama açık kalırsa yeni günün işaretleri dünkü güne yazılıyordu. | Gün değişiminde `renderTracker()` çağrılıyor. |
| 6 | Orta | Service worker, `api.alquran.cloud`'un hata yanıtlarını (429/500) da önbelleğe yazıp iyi kopyayı eziyordu; çevrimdışıyken hata sayfası dönüyordu. GET dışı istekler de `cache.put` ile hataya yol açabilirdi. | Yalnızca `res.ok` yanıtlar önbelleğe alınıyor; GET dışı istekler SW'de işlenmiyor. |
| 7 | Orta | Ses dosyası Range desteğinde `bytes=-N` (son N bayt) biçimi yanlış yorumlanıyor, dosya boyunu aşan bitiş değeri sınırlanmıyor, geçersiz aralıkta bozuk 206 dönülüyordu. | Aralık ayrıştırma düzeltildi, sınırlar kırpılıyor, geçersiz aralıkta 416 dönülüyor. SW sürümü `v9`'a yükseltildi (yeni dosyalar kullanıcılara ulaşsın). |
| 8 | Orta | Kıble pusulası (Android): hem `deviceorientationabsolute` hem `deviceorientation` dinleniyordu; kuzeye bağlı olmayan göreli `alpha` değeri doğru yönü sürekli eziyor, ibre titriyor/yanlış gösteriyordu. | Mutlak yön verisi geldikten sonra göreli olaylar yok sayılıyor. |
| 9 | Düşük | Kur'an: sure yüklenirken geri dönülürse, geç gelen yanıt sure listesinin üstüne yazılıyordu. Sure listesi API hatasında yakalanmamış hata oluşuyordu. | Yanıt geldiğinde hâlâ aynı sure açık mı kontrol ediliyor; `r.ok` ve veri biçimi denetleniyor. |
| 10 | Düşük | Hafız ses adresleri doğrulanmadan `audio.src`'ye veriliyordu; `http:` adresler HTTPS sayfada karışık içerik olarak engellenebilir. | Yalnızca `http(s)` adresler kabul ediliyor, `http` → `https` yükseltiliyor; hafız kodu URL'de `encodeURIComponent` ile kodlanıyor. |
| 11 | Düşük | Masaüstünde ilk tıklama "Ezanı dinle" ise, otomatik türkü de aynı anda başlayıp ezanla üst üste çalıyordu. | Ezan çalıyorsa otomatik türkü başlatılmıyor. |
| 12 | Düşük | `sunDot`, `sunGlow`, `arcProgress` öğelerine tanımsız global değişken (tarayıcının id→global davranışı) üzerinden erişiliyordu. | `getElementById` ile açıkça alınıyor. |
| 13 | Düşük | `apple-mobile-web-app-capable` tek başına kullanımdan kalkmış durumda; dış isteklerde tam adres (referrer) sızabiliyordu. | `mobile-web-app-capable` ve `referrer` politikası (`strict-origin-when-cross-origin`) eklendi. |

Doğrulama: Her iki `<script>` bloğu ve `sw.js` sözdizimi kontrolünden geçti; uygulama başsız Chromium'da açılıp vakit listesi, sayaç, imsakiye, tesbihmatik ve bozuk kayıtlı konum senaryosu test edildi — konsolda hata yok.

---

## B. Yapılmayanlar (riskli / büyük değişiklik gerektiren) — öncelik sırasıyla

### Kritik
*Kritik düzeyde bulgu yok.* (Gizli anahtar, kimlik doğrulama atlatma veya sunucu tarafı açık bulunmadı.)

### Yüksek
1. **Telif hakkı / lisans riski — `turku.mp3` ve `ezan.mp3`.** Ticari kayıtlar (Mişari Raşid el-Afâsî ezanı, "Ahlat'ın Başındayım" türküsü) herkese açık bir repoda dağıtılıyor. Kaynağın ve kullanım izninin belgelenmesi ya da lisanslı/serbest kayıtlarla değiştirilmesi önerilir. Hukuki karar gerektirdiği için dokunulmadı.
2. **Ezan ve bildirimler arka planda güvenilir değil.** Vakit kontrolü `setInterval(tick,1000)` ile yapılıyor ve vakte ±1,5 sn pencerede tetikleniyor. Sekme arka plana alınınca veya ekran kapanınca tarayıcılar zamanlayıcıyı dakikada bire kadar kısar ya da tamamen durdurur → ezan ve bildirim **kaçırılır**. Arayüzdeki "bildirimler uygulama arka plandayken de gelir (Android)" notu bu nedenle yanıltıcı. Çözüm: (a) tetikleme penceresini "vakit geçti ama bu vakit için henüz çalınmadı" mantığına çevirmek, (b) gerçek arka plan için Notification Triggers / Push sunucusu veya yerel uygulama. Davranış değişikliği olduğu için yapılmadı.

### Orta
3. **İçerik Güvenliği Politikası (CSP) yok.** XSS düzeltildi ama derinlemesine savunma için CSP eklenmeli. Ancak tüm JS satır içi (`<script>`, `onclick="location.reload()"`), fontlar Google'dan, sesler CDN'den ve `blob:` üzerinden geliyor; yanlış bir CSP uygulamayı bozar. Önce scriptlerin ayrı dosyaya taşınması, sonra şu tarz bir politika önerilir: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://api.alquran.cloud; media-src 'self' blob: https://cdn.islamic.network`.
4. **İlk açılışta ~8,5 MB indirme.** SW kurulumunda `turku.mp3` (6,5 MB) ve `ezan.mp3` (1,9 MB) önbelleğe alınıyor; ayrıca sayfa her açılışta türküyü `fetch` ile tamamen belleğe (blob) yüklüyor — kullanıcı hiç çalmasa bile. Mobil veride ciddi maliyet. Öneri: türküyü CORE listesinden çıkarıp ilk çalmada yüklemek, dosyayı daha düşük bit hızıyla yeniden kodlamak.
5. **Türkü varsayılan olarak otomatik açık.** Kullanıcının ilk dokunuşunda (hangi düğme olursa olsun) izin sorulmadan müzik başlıyor; sessiz ortamda/camide rahatsız edici olabilir. Varsayılanın kapalı olması önerilir — bilinçli bir ürün kararı (v3.2) olduğu için değiştirilmedi.
6. **Google Fonts gizlilik/KVKK-GDPR.** Her açılışta kullanıcının IP adresi Google'a gidiyor (Almanya'da bu nedenle mahkeme kararları var). Fontların repoda barındırılması önerilir.
7. **Yüksek enlem ve DST sorunları.** 48,5°'nin kuzeyinde yaz aylarında imsak/yatsı açısı hesaplanamıyor (`NaN`); bu durumda `toDate` geçersiz tarih üretir, sayaç ve halka bozulur. Ayrıca `toDate` günün başına milisaniye ekleyerek saat hesaplıyor; yaz saati geçiş günlerinde (ör. Belgrad) vakitler 1 saat kayabilir. Hesaplama çekirdeğine dokunmak gerektiği için yapılmadı; yüksek enlem kuralı (ör. "gecenin 1/7'si") ve `setHours(H,M)` tabanlı dönüşüm önerilir.

### Düşük
8. **Sure araması Türkçe adlarla çalışmıyor.** Yer tutucu "ör. Yasin" diyor ama API İngilizce transliterasyon veriyor ("Ya-Seen"); "yasin" araması sonuç döndürmüyor. Türkçe sure adları listesi eklenmeli.
9. **`manifest.json`: `"purpose": "any maskable"`** tek girdide birleştirilmesi önerilmiyor (ikon kırpılabilir); ayrı `any` ve `maskable` ikonları tanımlanmalı.
10. **Kullanılmayan dosyalar:** `icon-192.png`, `icon-512.png` hiçbir yerde referans edilmiyor; silinebilir.
11. **Sınırsız yerel depolama büyümesi:** Her gün için `ev_tasbih_YYYY-AA-GG` anahtarı ve `ev_track` içinde tüm geçmiş tutuluyor; SW önbelleğindeki Kur'an yanıtları da temizlenmiyor. Eski kayıtların (ör. 1 yıldan eski) budanması önerilir.
12. **Ses açma kilidi (`unlockAudio`)** ezanı çalıp hemen durdurduğu için bazı cihazlarda kısa bir ses "çıtırtısı" duyulabilir; sessiz bir ses dosyası veya `AudioContext.resume()` ile yapılması daha temiz olur.
13. **Hassas konum localStorage'da tam hassasiyetle saklanıyor.** Dışarı gönderilmiyor, ancak vakit hesabı için 2–3 ondalık basamak yeterli; gizlilik için yuvarlanabilir.
14. **Test ve CI yok.** Vakit hesaplama fonksiyonları (`computeTimes`, `qiblaBearing`) saf fonksiyonlar; Diyanet takvimiyle karşılaştıran birkaç birim testi regresyonları yakalar.
