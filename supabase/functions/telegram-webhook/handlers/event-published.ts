import { getSupabaseAdmin } from "../supabase-admin.ts";
import { sendMessage, sendPhoto } from "../telegram.ts";
import { formatEventCaption, buildEventKeyboard } from "../format-event.ts";
import type { BotSubscriber, Community, DatabaseWebhookPayload } from "../types.ts";

// Telegram'ın aynı chat'e ~1 msg/sn, genel ~30 msg/sn sınırına karşı basit
// bir gecikme. 500-2000 abone hedefi (bkz. §7 KPI) için yeterli; çok daha
// büyük ölçekte bu döngü yerine bir kuyruk (queue) gerekir.
const DM_DELAY_MS = 40;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function handleEventPublished(payload: DatabaseWebhookPayload) {
  const event = payload.record;

  if (payload.table !== "events" || event.status !== "published") return;

  // draft → published dışındaki update'leri (ör. already-published bir
  // satırın başka bir alanının değişmesi) yok say — duplicate broadcast'i
  // engeller. (events.status: draft/published/cancelled — bkz. types.ts)
  if (payload.old_record?.status === "published") return;

  const supabase = getSupabaseAdmin();

  const { data: community } = await supabase
    .from("communities")
    .select("id, slug, name, cover_url")
    .eq("id", event.community_id)
    .maybeSingle();

  if (!community) {
    console.error(`event ${event.id}: community ${event.community_id} bulunamadı`);
    return;
  }

  const typedCommunity = community as Community;
  const caption = formatEventCaption(event, typedCommunity);
  const keyboard = buildEventKeyboard(event, typedCommunity);
  const coverUrl = event.cover_url || typedCommunity.cover_url;

  // Kanal — tüm topluluklar tek bir merkezi Luhive kanalına düşüyor (bkz.
  // §3 mimari); communities'te per-community bir kanal kolonu yok.
  const channelId = Deno.env.get("TELEGRAM_CHANNEL_ID");

  if (channelId) {
    // telegram_event_broadcasts zaten var (subscriber'a bağlı değil, sadece
    // event_id + channel_message_id) — idempotency için önce kontrol
    // ediliyor, webhook retry'ında kanala ikinci kez post atılmasın diye.
    const { data: existingBroadcast } = await supabase
      .from("telegram_event_broadcasts")
      .select("id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (!existingBroadcast) {
      const result = coverUrl
        ? await sendPhoto(channelId, coverUrl, caption, keyboard)
        : await sendMessage(channelId, caption, keyboard);

      await supabase.from("telegram_event_broadcasts").insert({
        event_id: event.id,
        channel_message_id: result?.message_id ?? null,
      });
    }
  }

  // DM — bot_event_deliveries ile idempotent (webhook retry güvenliği, §6).
  const [{ data: subscribers }, { data: alreadyDelivered }] = await Promise.all([
    supabase.from("bot_subscribers").select("id, username, language"),
    supabase.from("bot_event_deliveries").select("subscriber_id").eq("event_id", event.id),
  ]);

  const deliveredIds = new Set((alreadyDelivered ?? []).map((row) => row.subscriber_id));

  for (const subscriber of (subscribers ?? []) as BotSubscriber[]) {
    if (deliveredIds.has(subscriber.id)) continue;

    const result = coverUrl
      ? await sendPhoto(subscriber.id, coverUrl, caption, keyboard)
      : await sendMessage(subscriber.id, caption, keyboard);

    // result === null => Telegram API hata verdi (ör. kullanıcı botu
    // bloklamış, 403). bot_event_deliveries'e yazılmıyor — delivery rate
    // metriğine düşer (bkz. §7), broadcast diğer abonelerle devam eder.
    if (result) {
      await supabase.from("bot_event_deliveries").insert({
        event_id: event.id,
        subscriber_id: subscriber.id,
      });
    }

    await sleep(DM_DELAY_MS);
  }
}
