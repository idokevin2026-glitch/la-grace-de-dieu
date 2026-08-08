import { createBrowserClient } from "@supabase/ssr";
import { cleanSupabaseEnv } from "./clean-env";

export function createClient() {
  return createBrowserClient(
    cleanSupabaseEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleanSupabaseEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
