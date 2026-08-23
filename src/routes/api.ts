import { Hono } from "hono";
import { config } from "../config";
import { broadcastEvent } from "../services/broadcast";
import { setWebhook, getWebhookInfo } from "../telegram";
import { getSupabase } from "../supabase";

export const apiRouter = new Hono();

// Manual broadcast trigger
apiRouter.post("/broadcast", async (c) => {
  const body = await c.req.json<{ event_id: string; surface?: "channel" | "bot" | "all"; channel_id?: string }>();
  if (!body.event_id) {
    return c.json({ error: "event_id is required" }, 400);
  }

  const result = await broadcastEvent(body.event_id, {
    surface: body.surface || "all",
    channelIdOverride: body.channel_id,
  });

  return c.json(result);
});

// Configure Telegram Webhook
apiRouter.post("/set-webhook", async (c) => {
  const body = await c.req.json<{ url: string; secret?: string }>();
  if (!body.url) {
    return c.json({ error: "url is required" }, 400);
  }

  const secret = body.secret || config.telegramWebhookSecret;
  const result = await setWebhook(body.url, secret);
  return c.json(result);
});

// Check Telegram Webhook Status (Test A1, A2)
apiRouter.get("/webhook-info", async (c) => {
  const result = await getWebhookInfo();
  return c.json(result);
});

// List Subscribers (for verification / testing)
apiRouter.get("/subscribers", async (c) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("telegram_subscriber").select("*");
  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ subscribers: data });
});
