import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "8737628631:AAGfIyu1KwORTpLXxhWFYCg6SMzZRoxot7U",
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || "@luhive_events",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "luhive_tg_secret_2026_test",
  dbWebhookSecret: process.env.DB_WEBHOOK_SECRET || "luhive_db_secret_2026_test",
  supabaseUrl: process.env.SUPABASE_URL || "https://knfjdhrjvwgibfwqzbim.supabase.co",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  luhiveBaseUrl: process.env.LUHIVE_BASE_URL || "https://luhive.com",
};
