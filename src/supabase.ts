import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

export function getSupabase() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    console.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Database operations might fail.");
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
