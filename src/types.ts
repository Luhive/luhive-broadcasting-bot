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

export interface TelegramSubscriber {
  id: string;
  telegram_user_id: number;
  username: string | null;
  bot_started_at: string | null;
  bot_source_code: string | null;
  channel_joined_at: string | null;
  channel_source_code: string | null;
  channel_left_at: string | null;
  status: "active" | "blocked";
  created_at: string;
  updated_at: string;
}

export interface Broadcast {
  id: string;
  event_id: string;
  surface: "channel" | "bot";
  sent_at: string;
  sent_count: number;
}

export interface BroadcastSend {
  id: string;
  broadcast_id: string;
  telegram_subscriber_id: string;
  token: string;
  delivered_at: string;
  clicked_at: string | null;
  error: string | null;
}

export interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: EventRow;
  old_record: EventRow | null;
}

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
}

export interface TelegramChatMember {
  user: TelegramUser;
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
}

export interface TelegramInviteLink {
  invite_link: string;
  name?: string;
  creator?: TelegramUser;
}

export interface TelegramChatMemberUpdated {
  chat: TelegramChat;
  from: TelegramUser;
  date: number;
  old_chat_member: TelegramChatMember;
  new_chat_member: TelegramChatMember;
  invite_link?: TelegramInviteLink;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  chat_member?: TelegramChatMemberUpdated;
  my_chat_member?: TelegramChatMemberUpdated;
  callback_query?: TelegramCallbackQuery;
}
