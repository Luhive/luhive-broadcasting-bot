import { describe, it, expect, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

describe("Telegram Bot Spec Tests", () => {
  it("verifies webhook secret validation", async () => {
    const validSecret = "test_secret_123";
    
    // Missing secret
    const resNoSecret = await fetch("http://localhost:3000/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ update_id: 1 }),
    });
    assert.equal(resNoSecret.status, 401);

    // Invalid secret
    const resWrongSecret = await fetch("http://localhost:3000/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong_secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    assert.equal(resWrongSecret.status, 401);
  });
});
