import crypto from "crypto";
import { getSupabase } from "../supabase";
import { sendMessage, sendPhoto } from "../telegram";
import { formatEventCaption, buildBroadcastKeyboard } from "./format";
import { config } from "../config";
import type { Broadcast, Community, EventRow, TelegramSubscriber } from "../types";

const DM_DELAY_MS = 45; // ~22 messages per second, safely below 25-30 msg/sec limit

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateBotToken(): string {
  return `t_${crypto.randomBytes(8).toString("hex")}`;
}

export async function broadcastEvent(
  eventId: string,
  options: { surface?: "channel" | "bot" | "all"; channelIdOverride?: string } = {}
) {
  const surface = options.surface || "all";
  const supabase = getSupabase();

  // 1. Fetch Event and Community
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError || !eventData) {
    console.error(`Broadcast error: event ${eventId} not found`, eventError);
    return { success: false, error: "Event not found" };
  }

  const event = eventData as EventRow;

  const { data: communityData, error: communityError } = await supabase
    .from("communities")
    .select("id, slug, name, cover_url")
    .eq("id", event.community_id)
    .single();

  if (communityError || !communityData) {
    console.error(`Broadcast error: community ${event.community_id} not found`, communityError);
    return { success: false, error: "Community not found" };
  }

  const community = communityData as Community;
  const caption = formatEventCaption(event, community);
  const coverUrl = event.cover_url || community.cover_url;

  // 2. Channel Broadcast
  if (surface === "channel" || surface === "all") {
    await broadcastToChannel(event, community, caption, coverUrl, options.channelIdOverride);
  }

  // 3. Bot Broadcast
  if (surface === "bot" || surface === "all") {
    await broadcastToBotSubscribers(event, community, caption, coverUrl);
  }

  return { success: true };
}

async function broadcastToChannel(
  event: EventRow,
  community: Community,
  caption: string,
  coverUrl: string | null,
  channelIdOverride?: string
) {
  const supabase = getSupabase();
  const channelId = channelIdOverride || config.telegramChannelId;

  if (!channelId) {
    console.warn("TELEGRAM_CHANNEL_ID is not configured, skipping channel broadcast");
    return;
  }

  // Check idempotency (D6: Run broadcast twice for the same event and surface does not double-send)
  const { data: existingBroadcast } = await supabase
    .from("broadcast")
    .select("*")
    .eq("event_id", event.id)
    .eq("surface", "channel")
    .maybeSingle();

  if (existingBroadcast) {
    console.log(`Channel broadcast already exists for event ${event.id}, skipping.`);
    return;
  }

  // Insert broadcast row
  const { data: newBroadcast, error: broadcastError } = await supabase
    .from("broadcast")
    .insert({
      event_id: event.id,
      surface: "channel",
      sent_count: 1,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (broadcastError || !newBroadcast) {
    console.error("Failed to create channel broadcast row:", broadcastError);
    return;
  }

  const broadcast = newBroadcast as Broadcast;
  const token = `c_${broadcast.id}`;
  const keyboard = buildBroadcastKeyboard(event.slug, token, event.id);

  try {
    if (coverUrl) {
      await sendPhoto(channelId, coverUrl, caption, keyboard);
    } else {
      await sendMessage(channelId, caption, keyboard);
    }
    console.log(`Channel broadcast sent successfully for event ${event.id} to ${channelId}`);
  } catch (error) {
    console.error(`Error sending channel broadcast to ${channelId}:`, error);
  }
}

async function broadcastToBotSubscribers(
  event: EventRow,
  community: Community,
  caption: string,
  coverUrl: string | null
) {
  const supabase = getSupabase();

  // Create or get bot broadcast record
  let broadcastId: string;
  const { data: existingBroadcast } = await supabase
    .from("broadcast")
    .select("*")
    .eq("event_id", event.id)
    .eq("surface", "bot")
    .maybeSingle();

  if (existingBroadcast) {
    broadcastId = existingBroadcast.id;
  } else {
    const { data: createdBroadcast, error: createError } = await supabase
      .from("broadcast")
      .insert({
        event_id: event.id,
        surface: "bot",
        sent_count: 0,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !createdBroadcast) {
      console.error("Failed to create bot broadcast row:", createError);
      return;
    }
    broadcastId = createdBroadcast.id;
  }

  // Fetch active bot subscribers
  const { data: subscribersData, error: subError } = await supabase
    .from("telegram_subscriber")
    .select("*")
    .not("bot_started_at", "is", null)
    .eq("status", "active");

  if (subError || !subscribersData) {
    console.error("Failed to fetch bot subscribers:", subError);
    return;
  }

  const subscribers = subscribersData as TelegramSubscriber[];
  if (subscribers.length === 0) {
    console.log("No eligible bot subscribers found (sent_count = 0).");
    return;
  }

  // Find subscribers who already clicked a link for this event (D5 requirement)
  const { data: clickedSends } = await supabase
    .from("broadcast_send")
    .select("telegram_subscriber_id, broadcast!inner(event_id)")
    .eq("broadcast.event_id", event.id)
    .not("clicked_at", "is", null);

  const clickedSubscriberIds = new Set(
    (clickedSends || []).map((row) => (row as unknown as { telegram_subscriber_id: string }).telegram_subscriber_id)
  );

  let sentCount = 0;

  for (const subscriber of subscribers) {
    // Skip if user already clicked on a previous broadcast for this event
    if (clickedSubscriberIds.has(subscriber.id)) {
      continue;
    }

    const token = generateBotToken();
    const keyboard = buildBroadcastKeyboard(event.slug, token, event.id);

    // Insert broadcast_send record
    const { error: sendInsertError } = await supabase.from("broadcast_send").insert({
      broadcast_id: broadcastId,
      telegram_subscriber_id: subscriber.id,
      token,
      delivered_at: new Date().toISOString(),
    });

    if (sendInsertError) {
      console.error(`Failed to insert broadcast_send for subscriber ${subscriber.id}:`, sendInsertError);
      continue;
    }

    try {
      const result = coverUrl
        ? await sendPhoto(subscriber.telegram_user_id, coverUrl, caption, keyboard)
        : await sendMessage(subscriber.telegram_user_id, caption, keyboard);

      if (!result.ok) {
        if (result.error_code === 403) {
          // User blocked the bot (E2 requirement)
          await supabase
            .from("telegram_subscriber")
            .update({ status: "blocked", updated_at: new Date().toISOString() })
            .eq("id", subscriber.id);

          await supabase
            .from("broadcast_send")
            .update({ error: "blocked" })
            .eq("token", token);
        } else if (result.error_code === 429 && result.parameters?.retry_after) {
          // Rate limit backoff
          const waitSec = result.parameters.retry_after;
          await sleep(waitSec * 1000);
          // Retry once
          if (coverUrl) {
            await sendPhoto(subscriber.telegram_user_id, coverUrl, caption, keyboard);
          } else {
            await sendMessage(subscriber.telegram_user_id, caption, keyboard);
          }
          sentCount++;
        } else {
          await supabase
            .from("broadcast_send")
            .update({ error: result.description || "unknown_error" })
            .eq("token", token);
        }
      } else {
        sentCount++;
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("broadcast_send")
        .update({ error: errorMsg })
        .eq("token", token);
    }

    await sleep(DM_DELAY_MS);
  }

  // Update sent_count
  await supabase
    .from("broadcast")
    .update({ sent_count: sentCount })
    .eq("id", broadcastId);

  console.log(`Bot broadcast finished for event ${event.id}. Sent: ${sentCount}`);
}
