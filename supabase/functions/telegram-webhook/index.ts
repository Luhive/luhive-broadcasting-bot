// Tek Edge Function, iki farklı tetikleyiciye hizmet ediyor (bkz. §3 mimari):
//  1. Telegram Bot API webhook (Telegram sunucuları çağırır: message/callback_query)
//  2. Supabase Database Webhook (events.status='published' olduğunda tetiklenir)
//
// Bu fonksiyon `--no-verify-jwt` ile deploy edilmeli (Telegram, Supabase'in
// beklediği JWT'yi göndermez) — bunun yerine her iki yol da kendi paylaşılan
// secret'ını header üzerinden doğruluyor. Detaylar için SETUP.md.
import { handleStart } from "./handlers/start.ts";
import { handleCallbackQuery } from "./handlers/callback.ts";
import { handleEventPublished } from "./handlers/event-published.ts";
import type { DatabaseWebhookPayload, TelegramUpdate } from "./types.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (isDatabaseWebhookPayload(body)) {
    const expectedSecret = Deno.env.get("DB_WEBHOOK_SECRET");
    if (expectedSecret && req.headers.get("x-db-webhook-secret") !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      await handleEventPublished(body);
    } catch (error) {
      console.error("handleEventPublished error", error);
      // Supabase Database Webhook'ları hata durumunda retry eder — 500
      // dönmek bu retry'ı tetikler, kasıtlı.
      return new Response("Internal Error", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  }

  if (isTelegramUpdate(body)) {
    const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
    if (expectedSecret && req.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      if (body.message?.text === "/start") {
        await handleStart(body);
      } else if (body.callback_query) {
        await handleCallbackQuery(body);
      }
    } catch (error) {
      console.error("telegram update handling error", error);
      // Telegram'a yine de 200 dönüyoruz: 5xx dönersek Telegram aynı
      // update'i tekrar tekrar retry eder (long polling YASAK olduğu gibi,
      // burada da gereksiz retry fırtınası istenmiyor); hata zaten loglandı.
    }

    return new Response("ok", { status: 200 });
  }

  return new Response("Bad Request", { status: 400 });
});

function isDatabaseWebhookPayload(body: unknown): body is DatabaseWebhookPayload {
  return (
    typeof body === "object" &&
    body !== null &&
    "table" in body &&
    "record" in body &&
    "type" in body
  );
}

function isTelegramUpdate(body: unknown): body is TelegramUpdate {
  return typeof body === "object" && body !== null && "update_id" in body;
}
