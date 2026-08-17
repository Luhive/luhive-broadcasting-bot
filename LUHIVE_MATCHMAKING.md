# Luhive Community Matchmaking — Proje Anayasası

> Kaynak: CTO'nun whiteboard diyagramı + bu konuşmada netleştirilen kararlar.
> Diyagramdaki "açık soru" (bot mu kanal mı) ve "Register" butonunun davranışı bu
> dokümanla **kapatıldı**. Aşağıda hâlâ açık bırakılan 2 varsayım var (§8) — onlar
> onaylanmadan build'e başlanmaz.

---

## 1. Problem ve Çözüm

**Problem:** Luhive'in 25+ topluluğu var. Her biri kendi etkinliğini kendi kapalı çevresinde duyuruyor. Bir topluluğun üyesi, başka bir topluluğun etkinliğini **hiçbir zaman görmüyor** — çünkü aralarında bir keşif/eşleştirme mekanizması yok ve bu iş herhangi bir sosyal medya algoritmasına bırakılmıyor.

**Çözüm:** Tüm 25+ topluluğun etkinliklerini tek bir merkezi noktaya (Supabase) düşürüp, oradan hem bir **Telegram kanalına** hem de bota bağlı her kullanıcıya **DM olarak** dağıtan bir sistem — "Luhive Community Engine".

---

## 2. Kapsam

