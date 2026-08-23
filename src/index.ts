import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { config } from "./config";
import { webhookRouter } from "./routes/webhook";
import { dbWebhookRouter } from "./routes/db-webhook";
import { apiRouter } from "./routes/api";

const app = new Hono();

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "Luhive Telegram Broadcasting Bot",
    uptime: process.uptime(),
  });
});

// Mount routes
app.route("/", webhookRouter);
app.route("/", dbWebhookRouter);
app.route("/api", apiRouter);

console.log(`Server is running on port ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});

export default app;
