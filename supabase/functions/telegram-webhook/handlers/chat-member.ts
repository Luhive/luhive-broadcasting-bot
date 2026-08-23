import { getSupabaseAdmin } from "../supabase-admin.ts";
import type { TelegramChatMemberUpdated, TelegramSubscriber } from "../types.ts";

export async function handleChatMember(update: TelegramChatMemberUpdated) {
  const user = update.new_chat_member?.user || update.old_chat_member?.user;
  if (!user || user.is_bot) return;

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const newStatus = update.new_chat_member.status;
  const oldStatus = update.old_chat_member.status;

  const isJoin =
    ["member", "administrator", "creator"].includes(newStatus) &&
    ["left", "kicked", "restricted"].includes(oldStatus);

  const isLeave = ["left", "kicked"].includes(newStatus);

  const { data: existing } = await supabase
    .from("telegram_subscriber")
    .select("*")
    .eq("telegram_user_id", user.id)
    .maybeSingle();

  if (isJoin) {
    const inviteLinkName = update.invite_link?.name || null;

    if (!existing) {
      await supabase.from("telegram_subscriber").insert({
        telegram_user_id: user.id,
        username: user.username || null,
        channel_joined_at: now,
        channel_source_code: inviteLinkName,
        channel_left_at: null,
        status: "active",
        created_at: now,
        updated_at: now,
      });
    } else {
      const subscriber = existing as TelegramSubscriber;
      await supabase
        .from("telegram_subscriber")
        .update({
          username: user.username || subscriber.username,
          channel_joined_at: now,
          channel_left_at: null,
          channel_source_code: subscriber.channel_source_code || inviteLinkName,
          updated_at: now,
        })
        .eq("id", subscriber.id);
    }
  } else if (isLeave) {
    if (existing) {
      await supabase
        .from("telegram_subscriber")
        .update({
          channel_left_at: now,
          updated_at: now,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("telegram_subscriber").insert({
        telegram_user_id: user.id,
        username: user.username || null,
        channel_left_at: now,
        status: "active",
        created_at: now,
        updated_at: now,
      });
    }
  }
}

export async function handleMyChatMember(update: TelegramChatMemberUpdated) {
  const user = update.from || update.new_chat_member?.user;
  if (!user || user.is_bot) return;

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const newStatus = update.new_chat_member.status;

  if (newStatus === "kicked") {
    await supabase
      .from("telegram_subscriber")
      .update({
        status: "blocked",
        updated_at: now,
      })
      .eq("telegram_user_id", user.id);
  } else if (["member", "administrator"].includes(newStatus)) {
    await supabase
      .from("telegram_subscriber")
      .update({
        status: "active",
        updated_at: now,
      })
      .eq("telegram_user_id", user.id);
  }
}