**Var:**
- Topluluk sahiplerinin kendi etkinliklerini eklediği self-serve bir form
- Yeni etkinlik yayınlandığında hem Telegram kanalına post, hem bota bağlı her kullanıcıya DM
- Etkinlik kartı: kapak görseli, isim, tarih, konum, hangi topluluktan geldiği
- İki aksiyon: **Register** (sadece Luhive'in kendi etkinliklerinde, harici linke yönlendirir) ve **Detaylar** (açıklamayı bot içinde gösterir, her etkinlikte var)
- Azerbaycan dili varsayılan, İngilizce sonradan eklenir

**Yok (bu fazda):**
- Partner topluluk etkinlikleri için bot içinde kayıt toplama — bu topluluklar kendi kayıt sistemlerini yönetiyor, Luhive'in bota bunu üstlenmesi yok
- Ödeme, biletleme
- Kullanıcı profili / ilgi alanı bazlı öneri algoritması — matchmaking şu an "herkes her etkinliği görür" seviyesinde, kişiselleştirme yok
- Topluluk sahipleri için tam bir admin panel/dashboard — sadece tek bir gönderim formu var

---

## 3. Mimari

```
Topluluk sahibi (self-serve form)
        │
        ▼
   Supabase (events tablosu, status='published')
        │
        ├──► Supabase Database Webhook ──► Telegram Bot Webhook (Edge Function)
        │                                          │
        │                                          ├──► Kanala post (sendMessage + inline keyboard)
        │                                          └──► Her subscriber'a DM (sendMessage + inline keyboard)
        │
        └──► (kullanıcı botta "Detaylar" tıklar) ──► callback_query ──► Edge Function ──► açıklamayı DM'e yazar
```

### Neden bu mimari
- **Supabase zaten kurulu** (Luhive'in ana ürünü orada). Yeni backend/hosting açmıyoruz, sadece yeni tablolar ekliyoruz.
- **Telegram webhook handler = Supabase Edge Function.** Ayrı bir sunucu (VPS, Railway) veya serverless platform (Vercel) açmaya gerek yok — bot'un DB'ye ihtiyacı olan her işlemi (subscriber kaydı, etkinlik okuma) zaten aynı yerde. Long polling **kullanılmaz**, her zaman webhook — polling ayrı bir sürekli process ister, bu da bakım yükü demektir.
- **Supabase Database Webhook** (`events` tablosunda `INSERT`/`UPDATE ... WHERE status = 'published'`), yeni etkinlik yayınlandığında otomatik olarak Edge Function'ı tetikler. Bu, "yeni etkinlik yayınlandı" olayını manuel bir cron veya polling'e ihtiyaç duymadan yakalar.

---

## 4. Veritabanı Şeması

Mevcut Supabase projesine **eklenir**, var olan hiçbir tabloya dokunulmaz.

```sql
create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_luhive boolean not null default false,   -- Register butonu mantığı bunu okur
  submission_token text not null unique,       -- self-serve form erişimi, tahmin edilemez (32 char)
  telegram_channel_id text,                    -- şimdilik tek kanal, ileride çoklu ihtimaline karşı ayrı kolon
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  title text not null,
  description text not null,
  cover_image_url text,
  event_date timestamptz not null,
  event_location text not null,
  registration_url text,                        -- sadece is_luhive=true topluluklarda kullanılır
  status text not null default 'pending'
    check (status in ('pending', 'published', 'cancelled')),
  telegram_message_id text,                     -- kanal post'unu sonradan güncellemek/silmek için
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table telegram_subscribers (
  id bigint primary key,                        -- Telegram user_id, kendisi zaten benzersiz
  username text,
  language text not null default 'az' check (language in ('az', 'en')),
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table dm_delivery_log (
  event_id uuid not null references events(id) on delete cascade,
  subscriber_id bigint not null references telegram_subscribers(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (event_id, subscriber_id)
);
```

### RLS
- `communities`, `events`: **hiçbir client-side anon erişim yok.** Self-serve form, `submission_token`'ı **server-side** (Edge Function içinde) doğrular ve `service_role` ile yazar. Anon key ile doğrudan insert **yasak** — token client'a düşse bile forge edilmiş event insert edilemez.
- `telegram_subscribers`, `dm_delivery_log`: sadece Edge Function'lar (service_role) okur/yazar, hiçbir client erişimi yok.

### `is_luhive` neden `communities` üzerinde, `events` üzerinde değil
Register/Detaylar mantığı topluluğa bağlı bir kural, tek etkinliğe özel bir seçim değil — Luhive'in kendi topluluğunu diğer 24'ünden ayıran bir bayrak. Bunu `events`'e koymak her yeni etkinlikte tekrar karar vermeyi gerektirirdi.

---

## 5. Self-Serve Etkinlik Gönderimi

- Her topluluğa, hesap açılışında bir kere verilen **benzersiz form linki**: `luhive.com/community/submit?token={submission_token}`
- Form: başlık, açıklama, tarih/saat, konum, kapak görseli (upload), Luhive topluluğuysa ek olarak kayıt linki
- Gönderim → `status='pending'` ile insert. **Otomatik yayınlanmaz.**
- Luhive ekibi kısa bir onay adımından geçirir (`pending` → `published`). Bu adım diyagramda yoktu ama açık kapı bırakmamak için ekliyoruz: token sadece 25 vetted topluluğa verildiği için spam riski düşük, ama yanlış tarih/görsel gibi hatalar için tek bakışlık bir onay ucuz bir güvenlik.
- `status='published'` olduğu anda Database Webhook tetiklenir, kanala + tüm subscriber'lara gider.

---

## 6. Telegram Davranışı

### Kanal
- Bot, kanalın admin'i olarak post atar (`sendPhoto` + caption + inline keyboard).
- Kart: kapak görseli, başlık, tarih, konum, topluluk adı.

### Bot (DM)
- Kullanıcı `/start` ile bota bağlanır → `telegram_subscribers`'a insert.
- Yeni yayınlanan her etkinlik, bağlı her subscriber'a aynı kart formatıyla DM olarak gider.
- `dm_delivery_log`, aynı etkinliğin aynı kullanıcıya iki kez gitmesini önler (webhook retry güvenliği).

### Butonlar — kesinleşen mantık

| Buton | `communities.is_luhive = true` | `communities.is_luhive = false` |
|---|---|---|
| **Register** | `url` tipinde inline button, `events.registration_url`'e gider | **Gösterilmez** |
| **Detaylar** | callback_data → bot `description`'ı DM'e yazar | callback_data → bot `description`'ı DM'e yazar |

Partner topluluklarda Register butonu pasif değil, **hiç yok** — çünkü kayıt o topluluğun kendi sorumluluğunda, Luhive'in botunun bunu üstleniyormuş gibi göstermesi yanlış beklenti yaratır.

### UTM attribution — mevcut sisteme takılıyor, yeni bir şey inşa edilmiyor

Luhive'in zaten bir `event_visits` tablosu ve istatistik motoru var: bir etkinlik linkine `?utm_source=instagram` gibi bir parametreyle gelen ziyaretçi, community manager'a "bu ziyaretçi Instagram'dan geldi" olarak gösteriliyor. Bu **build'in kapsamı dışında**, zaten çalışıyor.

Bizim tek işimiz: Register butonunun `url`'ini oluştururken sona **`utm_source=luhive_bot`** eklemek, böylece bot'tan gelen kayıt trafiği de aynı istatistik motoruna otomatik düşer — mevcut kaynaklara (instagram vb.) **ek**, onların yerine geçmiyor.

```ts
// lib/telegram/build-register-url.ts
function buildRegisterUrl(registrationUrl: string): string {
  const url = new URL(registrationUrl);
  url.searchParams.set('utm_source', 'luhive_bot');
  return url.toString();
}
```

`URL`/`URLSearchParams` kullanılır, string concat ile `?` veya `&` elle eklenmez — `registration_url`'in zaten query string taşıyıp taşımadığı bilinmiyor, elle eklemek `??` veya çift `?` gibi bozuk URL üretme riski taşır.

**Not:** eğer `registration_url` zaten bir `utm_source` içeriyorsa (topluluk sahibi formda kendi UTM'iyle bir link vermişse), `searchParams.set` bunun üzerine yazar. Bu kasıtlı — bot'tan gelen trafiğin kaynağı gerçekte bot'tur, topluluğun forma girdiği eski UTM değil.

### Dil
Bot varsayılan **Azerbaycan dilinde**. Tüm sabit metinler (buton isimleri, sistem mesajları) `lib/i18n/az.json` üzerinden gelir, hardcode edilmez — İngilizce eklenmesi ileride sadece `en.json` eklemek olmalı, koda dokunmadan.

---

## 7. KPI ve Ölçüm

Diyagramdaki hedefler:
1. İlk ay: 500+ bota bağlı üye (Luhive network + kişisel network)
2. Birkaç ay sonra: ~2000 üye (network + reklam)
3. Nihai: matchmaking gerçekleşiyor — yani kullanıcılar kendi topluluğu dışındaki etkinliklere katılıyor

### Ölçülebilir metrikler

Telegram Bot API'de DM tarafında "okundu/görüldü" sinyali yok (bkz. yukarıdaki tartışma) — bu yüzden "open rate" bir metrik olarak **kullanılmıyor**. Onun yerine gerçekten elde edilebilen üç şey:

| Metrik | Kaynak | Ne anlatıyor |
|---|---|---|
| **Delivery rate** | `dm_delivery_log` / subscriber sayısı | Bot'un teslim edebildiği oran — kullanıcı botu bloklamışsa burada düşer |
| **Click-through rate** | `callback_query` sayısı (Detaylar) + Register `url` tıklaması / delivery sayısı | Gerçek ilgi sinyali — DM tarafında elimizdeki en güvenilir şey |
| **Kanal view count** | Telegram'ın kendi sağladığı `message.views` | Agregat ilgi, kişi bazlı değil, ama ek maliyetsiz bir sinyal |

**Register tıklaması** için `url` tipi buton olduğundan Telegram'dan callback dönmüyor (tarayıcıyı direkt açıyor) — bu yüzden gerçek tıklama sayısı **UTM üzerinden** (`event_visits` tablosundaki `utm_source=luhive_bot` kayıtları) ölçülüyor, Telegram tarafından değil. Yani Register CTR'ı hesaplamak için iki sistemi (delivery log + event_visits) birleştirmek gerekiyor.

**"Matchmaking gerçekleşti" iddiası** için tek başına CTR yeterli değil — bir kullanıcının **hangi topluluğa ait olduğu** ile **hangi topluluğun etkinliğine tıkladığı** eşleşmiyorsa "çapraz katılım" ölçülemez. Bu, §8'de açık madde olarak bırakılan tıklama-attribution tablosuna bağlı.

---

## 8. Açık Bırakılan Varsayımlar — Build'den Önce Onay Gerekiyor

Bu ikisi diyagramda hiç yoktu, ben ekledim, build'e geçmeden CTO onayı ister:

1. **Onay adımı (`pending` → `published`).** Diyagram "yeni etkinlik yayınlandı → direkt bota gider" akışını çiziyor, moderasyon adımı yok. Ben ekledim çünkü self-serve + otomatik yayın + görseli/tarihi kontrol edilmemiş içerik riski taşıyor. **Bu adım istenmiyorsa** (tam otomatik yayın isteniyorsa) §5 ve mimari diyagram değişir, otomatik publish'e döner.
2. **Tıklama bazlı attribution logu.** §7'de belirtilen boşluk — matchmaking KPI'ını gerçekten ölçmek istiyorsak, `event_click_log` gibi bir tablo (`subscriber_id`, `event_id`, `action`, `clicked_at`) eklenmeli. Şu an şemada yok çünkü diyagramda istenmemişti.

---

## 9. Stack

- **Next.js** (self-serve form sayfası — mevcut Luhive ana sitesinin bir route'u, ayrı repo değil)
- **Supabase** — mevcut proje, sadece yeni tablolar (§4)
- **Supabase Edge Functions** (Deno) — Telegram webhook handler
- **Telegram Bot API** — doğrudan `fetch` ile, `grammY` veya `node-telegram-bot-api` gibi bir kütüphane **Edge Function'da çalışmayabilir** (Node API'lerine bağımlı olabilir) — Deno uyumluluğu build başlamadan doğrulanır, gerekirse ham `fetch` ile Bot API çağrıları yazılır.
- **Zod** — form validasyonu

---

## 10. Definition of Done

- [ ] Self-serve formdan gönderilen etkinlik `pending` olarak Supabase'e düşüyor
- [ ] Onay verildiğinde (`published`) kanal + tüm subscriber'lar 60 saniye içinde kartı alıyor
- [ ] Luhive topluluğu etkinliğinde Register butonu doğru harici linke gidiyor
- [ ] O linkte `utm_source=luhive_bot` var, mevcut `event_visits` istatistiklerinde bot trafiği görünüyor, önceki UTM kaynaklarının (instagram vb.) üzerine yazmıyor onlarla birlikte çalışıyor
- [ ] Partner topluluk etkinliğinde Register butonu **hiç görünmüyor**, sadece Detaylar var
- [ ] Detaylar butonu açıklamayı doğru şekilde DM'e yazıyor (callback_query yanıtlanıyor, "loading" spinner'da asılı kalmıyor)
- [ ] Aynı etkinlik aynı kullanıcıya iki kez DM olarak gitmiyor (webhook retry testi yapıldı)
- [ ] `submission_token` olmadan veya yanlış token ile forma POST atılırsa insert reddediliyor
- [ ] Bot metinleri tamamen `az.json` üzerinden geliyor, kodda hardcode Azerice metin yok
- [ ] Kapak görseli olmayan bir etkinlik gönderildiğinde sistem çökmüyor, placeholder gösteriliyor

---

## 11. Yasaklar

1. Long polling kullanmak — her zaman webhook
2. `submission_token`'ı client-side doğrulamak — server-side (Edge Function, service_role) doğrulanır
3. Anon key ile `events`/`communities`'e doğrudan client'tan yazmak
4. Partner topluluk etkinliklerinde Register butonu göstermek (pasif bile olsa)
5. Bot metinlerini hardcode etmek, `i18n` dosyası dışında Azerice/İngilizce string yazmak
6. Yeni bir Supabase projesi açmak — mevcut projeye tablo eklenir
7. `pending` onayı olmadan otomatik yayın yapmak (§8 madde 1 onaylanmadan)

---

## 12. Claude Code / Cursor İçin Çalışma Şekli

- Sıra: önce §4 şeması + RLS, sonra self-serve form + token doğrulama, sonra Edge Function webhook handler (Telegram tarafı), en son i18n kablolaması.
- Edge Function'da `grammY`/`node-telegram-bot-api` denemeden önce Deno uyumluluğunu kontrol et — uyumsuzsa ham `fetch` ile devam et, saatler kaybetme.
- §8'deki iki madde onaylanmadan build'e başlama — onay adımı olup olmaması şemanın ve akışın şeklini değiştiriyor, sonradan geri almak maliyetli.
- Belirsizlik varsa sor, uydurma.
