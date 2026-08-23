import { getSupabaseAdmin } from "../supabase-admin.ts";
import { sendMessage, sendPhoto } from "../telegram.ts";
import { formatEventCaption, buildBroadcastKeyboard } from "../format-event.ts";
import type { Broadcast, Community, DatabaseWebhookPayload, TelegramSubscriber } from "../types.ts";

const DM_DELAY_MS = 45;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateBotToken(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return `t_${Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function handleEventPublished(payload: DatabaseWebhookPayload) {
  const event = payload.record;

  if (payload.table !== "events" || event.status !== "published") return;
  if (payload.old_record?.status === "published") return; // prevent duplicate

  const supabase = getSupabaseAdmin();

  const { data: community } = await supabase
    .from("communities")
    .select("id, slug, name, cover_url")
    .eq("id", event.community_id)
    .maybeSingle();

  if (!community) {
    console.error(`event ${event.id}: community ${event.community_id} not found`);
    return;
  }

  const typedCommunity = community as Community;
  const caption = formatEventCaption(event, typedCommunity);
  const coverUrl = event.cover_url || typedCommunity.cover_url;

  // 1. Channel Broadcast
  const channelId = Deno.env.get("TELEGRAM_CHANNEL_ID");
  if (channelId) {
    const { data: existingChannelBroadcast } = await supabase
      .from("broadcast")
      .select("id")
      .eq("event_id", event.id)
      .eq("surface", "channel")
      .maybeSingle();

    if (!existingChannelBroadcast) {
      const { data: createdBroadcast } = await supabase
        .from("broadcast")
        .insert({
          event_id: event.id,
          surface: "channel",
          sent_count: 1,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createdBroadcast) {
        const broadcast = createdBroadcast as Broadcast;
        const token = `c_${broadcast.id}`;
        const keyboard = buildBroadcastKeyboard(event, token);

        if (coverUrl) {
          await sendPhoto(channelId, coverUrl, caption, keyboard);
        } else {
          await sendMessage(channelId, caption, keyboard);
        }
      }
    }
  }

  // 2. Bot Broadcast
  let botBroadcastId: string;
  const { data: existingBotBroadcast } = await supabase
    .from("broadcast")
    .select("id")
    .eq("event_id", event.id)
    .eq("surface", "bot")
    .maybeSingle();

  if (existingBotBroadcast) {
    botBroadcastId = existingBotBroadcast.id;
  } else {
    const { data: createdBotBroadcast } = await supabase
      .from("broadcast")
      .insert({
        event_id: event.id,
        surface: "bot",
        sent_count: 0,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!createdBotBroadcast) return;
    botBroadcastId = (createdBotBroadcast as Broadcast).id;
  }

  // Find active bot subscribers
  const { data: subscribersData } = await supabase
    .from("telegram_subscriber")
    .select("*")
    .not("bot_started_at", "is", null)
    .eq("status", "active");

  const subscribers = (subscribersData ?? []) as TelegramSubscriber[];
  if (subscribers.length === 0) return;

  // Skip subscribers who already clicked for this event (D5)
  const { data: clickedSends } = await supabase
    .from("broadcast_send")
    .select("telegram_subscriber_id, broadcast!inner(event_id)")
    .eq("broadcast.event_id", event.id)
    .not("clicked_at", "is", null);

  const clickedIds = new Set(
    (clickedSends || []).map((row) => (row as unknown as { telegram_subscriber_id: string }).telegram_subscriber_id)
  );

  let sentCount = 0;

  for (const subscriber of subscribers) {
    if (clickedIds.has(subscriber.id)) continue;

    const token = generateBotToken();
    const keyboard = buildBroadcastKeyboard(event, token);

    await supabase.from("broadcast_send").insert({
      broadcast_id: botBroadcastId,
      telegram_subscriber_id: subscriber.id,
      token,
      delivered_at: new Date().toISOString(),
    });

    const result = coverUrl
      ? await sendPhoto(subscriber.telegram_user_id, coverUrl, caption, keyboard)
      : await sendMessage(subscriber.telegram_user_id, caption, keyboard);

    if (!result) {
      // 403 or error
      await supabase
        .from("telegram_subscriber")
        .update({ status: "blocked", updated_at: new Date().toISOString() })
        .eq("id", subscriber.id);
    } else {
      sentCount++;
    }

    await sleep(DM_DELAY_MS);
  }

  await supabase
    .from("broadcast")
    .update({ sent_count: sentCount })
    .eq("id", botBroadcastId);
}
