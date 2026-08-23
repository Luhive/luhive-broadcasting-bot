import { config } from "./config";

export interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export function buildInlineKeyboard(rows: InlineButton[][]) {
  return { inline_keyboard: rows };
}

export async function callTelegramApi<T>(
  method: string,
  payload: Record<string, unknown>,
  tokenOverride?: string
): Promise<{ ok: boolean; result?: T; error_code?: number; description?: string; parameters?: { retry_after?: number } }> {
  const token = tokenOverride || config.telegramBotToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`Telegram API error [${method}]:`, data);
  }
  return data;
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: ReturnType<typeof buildInlineKeyboard>
) {
  return callTelegramApi<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export async function sendPhoto(
  chatId: number | string,
  photoUrl: string,
  caption: string,
  replyMarkup?: ReturnType<typeof buildInlineKeyboard>
) {
  return callTelegramApi<{ message_id: number }>("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false
) {
  return callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

export async function setWebhook(webhookUrl: string, secretToken: string) {
  return callTelegramApi("setWebhook", {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ["message", "chat_member", "my_chat_member", "callback_query"],
  });
}

export async function getWebhookInfo() {
  return callTelegramApi<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
    allowed_updates?: string[];
  }>("getWebhookInfo", {});
}
