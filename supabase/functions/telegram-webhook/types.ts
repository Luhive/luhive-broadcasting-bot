// Bu tipler Luhive'in GERÇEK production şemasına göre yazıldı (supabase
// list_tables ile salt-okunur incelendi, bkz. SETUP.md). Sadece bot'un
// kullandığı alanlar var — communities/events tabloları bundan çok daha
// geniş, burada projeksiyon.

export interface Community {
  id: string;
  slug: string;
  name: string;
  cover_url: string | null;
}

export type EventStatus = "draft" | "published" | "cancelled";
export type EventType = "in-person" | "online" | "hybrid";
export type RegistrationType = "native" | "external" | "both";

export interface EventRow {
  id: string;
  community_id: string;
  title: string;
  description: string;
  cover_url: string | null;
  slug: string;
  event_type: EventType;
  start_time: string;
  end_time: string | null;
  timezone: string;
  location_name: string | null;
  location_address: string | null;
  online_meeting_link: string | null;
  registration_type: RegistrationType;
  external_registration_url: string | null;
  status: EventStatus;
}

export interface BotSubscriber {
  id: number;
  username: string | null;
  language: "az" | "en";
}

// Supabase Database Webhook payload şekli (events tablosu için).
// Bkz. https://supabase.com/docs/guides/database/webhooks
export interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: EventRow;
  old_record: EventRow | null;
}

// Telegram Bot API update şekli — sadece kullandığımız alanlar.
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; language_code?: string };
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { chat: { id: number; type: string }; message_id: number };
    data?: string;
  };
}
