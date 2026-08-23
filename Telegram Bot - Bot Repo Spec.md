---
tags:
 - project/luhive
date: 2026-08-18
description: "Build spec for the Telegram bot repo. Supabase Edge Functions, webhook and broadcast, subscriber tables."
---

# Telegram Bot - Bot Repo Spec

> Context and reasoning in [[Telegram Bot - v1 Spec]]. Web side in [[Telegram Bot - Luhive Repo Spec]].

**Owns** everything that talks to Telegram.
**Never** renders a page, and never reads registrations.

Supabase Edge Functions, Deno, pointed at the same Supabase project as Luhive.

## Contract with the Luhive repo

No API between the repos. They meet in the database and in one URL.

| | |
|---|---|
| This repo produces | `luhive.com/e/<slug>?lt=<token>` |
| Token format | `t_<random>` per recipient, `c_<broadcast_id>` per channel post |
| Luhive repo writes back | `broadcast_send.clicked_at`, and nothing else |

That write is the one place the boundary is crossed. Deliberate: the click is observed by the web app but belongs to this repo's data.

Migrations for the three tables below live here while the bot is an experiment. Fold into the single lineage in [[Luhive Platform Architecture - MOC]] when it stops being one.

## Tables

`telegram_subscriber` — one row per human, both surfaces

| Column | Notes |
|---|---|
| `telegram_user_id` bigint unique | The key. Username changes, never key on it |
| `username` | Nullable, display only |
| `bot_started_at`, `bot_source_code` | Null if channel only |
| `channel_joined_at`, `channel_source_code`, `channel_left_at` | Null if bot only |
| `status` | `active` / `blocked` |

`broadcast` — `event_id`, `surface` (`channel` / `bot`), `sent_at`, `sent_count`

`broadcast_send` — bot only. `broadcast_id`, `telegram_subscriber_id`, `token` unique indexed, `delivered_at`, `clicked_at`, `error`

A channel post is one `broadcast` row with no send rows.

`source_code` lookup — code to placement name. Do not encode meaning into the code string.

## `telegram-webhook`

Handles every update. **Write the row, return 200, do nothing slow.** Telegram retries on timeout and you get duplicates.

| Update | Action |
|---|---|
| `message` with `/start <code>` | Upsert on `telegram_user_id`, set `bot_started_at`, `bot_source_code`. Reply with a short welcome |
| `chat_member` join | Upsert, set `channel_joined_at` and `channel_source_code` from `invite_link.name` |
| `chat_member` leave | Set `channel_left_at` |
| `my_chat_member` blocked | Set `status = blocked` |

Config, all three required:

- `verify_jwt = false`. Telegram sends no JWT and every update would 401
- `setWebhook` with `allowed_updates` listing `message`, `chat_member`, `my_chat_member`. **`chat_member` is not sent by default**
- `setWebhook` with a `secret_token`. Compare against `X-Telegram-Bot-Api-Secret-Token` and reject mismatches. The function URL is public, so without this anyone can POST fake joins into the metric we steer by

Upsert on conflict, never insert blind. The same person can arrive on both surfaces in either order.

## `broadcast`

Takes an `event_id` and a surface.

**Channel.** Insert a `broadcast` row, `sendMessage` to the channel with an inline URL button to `?lt=c_<broadcast_id>`. One call, done.

**Bot.** Insert a `broadcast` row, then per subscriber where `bot_started_at IS NOT NULL` and `status = 'active'`:

- Skip anyone whose send row for this event already has `clicked_at`
- Insert a `broadcast_send` with a fresh `t_<random>` token
- `sendMessage` with the inline button to `?lt=<token>`

Loop with a sleep, under ~25 messages/sec. On `429` respect `retry_after`. On `403` set `status = blocked` and stop. Hand the loop to `EdgeRuntime.waitUntil` rather than blocking the response.

A run that approaches the wall clock limit is the trigger for the real queue.

