import { createBrowserClient } from "@supabase/ssr";

export const supabaseAdmin = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
