import { Hono } from "hono";
import { config } from "../config";
import { broadcastEvent } from "../services/broadcast";
import type { DatabaseWebhookPayload } from "../types";

export const dbWebhookRouter = new Hono();

dbWebhookRouter.post("/events/webhook", async (c) => {
  // 1. Verify Database Webhook Secret
  const secretHeader = c.req.header("x-db-webhook-secret");
  if (config.dbWebhookSecret && secretHeader !== config.dbWebhookSecret) {
    console.warn("Unauthorized DB webhook request: secret mismatch");
    return c.text("Unauthorized", 401);
  }

  let body: DatabaseWebhookPayload;
  try {
    body = await c.req.json();
  } catch {
    return c.text("Bad Request", 400);
  }

  if (body.table === "events" && body.record?.status === "published") {
    // Prevent duplicate broadcast if old_record was already published
    if (body.old_record?.status === "published") {
      console.log(`Event ${body.record.id} was already published, skipping.`);
      return c.json({ ok: true, skipped: true });
    }

    // Process broadcast asynchronously
    broadcastEvent(body.record.id, { surface: "all" }).catch((err) => {
      console.error(`Broadcast failed for event ${body.record.id}:`, err);
    });
  }

  return c.json({ ok: true });
});
