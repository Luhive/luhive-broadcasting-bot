import { getSupabaseAdmin } from "../supabase-admin.ts";
import { sendMessage } from "../telegram.ts";
import { getDictionary } from "../i18n.ts";
import type { TelegramUpdate } from "../types.ts";

// Luhive hesabı gerektirmez — mevcut telegram_users tablosu profiles'a
// (gerçek hesap) bağlı olmayı zorunlu kılıyor, bot ise login'siz, herkesin
// /start ile anında abone olabildiği bir model kullanıyor. Bu yüzden ayrı
// bot_subscribers tablosuna yazılıyor (bkz. migration 0001_init.sql notu).
export async function handleStart(update: TelegramUpdate) {
  const message = update.message;
  if (!message) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username ?? null;
  const dict = getDictionary("az");

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("bot_subscribers")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("bot_subscribers")
      .update({ last_active_at: new Date().toISOString(), username })
      .eq("id", userId);
    await sendMessage(chatId, dict.bot.start.already_subscribed);
    return;
  }

  await supabase.from("bot_subscribers").insert({
    id: userId,
    username,
    language: "az",
  });

  await sendMessage(chatId, dict.bot.start.welcome);
}
