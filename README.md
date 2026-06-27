# MUN Kriz Yardımcısı

Model United Nations (MUN) **kriz komitesi** için tarayıcı tabanlı, cihazlar arası
senkronize bir yardımcı uygulama. Telefon, tablet ve bilgisayardan **aynı oda koduyla**
girip **aynı verileri** görürsün. Türkçe arayüz, koyu/açık tema, çevrimdışı destek (PWA).

## Özellikler

- **Sekme 1 – Kriz Güncellemeleri (Timeline):** başlık, tarih/saat, açıklama, fotoğraf
  (kamera veya galeri), ve serbest "etiket: değer" sayısal veriler (ör. `Kayıp: 500`,
  `Bütçe: 2M$`). En yeni en üstte.
- **Sekme 2 – Kişiler & Müttefikler:** isim, ülke/rol, kategori (Müttefik/Muhalif/Nötr,
  renk kodlu), not, fotoğraf. Kategoriye göre filtre, düzenle/sil.
- **Sekme 3 – Notlar & Teklifler:** başlık, açıklama, durum (Beklemede/Kabul/Reddedildi,
  renk kodlu), destekleyenler (serbest metin veya Sekme 2'deki kişilerden seç).
- **Sekme 4 – İletişim Günlüğü:** kiminle, ne zaman, ne konuşuldu (gizli notlar).
- **Sekme 5 – Harita & Genel Bilgi:** birden çok harita linki (yeni sekmede açılır) +
  serbest "Ülke Profili" metin alanı (otomatik kaydeder).
- **Yedekle / Dışa Aktar:** tüm veriler tek JSON dosyası olarak indirilir.
- **Çevrimdışı:** uygulama kabuğu önbelleğe alınır; çevrimdışıyken okuma ve metin ekleme
  yapılabilir, bağlantı gelince otomatik senkronlanır. Üstte çevrimiçi/çevrimdışı göstergesi.

## Teknik Yaklaşım

| Katman | Seçim | Neden |
|--------|-------|-------|
| Frontend | **Vite + vanilla JS** (statik build) | Bağımlılık az, Cloudflare Pages'e statik dosya olarak çıkar. |
| Veritabanı + senkron | **Supabase (PostgreSQL)** | Ücretsiz katman, tarayıcıdan doğrudan erişim, ayrı sunucu yok. |
| Fotoğraf | **Supabase Storage** | Fotoğraflar bulutta; her cihazdan görünür. |
| Giriş | **Oda kodu + RLS** | Tek paylaşılan kod; sunucuda Row Level Security ile zorlanır. |
| Hosting | **Cloudflare Pages** | Supabase ile sorunsuz çalışır (frontend statik, Supabase'e tarayıcıdan bağlanır). |

### Güvenlik modeli (public repo için önemli)

- **Hiçbir gizli bilgi koda gömülmez.** Supabase URL ve `anon` anahtarı `.env` üzerinden
  build sırasında enjekte edilir; gerçek `.env` `.gitignore`'dadır.
- Supabase `anon` anahtarı **tasarım gereği** herkese açıktır (tarayıcıya gömülür) ve
  **Row Level Security (RLS)** ile korunur — tek başına hiçbir veriye erişim vermez.
- **Oda kodu / PIN hiçbir yere gömülmez.** Kullanıcı uygulamada çalışma anında girer.
  Her istek bu kodu `x-room-code` başlığıyla gönderir; Postgres RLS politikaları yalnızca
  doğru kodla eşleşen verilere erişim verir. Yani oda kodu, sunucu tarafında zorlanan bir
  erişim anahtarı gibi davranır.
  > Not: PIN'i bir ortam değişkenine koyup tarayıcı paketine gömmek **güvenlik sağlamaz**
  > (derlenmiş JS'te görünür olurdu). Bu yüzden burada daha güçlü olan "oda kodu = RLS
  > anahtarı" modeli kullanıldı. **Tahmin edilmesi zor, uzun bir oda kodu seç.**

---

## Kurulum

### 0. Gereksinimler
- Node.js 18+ ve npm
- Ücretsiz bir [Supabase](https://supabase.com) hesabı
- (Deploy için) Bir [Cloudflare](https://dash.cloudflare.com) hesabı

### 1. Supabase projesi oluştur
1. Supabase'de **New project** ile bir proje aç (bölge: sana yakın olanı seç).
2. Soldan **SQL Editor** → **New query** → bu repodaki [`supabase/schema.sql`](supabase/schema.sql)
   dosyasının içeriğini yapıştır → **Run**. Bu, tabloları, RLS politikalarını ve
   `mun-photos` storage bucket'ını oluşturur.
3. **Project Settings → API** sayfasından şunları kopyala:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** anahtarı → `VITE_SUPABASE_ANON_KEY`

### 2. Yerelde çalıştır
```bash
npm install
cp .env.example .env        # Windows PowerShell: copy .env.example .env
# .env içine kendi Supabase URL ve anon key değerlerini yaz
npm run dev
```
Tarayıcıda açılan adrese git, bir **oda kodu** belirle (ekibinle bunu paylaşacaksın).

### 3. Üretim derlemesi
```bash
npm run build      # çıktı: dist/
npm run preview    # dist/ önizlemesi
```

---

## Ortam Değişkenleri

| Değişken | Açıklama | Nereden |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Supabase proje URL'i | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase `anon public` anahtarı | Supabase → Settings → API |

> `VITE_` önekli değişkenler Vite tarafından build sırasında istemci paketine enjekte
> edilir. Bu yüzden Cloudflare'da bunları **build (production) ortamı** için ayarlamalısın.
> Oda kodu burada **yer almaz** — o, uygulama içinde girilir.

---

## Cloudflare Pages'e Deploy

### Yöntem A — Cloudflare panelinden (önerilen, en kolay)

1. Projeyi GitHub'a (public repo) push et.
2. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** →
   **Connect to Git** → repoyu seç.
3. Build ayarları:
   - **Framework preset:** `Vite` (yoksa "None")
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. **Environment variables (Build / Production)** bölümüne şunları ekle:
   - `VITE_SUPABASE_URL` = `https://....supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJ...`
   > Aynı değişkenleri **Preview** ortamı için de eklemek istersen tekrar gir.
5. **Save and Deploy.** Her `git push`'ta otomatik yeniden deploy olur.
6. Deploy sonrası açtığın adreste oda kodunu gir; aynı kodu telefonda/tablette de gir.

> Ortam değişkenini sonradan eklediysen, **Deployments → son deployment → Retry deployment**
> ile yeniden derle (değişkenler build anında gömülür).

### Yöntem B — Wrangler CLI ile

```bash
npm install -g wrangler
wrangler login

# Build et
npm run build

# İlk yüklemede proje adı sorulur
wrangler pages deploy dist --project-name=mun-helper
```
CLI ile build-time `VITE_*` değişkenlerini panelde (Settings → Environment variables) bir
kez ayarlamak en sağlıklısıdır; alternatif olarak yerelde `.env` ile `npm run build` alıp
hazır `dist/` klasörünü `wrangler pages deploy dist` ile yükleyebilirsin (değerler dist'e
gömülü gelir).

### Yöntem C — Cloudflare Workers (Git bağlantılı, `wrangler deploy`)

Eğer projeyi **Workers** (Pages değil) olarak Git'e bağladıysan, deploy komutu
`npx wrangler deploy` olur. Bu durumda site statik olduğu için iki şey gerekir:

1. **`wrangler.jsonc`** (bu repoda hazır): sunucu kodu olmadan yalnızca `dist/` klasörünü
   statik dosya (assets-only) olarak yayınlar.
2. **Build adımının çalışması:** `wrangler deploy` tek başına `npm run build` çalıştırmaz.
   Cloudflare panelinde **Deploy command**'i şu şekilde ayarla:
   ```
   npm run deploy
   ```
   (`npm run deploy` = `npm run build && wrangler deploy`). Alternatif: **Build command** =
   `npm run build`, **Deploy command** = `npx wrangler deploy`.
3. **Build ortam değişkenleri (ÇOK ÖNEMLİ):** `VITE_*` değişkenleri **build sırasında**
   pakete gömülür. Bu yüzden bunları Worker'ın *runtime* değişkenlerine değil,
   **Build yapılandırmasının** değişkenlerine eklemelisin:
   *Workers projesi → Settings → Build → Variables and Secrets* altına:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   > Runtime (Worker) değişkenleri Vite build'ine ulaşmaz; mutlaka **Build** değişkeni olmalı.
4. Değişiklikleri push et → deploy otomatik tetiklenir (veya panelden "Retry/Redeploy").

> Daha basit istiyorsan **Yöntem A (Cloudflare Pages)**'e geçebilirsin: statik siteler için
> en doğrudan yol odur ve `wrangler.jsonc` gerektirmez.

---

## Fotoğraf gizliliği notu
`mun-photos` bucket'ı **public**'tir (görsellerin `<img>` ile kolayca yüklenmesi için).
Dosya yolları rastgele UUID + oda kodu klasörü içerir, ama URL'yi bilen biri görseli
açabilir. MUN bağlamı için bu kabul edilebilir. Daha katı gizlilik istersen bucket'ı
private yapıp imzalı URL (signed URL) kullanacak şekilde genişletmek gerekir.

## Çevrimdışı davranış
- Uygulama kabuğu (HTML/JS/CSS) service worker ile önbelleğe alınır → çevrimdışı açılır.
- Veriler son çekilen haliyle yerel olarak saklanır → çevrimdışı görüntülenir.
- Çevrimdışı eklenen/silinen kayıtlar bir kuyruğa alınır, bağlantı gelince otomatik gönderilir.
- **Fotoğraf yükleme** internet gerektirir; çevrimdışıyken kayıt fotoğrafsız eklenir ve uyarı gösterilir.

## Proje yapısı
```
mun-helper/
├── index.html
├── package.json / vite.config.js
├── .env.example / .gitignore
├── public/icon.svg
├── supabase/schema.sql        # tablolar + RLS + storage
└── src/
    ├── main.js                # uygulama orkestrasyonu
    ├── style.css
    ├── config.js / supabase.js / auth.js
    ├── store.js / api.js / sync.js / photos.js / ui.js
    └── tabs/{timeline,contacts,proposals,commlog,map}.js
```
