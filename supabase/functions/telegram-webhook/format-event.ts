import type { Community, EventRow } from "./types.ts";
import { buildInlineKeyboard, type InlineButton } from "./telegram.ts";
import { getDictionary } from "./i18n.ts";

const AZ_MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "İyun",
  "İyul",
  "Avqust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
];

export function formatDateTime(isoString: string, timeZone = "Asia/Baku"): string {
  try {
    const d = new Date(isoString);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "Asia/Baku",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const map: Record<string, string> = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    const day = map.day || "01";
    const monthIndex = parseInt(map.month || "1", 10) - 1;
    const monthName = AZ_MONTHS[monthIndex] || map.month;
    const year = map.year || "2026";
    let hour = map.hour || "00";
    if (hour === "24") hour = "00";
    const minute = (map.minute || "00").padStart(2, "0");

    return `${day} ${monthName} ${year}, ${hour.padStart(2, "0")}:${minute}`;
  } catch {
    return isoString;
  }
}

export function formatEventCaption(event: EventRow, community: Community, language = "az") {
  const dict = getDictionary(language);
  const formattedDate = formatDateTime(event.start_time, event.timezone || "Asia/Baku");
  const fromCommunity = dict.bot.event_card.from_community.replace("{community}", community.name);

  return [
    `<b>${escapeHtml(event.title)}</b>`,
    "",
    `📅 ${dict.bot.event_card.date_label}: ${escapeHtml(formattedDate)}`,
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

export function buildBroadcastKeyboard(
  event: EventRow,
  community: Community,
  token: string,
  language = "az"
) {
  const dict = getDictionary(language);
  const baseUrl = Deno.env.get("LUHIVE_BASE_URL") || "https://dev.luhive.com";
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const eventUrl = `${cleanBaseUrl}/c/${community.slug}/${event.slug}?lt=${token}`;

  const row: InlineButton[] = [
    { text: dict.bot.buttons.register || "Qeydiyyatdan keç", url: eventUrl },
    { text: dict.bot.buttons.details || "Ətraflı", callback_data: `details:${event.id}` },
  ];

  return buildInlineKeyboard([row]);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
