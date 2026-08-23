import { Hono } from "hono";
import { config } from "../config";
import { handleStartMessage, handleChatMemberUpdate, handleMyChatMemberUpdate } from "../services/subscriber";
import { handleCallbackQuery } from "../services/callback";
import type { TelegramUpdate } from "../types";

export const webhookRouter = new Hono();

webhookRouter.post("/webhook", async (c) => {
  // 1. Verify Telegram Bot API Secret Token header
  const secretHeader = c.req.header("x-telegram-bot-api-secret-token");
  if (config.telegramWebhookSecret && secretHeader !== config.telegramWebhookSecret) {
    console.warn("Unauthorized webhook request: secret token mismatch");
    return c.text("Unauthorized", 401);
  }

  let body: TelegramUpdate;
  try {
    body = await c.req.json();
  } catch {
    return c.text("Bad Request", 400);
  }

  // 2. Process update asynchronously to return 200 immediately (prevents duplicate retries from Telegram)
  processUpdate(body).catch((err) => {
    console.error("Unhandled error processing Telegram update:", err);
  });

  return c.json({ ok: true });
});

async function processUpdate(update: TelegramUpdate) {
  if (update.message) {
    await handleStartMessage(update.message);
  } else if (update.chat_member) {
    await handleChatMemberUpdate(update.chat_member);
  } else if (update.my_chat_member) {
    await handleMyChatMemberUpdate(update.my_chat_member);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}
