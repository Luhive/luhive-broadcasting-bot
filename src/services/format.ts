import type { Community, EventRow } from "../types";
import { buildInlineKeyboard, type InlineButton } from "../telegram";
import { config } from "../config";

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

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

export function formatEventCaption(event: EventRow, community: Community): string {
  const date = formatDateTime(event.start_time, event.timezone || "Asia/Baku");

  const lines = [
    `<b>${escapeHtml(event.title)}</b>`,
    "",
    `📅 Tarix: ${escapeHtml(date)}`,
  ];

  const venue = event.location_name || event.location_address;
  if (event.event_type !== "online" && venue) {
    lines.push(`📍 Məkan: ${escapeHtml(venue)}`);
  }

  if (event.event_type === "online" || event.event_type === "hybrid") {
    if (event.online_meeting_link) {
      lines.push(`🔗 Görüşmə linki: ${escapeHtml(event.online_meeting_link)}`);
    } else if (event.event_type === "online") {
      lines.push(`📍 Məkan: Onlayn`);
    }
  } else if (!venue) {
    lines.push(`📍 Məkan: —`);
  }

  lines.push(`🏢 Təşkilatçı: ${escapeHtml(community.name)}`);

  return lines.join("\n");
}

export function buildBroadcastKeyboard(event: EventRow, community: Community, token: string) {
  const baseUrl = config.luhiveBaseUrl || "https://dev.luhive.com";
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  const eventUrl = `${cleanBaseUrl}/c/${community.slug}/${event.slug}?lt=${token}`;

  const row: InlineButton[] = [
    { text: "Qeydiyyatdan keç", url: eventUrl },
    { text: "Ətraflı", callback_data: `details:${event.id}` },
  ];
  return buildInlineKeyboard([row]);
}
