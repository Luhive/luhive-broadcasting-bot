import type { Community, EventRow } from "./types.ts";
import { buildInlineKeyboard, type InlineButton } from "./telegram.ts";
import { getDictionary } from "./i18n.ts";

const LUHIVE_BASE_URL = "https://luhive.com";

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
    `📅 ${dict.bot.event_card.date_label}: ${escapeHtml(date)}`,
    ...formatLocationLines(event, dict),
    escapeHtml(fromCommunity),
  ].join("\n");
}

function formatLocationLines(event: EventRow, dict: ReturnType<typeof getDictionary>): string[] {
  const venue = event.location_name || event.location_address;
  const lines: string[] = [];

  if (event.event_type !== "online" && venue) {
    lines.push(`📍 ${dict.bot.event_card.location_label}: ${escapeHtml(venue)}`);
  }

  if (event.event_type === "online" || event.event_type === "hybrid") {
    if (event.online_meeting_link) {
      lines.push(`🔗 ${dict.bot.event_card.meeting_link_label}: ${escapeHtml(event.online_meeting_link)}`);
    } else if (event.event_type === "online") {
      lines.push(`📍 ${dict.bot.event_card.location_label}: ${dict.bot.event_card.online_label}`);
    }
  } else if (!venue) {
    lines.push(`📍 ${dict.bot.event_card.location_label}: —`);
  }

  return lines;
}

export function buildBroadcastKeyboard(event: EventRow, token: string, language = "az") {
  const dict = getDictionary(language);
  const eventUrl = `${LUHIVE_BASE_URL}/e/${event.slug}?lt=${token}`;
  
  const row: InlineButton[] = [
    { text: dict.bot.buttons.register || "Qeydiyyatdan keç", url: eventUrl },
    { text: dict.bot.buttons.details || "Ətraflı", callback_data: `details:${event.id}` },
  ];

  return buildInlineKeyboard([row]);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
