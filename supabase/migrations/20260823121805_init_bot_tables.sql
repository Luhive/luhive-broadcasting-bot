-- Telegram Bot Spec v1 Tabloları
-- telegram_subscriber, broadcast, broadcast_send

create table if not exists telegram_subscriber (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  username text,
  bot_started_at timestamptz,
  bot_source_code text,
  channel_joined_at timestamptz,
  channel_source_code text,
  channel_left_at timestamptz,
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists telegram_subscriber_user_id_idx on telegram_subscriber (telegram_user_id);
create index if not exists telegram_subscriber_status_idx on telegram_subscriber (status);

create table if not exists broadcast (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  surface text not null check (surface in ('channel', 'bot')),
  sent_at timestamptz not null default now(),
  sent_count integer not null default 0,
  constraint broadcast_event_surface_unique unique (event_id, surface)
);

create index if not exists broadcast_event_id_idx on broadcast (event_id);

create table if not exists broadcast_send (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references broadcast(id) on delete cascade,
  telegram_subscriber_id uuid not null references telegram_subscriber(id) on delete cascade,
  token text not null unique,
  delivered_at timestamptz not null default now(),
  clicked_at timestamptz,
  error text
);

create index if not exists broadcast_send_token_idx on broadcast_send (token);
create index if not exists broadcast_send_broadcast_id_idx on broadcast_send (broadcast_id);
create index if not exists broadcast_send_subscriber_id_idx on broadcast_send (telegram_subscriber_id);

-- RLS
alter table telegram_subscriber enable row level security;
alter table broadcast enable row level security;
alter table broadcast_send enable row level security;
