import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const session = body?.session ?? null;

  // IMPORTANT: Create a response FIRST so we can attach cookies to it.
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // read cookies from request
        getAll() {
          return req.headers
            .get("cookie")
            ?.split(";")
            .map((c) => {
              const [name, ...rest] = c.trim().split("=");
              return { name, value: decodeURIComponent(rest.join("=") || "") };
            }) ?? [];
        },

        // write cookies to the response (THIS is the missing piece)
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // If no session, clear server session
  if (!session?.access_token || !session?.refresh_token) {
    await supabase.auth.signOut();
    return res;
  }

  // Set server session cookies
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return res;
}
