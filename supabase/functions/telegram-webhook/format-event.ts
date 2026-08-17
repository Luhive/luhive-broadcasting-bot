import type { Community, EventRow } from "./types.ts";
import { buildInlineKeyboard, type InlineButton } from "./telegram.ts";
import { getDictionary } from "./i18n.ts";
import { buildRegisterUrl } from "../../../lib/telegram/build-register-url.ts";
import { buildNativeEventUrl } from "../../../lib/telegram/build-event-url.ts";

export function formatEventCaption(event: EventRow, community: Community, language = "az") {
  const dict = getDictionary(language);
  const date = new Date(event.start_time).toLocaleString("az-AZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone || "Asia/Baku",
  });

  const fromCommunity = dict.bot.event_card.from_community.replace("{community}", community.name);

  return [
    `<b>${escapeHtml(event.title)}</b>`,
    "",
    `${dict.bot.event_card.date_label}: ${escapeHtml(date)}`,
    ...formatLocationLines(event, dict),
    escapeHtml(fromCommunity),
  ].join("\n");
}

// event_type='online' (ya da hybrid'de link varsa) -> meet linki "Məkan"
// yerine ayrı bir "Görüşmə linki" satırı olarak gösterilir. Link yoksa
// (ör. henüz eklenmemişse) "Onlayn" metnine düşülür.
function formatLocationLines(event: EventRow, dict: ReturnType<typeof getDictionary>): string[] {
  const venue = event.location_name || event.location_address;
  const lines: string[] = [];

  if (event.event_type !== "online" && venue) {
    lines.push(`${dict.bot.event_card.location_label}: ${escapeHtml(venue)}`);
  }

  if (event.event_type === "online" || event.event_type === "hybrid") {
    if (event.online_meeting_link) {
      lines.push(`${dict.bot.event_card.meeting_link_label}: ${escapeHtml(event.online_meeting_link)}`);
    } else if (event.event_type === "online") {
      lines.push(`${dict.bot.event_card.location_label}: ${dict.bot.event_card.online_label}`);
    }
  } else if (!venue) {
    lines.push(`${dict.bot.event_card.location_label}: —`);
  }

  return lines;
}

// Register butonu events.registration_type'a göre karar veriliyor —
// communities'te is_luhive gibi bir alan yok, bu daha güncel/doğru mekanizma.
// native/both -> Luhive'in kendi kayıt sayfası (luhive.com/c/{community}/{event})
// external -> external_registration_url
// "both" durumunda native öncelikli gösteriliyor (tek Register butonu, §6).
export function buildEventKeyboard(event: EventRow, community: Community, language = "az") {
  const dict = getDictionary(language);
  const row: InlineButton[] = [];

  const registerUrl = resolveRegisterUrl(event, community);
  if (registerUrl) {
    row.push({ text: dict.bot.buttons.register, url: registerUrl });
  }

  row.push({ text: dict.bot.buttons.details, callback_data: `details:${event.id}` });

  return buildInlineKeyboard([row]);
}

function resolveRegisterUrl(event: EventRow, community: Community): string | null {
  if (event.registration_type === "external") {
    return event.external_registration_url ? buildRegisterUrl(event.external_registration_url) : null;
  }
  // "native" veya "both"
  return buildRegisterUrl(buildNativeEventUrl(community.slug, event.slug));
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
