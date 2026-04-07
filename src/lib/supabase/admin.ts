import { createClient } from "@supabase/supabase-js";
import { assertEnv } from "@/lib/env";

assertEnv();

export const adminClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
);
