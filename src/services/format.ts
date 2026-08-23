import type { Community, EventRow } from "../types";
import { buildInlineKeyboard, type InlineButton } from "../telegram";
import { config } from "../config";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatEventCaption(event: EventRow, community: Community): string {
  const date = new Date(event.start_time).toLocaleString("az-AZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone || "Asia/Baku",
  });

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

export function buildBroadcastKeyboard(eventSlug: string, token: string, eventId: string) {
  const eventUrl = `${config.luhiveBaseUrl}/e/${eventSlug}?lt=${token}`;
  const row: InlineButton[] = [
    { text: "Qeydiyyatdan keç", url: eventUrl },
    { text: "Ətraflı", callback_data: `details:${eventId}` },
  ];
  return buildInlineKeyboard([row]);
}
