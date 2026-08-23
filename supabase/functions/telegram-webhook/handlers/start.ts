import { getSupabaseAdmin } from "../supabase-admin.ts";
import { sendMessage } from "../telegram.ts";
import { getDictionary } from "../i18n.ts";
import type { TelegramSubscriber, TelegramUpdate } from "../types.ts";

export async function handleStart(update: TelegramUpdate) {
  const message = update.message;
  if (!message || !message.from) return;

  const chatId = message.chat.id;
  const user = message.from;
  const username = user.username ?? null;
  const text = message.text || "";
  const dict = getDictionary("az");

  // Extract start code if present: "/start" or "/start <code>"
  const match = text.trim().match(/^\/start(?:\s+(.+))?$/);
  const sourceCode = match?.[1]?.trim() || null;

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("telegram_subscriber")
    .select("*")
    .eq("telegram_user_id", user.id)
    .maybeSingle();

  if (existing) {
    const subscriber = existing as TelegramSubscriber;
    await supabase
      .from("telegram_subscriber")
      .update({
        username: username || subscriber.username,
        bot_started_at: subscriber.bot_started_at || now,
        // First-touch attribution: do not overwrite existing bot_source_code
        bot_source_code: subscriber.bot_source_code || sourceCode,
        status: "active",
        updated_at: now,
      })
      .eq("id", subscriber.id);
  } else {
    await supabase.from("telegram_subscriber").insert({
      telegram_user_id: user.id,
      username,
      bot_started_at: now,
      bot_source_code: sourceCode,
      status: "active",
      created_at: now,
      updated_at: now,
    });
  }

  await sendMessage(chatId, dict.bot.start.welcome);
}
