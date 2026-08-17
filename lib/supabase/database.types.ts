// El ile yazıldı. Bu, Luhive'in GERÇEK production şemasının TAMAMI DEĞİL —
// sadece Edge Function'ın (supabase/functions/telegram-webhook) dokunduğu
// tablo/kolonların projeksiyonu. `communities` ve `events` çok daha geniş
// (ör. settings, gamification, custom_questions...); burada sadece bot'un
// okuduğu alanlar var. Salt-okunur incelemeyle doğrulandı — bkz. SETUP.md.
//
// `bot_subscribers`, `bot_event_deliveries`, `bot_event_interactions` ise
// bu build'in eklediği (additive) yeni tablolar — bkz.
// supabase/migrations/0001_init.sql. `telegram_event_broadcasts` mevcut bir
// tablo, olduğu gibi (değiştirilmeden) kullanılıyor.
export interface Database {
  public: {
    Tables: {
      communities: {
        Row: {
          id: string;
          slug: string;
          name: string;
          cover_url: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          community_id: string;
          title: string;
          description: string;
          cover_url: string | null;
          slug: string;
          event_type: "in-person" | "online" | "hybrid";
          start_time: string;
          end_time: string | null;
          timezone: string;
          location_name: string | null;
          location_address: string | null;
          online_meeting_link: string | null;
          registration_type: "native" | "external" | "both";
          external_registration_url: string | null;
          status: "draft" | "published" | "cancelled";
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      telegram_event_broadcasts: {
        Row: {
          id: string;
          event_id: string;
          channel_message_id: number | null;
          broadcast_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          channel_message_id?: number | null;
          broadcast_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "telegram_event_broadcasts_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_subscribers: {
        Row: {
          id: number;
          username: string | null;
          language: "az" | "en";
          joined_at: string;
          last_active_at: string;
        };
        Insert: {
          id: number;
          username?: string | null;
          language?: "az" | "en";
          joined_at?: string;
          last_active_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bot_subscribers"]["Insert"]>;
        Relationships: [];
      };
      bot_event_deliveries: {
        Row: {
          event_id: string;
          subscriber_id: number;
          delivered_at: string;
        };
        Insert: {
          event_id: string;
          subscriber_id: number;
          delivered_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "bot_event_deliveries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_event_deliveries_subscriber_id_fkey";
            columns: ["subscriber_id"];
            isOneToOne: false;
            referencedRelation: "bot_subscribers";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_event_interactions: {
        Row: {
          id: number;
          event_id: string;
          subscriber_id: number;
          action: "details";
          interacted_at: string;
        };
        Insert: {
          id?: number;
          event_id: string;
          subscriber_id: number;
          action: "details";
          interacted_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "bot_event_interactions_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_event_interactions_subscriber_id_fkey";
            columns: ["subscriber_id"];
            isOneToOne: false;
            referencedRelation: "bot_subscribers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
