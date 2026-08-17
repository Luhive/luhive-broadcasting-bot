// Bkz. LUHIVE_MATCHMAKING.md §9 — Telegram Bot API'ye ham `fetch` ile
// erişiliyor. grammY/node-telegram-bot-api gibi kütüphaneler Edge
// Function'ın (Deno) runtime'ında Node API'lerine bağımlı olabilir; bu
// riski almamak için doğrudan HTTP çağrısı kullanılıyor.

const TELEGRAM_API_BASE = "https://api.telegram.org";

function getBotToken(): string {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN secret olarak set edilmemiş.");
  return token;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

async function callTelegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  const token = getBotToken();
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as TelegramApiResponse<T>;

  if (!json.ok) {
    // Kullanıcı botu bloklamış olabilir (403) — bu bir sistem hatası değil,
    // delivery rate metriğine düşen normal bir durum. Fırlatmak yerine
    // logluyoruz, tüm broadcast'i durdurmuyoruz.
    console.error(`Telegram API ${method} failed: ${json.error_code} ${json.description}`);
    return null;
  }

  return json.result ?? null;
}

export interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export function buildInlineKeyboard(rows: InlineButton[][]) {
  return { inline_keyboard: rows };
}

export function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: ReturnType<typeof buildInlineKeyboard>,
) {
  return callTelegramApi<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export function sendPhoto(
  chatId: number | string,
  photoUrl: string,
  caption: string,
  replyMarkup?: ReturnType<typeof buildInlineKeyboard>,
) {
  return callTelegramApi<{ message_id: number }>("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
}

export function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
  return callTelegramApi<boolean>("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}
