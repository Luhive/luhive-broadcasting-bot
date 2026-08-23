import { handleStart } from "./handlers/start.ts";
import { handleCallbackQuery } from "./handlers/callback.ts";
import { handleEventPublished } from "./handlers/event-published.ts";
import { handleChatMember, handleMyChatMember } from "./handlers/chat-member.ts";
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
      if (body.message?.text?.startsWith("/start")) {
        await handleStart(body);
      } else if (body.chat_member) {
        await handleChatMember(body.chat_member);
      } else if (body.my_chat_member) {
        await handleMyChatMember(body.my_chat_member);
      } else if (body.callback_query) {
        await handleCallbackQuery(body);
      }
    } catch (error) {
      console.error("telegram update handling error", error);
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
