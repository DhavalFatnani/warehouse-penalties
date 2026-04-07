import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Inlined at build/dev time via next.config.mjs from SUPABASE_* or NEXT_PUBLIC_*.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase browser env: set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env, then restart `next dev`"
    );
  }

  return createBrowserClient(url, key);
}
