import { getSupabaseAdmin } from "../supabase-admin.ts";
import { answerCallbackQuery, sendMessage } from "../telegram.ts";
import { getDictionary } from "../i18n.ts";
import type { TelegramUpdate } from "../types.ts";

const CALLBACK_ANSWER_MAX_LENGTH = 200; // Telegram'ın callback answer text limiti

export async function handleCallbackQuery(update: TelegramUpdate) {
  const callback = update.callback_query;
  if (!callback) return;

  const dict = getDictionary("az");

  // callback_query her zaman yanıtlanmalı, yoksa Telegram istemcisinde
  // "loading" spinner'ı asılı kalır (bkz. DoD).
  if (!callback.data) {
    await answerCallbackQuery(callback.id);
    return;
  }

  const [action, eventId] = callback.data.split(":");

  if (action !== "details" || !eventId) {
    await answerCallbackQuery(callback.id);
    return;
  }

  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("id, description")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    await answerCallbackQuery(callback.id, dict.bot.callback.event_not_found);
    return;
  }

  // Kanal post'undaki bir butona tıklanmışsa (chat type "private" değil),
  // bot kullanıcıya DM atamaz — hiç konuşma başlatılmamış olabilir.
  // Bu durumda açıklama, callback_query yanıtının kendisinde (alert popup)
  // gösterilir. DM'de (bottaki kart) ise normal mesaj olarak yazılır.
  const isPrivateChat = callback.message?.chat.type === "private";

  if (isPrivateChat) {
    await sendMessage(callback.message!.chat.id, event.description);
    await answerCallbackQuery(callback.id, dict.bot.callback.details_sent);
  } else {
    await answerCallbackQuery(callback.id, event.description.slice(0, CALLBACK_ANSWER_MAX_LENGTH), true);
  }

  // bot_event_interactions — subscriber_id, FK ile bot_subscribers'a bağlı;
  // kullanıcı hiç /start çekmemişse (yalnızca kanaldan tıklamışsa) bu insert
  // başarısız olabilir — interaction log analitik amaçlı olduğundan bu,
  // kullanıcıya verilen yanıtı engellemez.
  const { error: interactionLogError } = await supabase.from("bot_event_interactions").insert({
    event_id: event.id,
    subscriber_id: callback.from.id,
    action: "details",
  });
  if (interactionLogError) {
    console.error("bot_event_interactions insert failed", interactionLogError);
  }
}
