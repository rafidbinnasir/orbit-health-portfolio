
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl: string =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const supabasePublishableKey: string =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function createClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing public Supabase environment variables. Check .env.local."
    );
  }

  return createBrowserClient(
    supabaseUrl,
    supabasePublishableKey
  );
}
