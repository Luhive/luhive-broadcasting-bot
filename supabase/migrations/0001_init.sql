-- Luhive Community Matchmaking — Telegram bot tabloları.
--
-- ÖNEMLİ: Bu proje boş değil, Luhive'in gerçek production veritabanı.
-- `communities`, `events`, `telegram_users`, `telegram_event_deliveries`,
-- `telegram_event_broadcasts`, `telegram_event_interactions`, `event_visits`
-- gibi tablolar ZATEN VAR — bu migration onlara HİÇBİR ŞEKİLDE dokunmuyor
-- (ALTER yok, DROP yok). Sadece botun anonim (hesapsız) abonelik modeli için
-- gereken 3 yeni tablo ekliyor.
--
-- Neden mevcut telegram_event_deliveries/telegram_event_interactions
-- kullanılmadı: o tablolar telegram_users(id) üzerinden profiles'a (gerçek
-- Luhive hesabı) bağlı olmayı zorunlu kılıyor (telegram_users.user_id NOT
-- NULL). Bot'un ise login gerektirmeyen, herkesin /start ile anında abone
-- olabildiği bir model olması gerekiyor — bu yüzden ayrı, kendi kendine
-- yeten bir abone tablosu (bot_subscribers) ve ona bağlı delivery/interaction
-- logları eklendi. `telegram_event_broadcasts` ise subscriber'a bağlı
-- olmadığı için (sadece event_id + channel_message_id) olduğu gibi
-- kullanılıyor, ona da dokunulmadı.
--
-- Bu dosya sadece koddur, gerçek projeye otomatik uygulanmadı — bkz. SETUP.md.

create table bot_subscribers (
  id bigint primary key,                        -- Telegram user_id, kendisi zaten benzersiz
  username text,
  language text not null default 'az' check (language in ('az', 'en')),
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table bot_event_deliveries (
  event_id uuid not null references events(id) on delete cascade,
  subscriber_id bigint not null references bot_subscribers(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (event_id, subscriber_id)
);

create index bot_event_deliveries_subscriber_id_idx on bot_event_deliveries (subscriber_id);

create table bot_event_interactions (
  id bigint generated always as identity primary key,
  event_id uuid not null references events(id) on delete cascade,
  subscriber_id bigint not null references bot_subscribers(id) on delete cascade,
  action text not null check (action in ('details')),
  interacted_at timestamptz not null default now()
);

create index bot_event_interactions_event_id_idx on bot_event_interactions (event_id);
create index bot_event_interactions_subscriber_id_idx on bot_event_interactions (subscriber_id);

-- RLS — hiçbir client-side anon/authenticated erişimi yok. Policy
-- tanımlanmıyor: RLS açıkken policy yoksa herkes reddedilir. Yalnızca
-- service_role (RLS'yi bypass eder), Edge Function içinden okuyup yazabilir.
alter table bot_subscribers enable row level security;
alter table bot_event_deliveries enable row level security;
alter table bot_event_interactions enable row level security;
