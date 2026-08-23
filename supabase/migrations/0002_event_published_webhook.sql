-- events tablosuna YENİ trigger'lar ekler (Supabase Database Webhooks
-- özelliğinin Studio UI'da yaptığıyla birebir aynı mekanizma). Mevcut
-- kolonlara/veriye dokunmaz, sadece status='published' olduğunda Edge
-- Function'ı tetikleyen "dinleyiciler" ekler. Bkz. SETUP.md §5,
-- LUHIVE_MATCHMAKING.md §3.
--
-- INSERT ve UPDATE ayrı trigger'lar olmak zorunda: Postgres, INSERT
-- trigger'ının WHEN koşulunda OLD'a referans vermeye izin vermiyor
-- (42P17), UPDATE'te ise OLD her zaman mevcut.
--
-- <DB_WEBHOOK_SECRET> placeholder'dır — gerçek değeri repoya COMMIT ETMEYİN.
-- Çalıştırmadan önce Studio SQL Editor'da gerçek secret ile değiştirin
-- (bkz. SETUP.md). Bu dosya zaten bir kez elle çalıştırıldı; burada sadece
-- referans/tekrarlanabilirlik için tutuluyor.

drop trigger if exists on_event_published_insert on public.events;
drop trigger if exists on_event_published_update on public.events;

create trigger on_event_published_insert
after insert on public.events
for each row
when (new.status = 'published')
execute function supabase_functions.http_request(
  'https://knfjdhrjvwgibfwqzbim.functions.supabase.co/telegram-webhook',
  'POST',
  '{"Content-type":"application/json","x-db-webhook-secret":"<DB_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);

create trigger on_event_published_update
after update on public.events
for each row
when (
  new.status = 'published'
  and old.status is distinct from 'published'
)
execute function supabase_functions.http_request(
  'https://knfjdhrjvwgibfwqzbim.functions.supabase.co/telegram-webhook',
  'POST',
  '{"Content-type":"application/json","x-db-webhook-secret":"<DB_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);
