import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envArg = (process.argv[2] || "test").toLowerCase();
const envFileName = envArg.startsWith("prod") ? ".env.production" : ".env.test";
const envPath = path.resolve(process.cwd(), envFileName);

if (!fs.existsSync(envPath)) {
  console.error(`❌ '${envFileName}' dosyası bulunamadı!`);
  process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));

const projectRef = envConfig.SUPABASE_PROJECT_REF;
const botToken = envConfig.TELEGRAM_BOT_TOKEN;
const channelId = envConfig.TELEGRAM_CHANNEL_ID;
const tgSecret = envConfig.TELEGRAM_WEBHOOK_SECRET || "luhive_tg_secret_2026";
const dbSecret = envConfig.DB_WEBHOOK_SECRET || "luhive_db_secret_2026";

if (!projectRef || projectRef.includes("BURAYA_")) {
  console.error("❌ Hata: SUPABASE_PROJECT_REF geçerli bir değer içermiyor. Lütfen .env dosyasını doldurun.");
  process.exit(1);
}

if (!botToken || botToken.includes("BURAYA_")) {
  console.error("❌ Hata: TELEGRAM_BOT_TOKEN geçerli bir değer içermiyor. Lütfen .env dosyasını doldurun.");
  process.exit(1);
}

console.log(`\n======================================================`);
console.log(`🚀 [${envArg.toUpperCase()}] ORTAMI DAĞITIMI (DEPLOYMENT) BAŞLATILIYOR`);
console.log(`======================================================`);
console.log(`📌 Supabase Projesi: ${projectRef}`);
console.log(`📌 Telegram Kanalı : ${channelId}`);
console.log(`📌 Ortam Dosyası   : ${envFileName}\n`);

function run(cmd: string, title: string) {
  console.log(`▶️ ${title}...`);
  try {
    execSync(cmd, { stdio: "inherit" });
    console.log(`✅ ${title} başarılı!\n`);
  } catch {
    console.error(`❌ ${title} sırasında hata oluştu.`);
    process.exit(1);
  }
}

// 1. Supabase Link
run(`npx supabase link --project-ref ${projectRef}`, "1. Supabase Projesine Bağlanma (link)");

// 2. Database Push (Tablo & Migration'lar)
run(`npx supabase db push`, "2. Veritabanı Tablolarını Uygulama (db push)");

// 3. Edge Function Deploy
run(`npx supabase functions deploy telegram-webhook --no-verify-jwt`, "3. Edge Function Deploy Etme");

// 4. Supabase Secrets Set
run(
  `npx supabase secrets set TELEGRAM_BOT_TOKEN="${botToken}" TELEGRAM_CHANNEL_ID="${channelId}" TELEGRAM_WEBHOOK_SECRET="${tgSecret}" DB_WEBHOOK_SECRET="${dbSecret}"`,
  "4. Supabase Ortam Değişkenlerini (Secrets) Kaydetme"
);

// 5. Telegram Webhook Set
async function setTelegramWebhook() {
  console.log("▶️ 5. Telegram Webhook Adresini Kaydetme...");
  const webhookUrl = `https://${projectRef}.supabase.co/functions/v1/telegram-webhook`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: tgSecret,
      allowed_updates: ["message", "chat_member", "my_chat_member", "callback_query"],
    }),
  });

  const data = await res.json();
  if (data.ok) {
    console.log(`✅ Telegram Webhook başarıyla bağlandı: ${webhookUrl}\n`);
  } else {
    console.error("❌ Telegram Webhook bağlanırken hata:", data);
  }

  // Get Webhook Info
  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log("ℹ️ Güncel Telegram Webhook Durumu:", infoData.result);
}

setTelegramWebhook().then(() => {
  console.log(`\n🎉 [${envArg.toUpperCase()}] ORTAMI DEPLOY İŞLEMİ EKSİKSİZ TAMAMLANDI!\n`);
});
