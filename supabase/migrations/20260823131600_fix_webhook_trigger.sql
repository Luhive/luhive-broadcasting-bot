-- Fix Database Webhook Trigger to point to active Edge Function with correct secret and URL

drop trigger if exists on_event_published_insert on public.events;
drop trigger if exists on_event_published_update on public.events;

create trigger on_event_published_insert
after insert on public.events
for each row
when (new.status = 'published')
execute function supabase_functions.http_request(
  'https://knfjdhrjvwgibfwqzbim.supabase.co/functions/v1/telegram-webhook',
  'POST',
  '{"Content-type":"application/json","x-db-webhook-secret":"luhive_db_secret_2026_test"}',
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
  'https://knfjdhrjvwgibfwqzbim.supabase.co/functions/v1/telegram-webhook',
  'POST',
  '{"Content-type":"application/json","x-db-webhook-secret":"luhive_db_secret_2026_test"}',
  '{}',
  '5000'
);
