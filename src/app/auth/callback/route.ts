// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Supabase may send either ?code=... (PKCE) OR tokens in the hash (implicit).
  // Server can only read query params, not hash.
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(error.message)}`, url.origin)
      );
    }
  }

  // If no code, redirect to client handler (hash case) or signin error
  return NextResponse.redirect(new URL("/", url.origin));
}
