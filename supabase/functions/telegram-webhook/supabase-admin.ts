import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../lib/supabase/database.types.ts";

// SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY, Supabase tarafından her Edge
// Function'a otomatik olarak sağlanır — ayrıca `supabase secrets set` ile
// tanımlamaya gerek yok (hatta bu isimler reserved olduğu için CLI izin
// vermez). Bkz. SETUP.md.
export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY bulunamadı.");
  }

  return createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false } });
}
