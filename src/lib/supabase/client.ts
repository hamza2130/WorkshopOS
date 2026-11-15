import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Browser client: same anon key + the user's session cookie, so storage policies apply.
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
