import { getSupabase } from "../supabase";
import { sendMessage } from "../telegram";
import type { TelegramChatMemberUpdated, TelegramMessage, TelegramSubscriber } from "../types";

export async function handleStartMessage(message: TelegramMessage) {
  const user = message.from;
  if (!user || user.is_bot) return;

  const text = message.text || "";
  // Extract start code if present: "/start" or "/start <code>"
  const match = text.trim().match(/^\/start(?:\s+(.+))?$/);
  if (!match) return;

  const sourceCode = match[1]?.trim() || null;
  const supabase = getSupabase();

  const now = new Date().toISOString();

  // 1. Check existing subscriber
  const { data: existing } = await supabase
    .from("telegram_subscriber")
    .select("*")
    .eq("telegram_user_id", user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("telegram_subscriber").insert({
      telegram_user_id: user.id,
      username: user.username || null,
      bot_started_at: now,
      bot_source_code: sourceCode,
      status: "active",
      created_at: now,
      updated_at: now,
    });
  } else {
    const subscriber = existing as TelegramSubscriber;
    await supabase
      .from("telegram_subscriber")
      .update({
        username: user.username || subscriber.username,
        bot_started_at: subscriber.bot_started_at || now,
        // First-touch attribution: do not overwrite existing bot_source_code
        bot_source_code: subscriber.bot_source_code || sourceCode,
        status: "active",
        updated_at: now,
      })
      .eq("id", subscriber.id);
  }

  // Send a short welcome reply
  await sendMessage(
    message.chat.id,
    "Xoş gəldin! Luhive-ə bağlı olan bütün topluluqların yeni tədbirlərini artıq burada görəcəksən."
  );
}

export async function handleChatMemberUpdate(update: TelegramChatMemberUpdated) {
  const user = update.new_chat_member?.user || update.old_chat_member?.user;
  if (!user || user.is_bot) return;

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const newStatus = update.new_chat_member.status;
  const oldStatus = update.old_chat_member.status;

  const isJoin =
    ["member", "administrator", "creator"].includes(newStatus) &&
    ["left", "kicked", "restricted"].includes(oldStatus);

  const isLeave = ["left", "kicked"].includes(newStatus);

  const { data: existing } = await supabase
    .from("telegram_subscriber")
    .select("*")
    .eq("telegram_user_id", user.id)
    .maybeSingle();

  if (isJoin) {
    const inviteLinkName = update.invite_link?.name || null;

    if (!existing) {
      await supabase.from("telegram_subscriber").insert({
        telegram_user_id: user.id,
        username: user.username || null,
        channel_joined_at: now,
        channel_source_code: inviteLinkName,
        channel_left_at: null,
        status: "active",
        created_at: now,
        updated_at: now,
      });
    } else {
      const subscriber = existing as TelegramSubscriber;
      await supabase
        .from("telegram_subscriber")
        .update({
          username: user.username || subscriber.username,
          channel_joined_at: now,
          channel_left_at: null,
          // First-touch attribution: do not overwrite existing channel_source_code
          channel_source_code: subscriber.channel_source_code || inviteLinkName,
          updated_at: now,
        })
        .eq("id", subscriber.id);
    }
  } else if (isLeave) {
    if (existing) {
      await supabase
        .from("telegram_subscriber")
        .update({
          channel_left_at: now,
          updated_at: now,
        })
        .eq("id", existing.id);
    } else {
      // Create record even if they left without prior record
      await supabase.from("telegram_subscriber").insert({
        telegram_user_id: user.id,
        username: user.username || null,
        channel_left_at: now,
        status: "active",
        created_at: now,
        updated_at: now,
      });
    }
  }
}

export async function handleMyChatMemberUpdate(update: TelegramChatMemberUpdated) {
  const user = update.from || update.new_chat_member?.user;
  if (!user || user.is_bot) return;

  const supabase = getSupabase();
  const now = new Date().toISOString();
  const newStatus = update.new_chat_member.status;

  if (newStatus === "kicked") {
    // Bot was blocked by user
    await supabase
      .from("telegram_subscriber")
      .update({
        status: "blocked",
        updated_at: now,
      })
      .eq("telegram_user_id", user.id);
  } else if (["member", "administrator"].includes(newStatus)) {
    // Bot unblocked / re-added
    await supabase
      .from("telegram_subscriber")
      .update({
        status: "active",
        updated_at: now,
      })
      .eq("telegram_user_id", user.id);
  }
}
