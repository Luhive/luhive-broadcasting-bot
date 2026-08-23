import { setWebhook, getWebhookInfo } from "../src/telegram";
import { config } from "../src/config";

async function main() {
  let urlArg = process.argv[2];
  if (!urlArg) {
    console.error("❌ Lütfen tünel URL'sini belirtin. Örnek:\n  npx tsx scripts/register-webhook.ts https://abc.loca.lt");
    process.exit(1);
  }

  // Clean duplicate https:// or trailing slashes
  urlArg = urlArg.trim().replace(/^(https?:\/\/)+/g, "https://").replace(/\/+$/, "");
  const webhookUrl = `${urlArg}/webhook`;

  console.log(`🔗 Webhook Telegram'a kaydediliyor: ${webhookUrl}`);
  const res = await setWebhook(webhookUrl, config.telegramWebhookSecret);

  if (res.ok) {
    console.log("✅ Webhook başarıyla kaydedildi!");
    const info = await getWebhookInfo();
    console.log("ℹ️ Güncel Webhook Bilgisi:", info.result);
  } else {
    console.error("❌ Hata:", res);
  }
}

main().catch(console.error);