## Setup checklist

- [ ] Bot created in BotFather
- [ ] Channel created, bot added as admin with post permission
- [ ] `setWebhook` with `allowed_updates` and `secret_token`
- [ ] `createChatInviteLink` once per placement, names stored
- [ ] `?start=` code per placement, stored
- [ ] Verified on a test channel that a join actually produces a `chat_member` update

## Test cases

Run with two spare Telegram accounts and `curl` for the webhook POSTs. Everything below is checkable by looking at the table or the chat, no instrumentation needed.

### A. Setup

| # | Do | Expect |
|---|---|---|
| A1 | `getWebhookInfo` | Your URL, `pending_update_count` 0, no `last_error_message` |
| A2 | Read `allowed_updates` in that response | Includes `chat_member`. If missing, joins never arrive and everything below silently passes with zero rows |
| A3 | `/start` from a second account | Update visible in function logs |

### B. Joins and identity

The point of this group is that one human is always one row, whatever order they arrive in.

| # | Do | Expect |
|---|---|---|
| B1 | Join the channel via the link named `gdg` | One row. `channel_joined_at` set, `channel_source_code = 'gdg'`, bot columns null |
| B2 | `/start gdg` from a fresh account | One row. `bot_started_at` set, `bot_source_code = 'gdg'`, channel columns null |
| B3 | Same account does B1 then B2 | Still **one** row, all columns filled |
| B4 | Fresh account does B2 then B1 | Still one row. Upsert works in both directions |
| B5 | `/start` with no code | Row created, `bot_source_code` null, counts as organic |
| B6 | `/start gdg`, later `/start linkedin` | `bot_source_code` stays `gdg`. Acquisition is first touch, unlike clicks |
| B7 | Account with no `@username` | Row created, `username` null, nothing crashes |
| B8 | Leave the channel | `channel_left_at` set. Row **not** deleted |
| B9 | Rejoin | `channel_left_at` cleared, `channel_joined_at` updated, still one row |
| B10 | Block the bot | `status = blocked` |
| B11 | Unblock and `/start` | `status` back to `active` |

### C. Security

| # | Do | Expect |
|---|---|---|
| C1 | POST to the webhook with no secret header | Rejected, no row written |
| C2 | POST with a wrong secret | Rejected, no row written |
| C3 | POST a fabricated join **with** the correct secret | Row **is** written |

C3 is meant to pass. It shows the secret is the only thing standing between a public URL and fake rows in the metric we steer by, which is why it belongs in env vars and never in the repo.

### D. Broadcast

| # | Do | Expect |
|---|---|---|
| D1 | Channel broadcast | One `broadcast` row `surface = channel`, **zero** send rows, post visible with a working button |
| D2 | Inspect that button's URL | Contains `?lt=c_<id>` matching the broadcast row |
| D3 | Bot broadcast with 3 test accounts subscribed | 3 send rows, 3 **distinct** tokens, each DM carrying its own |
| D4 | Tap the link from one of them | That send row gets `clicked_at`. The other two stay null |
| D5 | Re-run the bot broadcast for the same event | The account from D4 is skipped. The other two receive it again |
| D6 | Run `broadcast` twice for the same event and surface | Does not double-send |

### E. Errors and edge cases

| # | Do | Expect |
|---|---|---|
| E1 | Replay the same webhook POST body twice | No duplicate row, and no second welcome message. Telegram retries on timeout, so this happens in production |
| E2 | One subscriber blocks the bot mid-broadcast | Their send row records `error`, the loop continues, the rest still receive |
| E3 | Broadcast with zero eligible subscribers | Completes, `sent_count = 0`, no crash |
| E4 | Broadcast to enough accounts to take a while | Telegram gets its 200 immediately, sending continues in `waitUntil` |

### Gate

A2, B3, C1 and E1 are the four that fail silently in production if they are wrong. Everything else announces itself.
