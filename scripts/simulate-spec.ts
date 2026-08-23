import { config } from "../src/config";

const BASE_URL = "http://localhost:3000";

async function sendWebhookUpdate(update: Record<string, unknown>, secret = config.telegramWebhookSecret) {
  const res = await fetch(`${BASE_URL}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify({ update_id: Date.now(), ...update }),
  });
  return { status: res.status, data: await res.text() };
}

async function runSimulations() {
  console.log("=== 🚀 TELEGRAM BOT SPEC TEST SIMULASYONU BAŞLATILIYOR ===\n");

  // 1. Güvenlik Testi (C1, C2)
  console.log("1. Güvenlik Testi: Secret olmadan veya yanlış secret ile webhook isteği...");
  const noSecret = await sendWebhookUpdate({ message: { text: "test" } }, "");
  console.log(`   - Secretsiz İstek: HTTP ${noSecret.status} (Beklenen: 401) ${noSecret.status === 401 ? "✅ GEÇTİ" : "❌ HATA"}`);

  const wrongSecret = await sendWebhookUpdate({ message: { text: "test" } }, "yanlis_secret");
  console.log(`   - Yanlış Secret: HTTP ${wrongSecret.status} (Beklenen: 401) ${wrongSecret.status === 401 ? "✅ GEÇTİ" : "❌ HATA"}`);

  // 2. /start ile Bot Başlatma (B2, B5, B6)
  console.log("\n2. /start gdg ile Abone Olma Testi...");
  const testUserId = 999000111;
  const startUpdate = {
    message: {
      message_id: 101,
      from: { id: testUserId, username: "test_kullanici", language_code: "az" },
      chat: { id: testUserId, type: "private" },
      text: "/start gdg",
      date: Math.floor(Date.now() / 1000),
    },
  };
  const startRes = await sendWebhookUpdate(startUpdate);
  console.log(`   - /start İsteği Gönderildi: HTTP ${startRes.status} ${startRes.status === 200 ? "✅ GEÇTİ" : "❌ HATA"}`);

  // 3. Kanala Katılma (B1)
  console.log("\n3. Kanala Katılma (chat_member) Testi...");
  const channelJoinUpdate = {
    chat_member: {
      chat: { id: -1001234567890, title: "Luhive Events", type: "channel" },
      from: { id: testUserId, username: "test_kullanici" },
      date: Math.floor(Date.now() / 1000),
      old_chat_member: { user: { id: testUserId }, status: "left" },
      new_chat_member: { user: { id: testUserId }, status: "member" },
      invite_link: { invite_link: "https://t.me/+abc", name: "gdg" },
    },
  };
  const joinRes = await sendWebhookUpdate(channelJoinUpdate);
  console.log(`   - Kanal Katılımı Gönderildi: HTTP ${joinRes.status} ${joinRes.status === 200 ? "✅ GEÇTİ" : "❌ HATA"}`);

  // 4. Botu Bloklama (B10)
  console.log("\n4. Botu Bloklama (my_chat_member) Testi...");
  const blockUpdate = {
    my_chat_member: {
      chat: { id: testUserId, type: "private" },
      from: { id: testUserId },
      date: Math.floor(Date.now() / 1000),
      old_chat_member: { user: { id: 8737628631 }, status: "member" },
      new_chat_member: { user: { id: 8737628631 }, status: "kicked" },
    },
  };
  const blockRes = await sendWebhookUpdate(blockUpdate);
  console.log(`   - Bloklama Güncellemesi Gönderildi: HTTP ${blockRes.status} ${blockRes.status === 200 ? "✅ GEÇTİ" : "❌ HATA"}`);

  console.log("\n=== ✅ TÜM SİMÜLASYON TESTLERİ TAMAMLANDI ===");
}

runSimulations().catch(console.error);
