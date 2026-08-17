# Kurulum — Supabase tarafı

## Önemli: bu proje boş değil

Verilen Supabase projesi (`knfjdhrjvwgibfwqzbim`) Luhive'in **gerçek
production veritabanı**. Salt-okunur incelendi: `communities`, `events`,
`telegram_users`, `telegram_event_deliveries`, `telegram_event_broadcasts`,
`telegram_event_interactions`, `event_visits` gibi tablolar **zaten var** ve
gerçek veri içeriyor.

Bu yüzden plan değişti (ilk halinden farklı olarak):

- **Self-serve etkinlik gönderim formu yapılmadı.** Ürün zaten
  `events.created_by` / `is_approve_required` / `community_members.role`
  üzerinden bir etkinlik oluşturma akışına sahip görünüyor — draft→published
  geçişi muhtemelen mevcut admin panelinden yönetiliyor.
- **`communities`/`events` tablolarına hiç dokunulmadı** — ne ALTER ne DROP.
  Migration sadece 3 yeni tablo **ekliyor**.
- **Register butonu mantığı** `communities.is_luhive` yerine
  `events.registration_type` (`native`/`external`/`both`) +
  `events.external_registration_url` kullanıyor.
- **Abonelik login gerektirmiyor.** Mevcut `telegram_users` tablosu
  `profiles`'a (gerçek Luhive hesabı) bağlı olmayı zorunlu kılıyor
  (`user_id` NOT NULL). Bot ise herkesin `/start` ile anında, hesapsız abone
  olabildiği bir model kullanıyor — bu yüzden ayrı `bot_subscribers` +
  `bot_event_deliveries` + `bot_event_interactions` tabloları eklendi.
  Mevcut `telegram_event_broadcasts` (subscriber'a bağlı değil) olduğu gibi
  kullanılıyor.

## 1. Migration'ı uygula

`supabase/migrations/0001_init.sql` sadece şu 3 tabloyu ekliyor:
`bot_subscribers`, `bot_event_deliveries`, `bot_event_interactions`. Mevcut
hiçbir tabloya dokunmuyor.

```
supabase link --project-ref knfjdhrjvwgibfwqzbim
supabase db push
```

veya Studio → SQL Editor içine yapıştırıp çalıştırın.

## 2. Telegram bot

1. @BotFather ile bot oluşturun, token'ı alın.
2. Botu, **merkezi Luhive kanalına** admin olarak ekleyin (tüm topluluklardan
   gelen etkinlikler tek bu kanala düşüyor — bkz. §3 mimari, communities'te
   per-topluluk bir kanal kolonu yok).
3. Kanalın chat id'sini alın (`@channel_username` ya da `-100...` id).
4. Rastgele iki secret üretin (ör. `openssl rand -hex 32`):
   - `TELEGRAM_WEBHOOK_SECRET`
   - `DB_WEBHOOK_SECRET`

## 3. Edge Function deploy

```
supabase functions deploy telegram-webhook --no-verify-jwt
```

`--no-verify-jwt` gerekli — Telegram, Supabase'in beklediği JWT'yi
göndermeyecek; `index.ts` kendi secret doğrulamasını header üzerinden yapıyor.

Secrets:

```
supabase secrets set TELEGRAM_BOT_TOKEN=<botfather token>
supabase secrets set TELEGRAM_CHANNEL_ID=<kanal chat id>
supabase secrets set TELEGRAM_WEBHOOK_SECRET=<adım 2'deki secret>
supabase secrets set DB_WEBHOOK_SECRET=<adım 2'deki secret>
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` **ayrıca set edilmez** —
Supabase bunları her Edge Function'a otomatik enjekte eder.

## 4. Telegram webhook'unu kaydet

```
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://knfjdhrjvwgibfwqzbim.functions.supabase.co/telegram-webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

## 5. Database Webhook (events → Edge Function)

Studio → Database → Webhooks → "Create a new hook". Bu, `events` tablosuna
**yeni bir trigger ekler** — mevcut kolonlara/veriye dokunmaz, sadece
dinlemeye başlar.

- Table: `events`
- Events: `Update` (ve isterseniz `Insert`)
- Condition: `status` sütunu `published` olduğunda — Studio UI'da WHERE
  koşulu olarak `new.status = 'published'`
- Type: HTTP Request → POST
- URL: `https://knfjdhrjvwgibfwqzbim.functions.supabase.co/telegram-webhook`
- Headers: `x-db-webhook-secret: <DB_WEBHOOK_SECRET>`, `Content-Type: application/json`

## 6. Deno uyumluluğu — doğrulama

Yerelde kurulu Deno 2.9.5 ile doğrulandı (fonksiyonun kendi klasöründen
çalıştırılmalı, `deno.json` import map'i CWD'ye göre bulunuyor):

```
cd supabase/functions/telegram-webhook
deno check index.ts
deno lint .
```

İkisi de hatasız geçti.

## 7. Uçtan uca test

1. Bota `/start` gönderin → `bot_subscribers`'a satır düşmeli (login
   gerekmiyor).
2. Mevcut admin panelinden bir etkinliği `published` yapın → 60 saniye
   içinde merkezi kanala ve tüm `bot_subscribers`'a kart gitmeli.
3. `registration_type='native'` bir etkinlikte Register butonu
   `luhive.com/c/{community_slug}/{event_slug}?utm_source=luhive_bot`'a
   gitmeli; `registration_type='external'` bir etkinlikte
   `external_registration_url`'e (yine `utm_source=luhive_bot` ile).
4. "Ətraflı" butonuna basın → açıklama gelmeli, spinner asılı kalmamalı,
   `bot_event_interactions`'a satır düşmeli.
5. Aynı etkinliği tekrar `published` yapmayı deneyin → `old_record.status`
   zaten `published` olduğu için tekrar broadcast **olmamalı**.

## Dokunulmayanlar (bilerek)

- `communities`, `events`, `telegram_users`, `profiles`, `event_visits` —
  hiç ALTER/DROP yok.
- Self-serve form — bu fazda yapılmadı, mevcut ürün akışına bırakıldı.
- Storage bucket — gerekmedi, kapak görselleri zaten `events.cover_url` /
  `communities.cover_url` üzerinden geliyor.
