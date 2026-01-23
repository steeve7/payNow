import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      //  MUST be true so the hash tokens get parsed and stored after OAuth
      detectSessionInUrl: true,

      // MUST be true so session is saved (localStorage)
      persistSession: true,

      // Recommended
      autoRefreshToken: true,
    },
  }
);
