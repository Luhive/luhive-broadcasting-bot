import { getSupabase } from "../supabase";
import { answerCallbackQuery, sendMessage } from "../telegram";
import type { TelegramCallbackQuery } from "../types";

export async function handleCallbackQuery(callback: TelegramCallbackQuery) {
  if (!callback.data) {
    await answerCallbackQuery(callback.id);
    return;
  }

  const [action, eventId] = callback.data.split(":");
  if (action !== "details" || !eventId) {
    await answerCallbackQuery(callback.id);
    return;
  }

  const supabase = getSupabase();
  const { data: event } = await supabase
    .from("events")
    .select("id, description")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) {
    await answerCallbackQuery(callback.id, "Bu tədbir artıq mövcud deyil.");
    return;
  }

  const isPrivateChat = callback.message?.chat.type === "private";

  if (isPrivateChat && callback.message) {
    await sendMessage(callback.message.chat.id, event.description || "Ətraflı məlumat yoxdur.");
    await answerCallbackQuery(callback.id, "Ətraflı məlumat göndərildi.");
  } else {
    const text = (event.description || "Ətraflı məlumat yoxdur.").slice(0, 200);
    await answerCallbackQuery(callback.id, text, true);
  }
}
