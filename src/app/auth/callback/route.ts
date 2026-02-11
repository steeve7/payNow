import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // If we got a code -> PKCE flow
  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        return NextResponse.redirect(
          new URL(`/signin?error=${encodeURIComponent(error.message)}`, url.origin)
        );
      }

      return NextResponse.redirect(new URL("/pay-bills", url.origin));
    } catch (e: any) {
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent("Auth callback failed")}`, url.origin)
      );
    }
  }

  /**
   * If no code:
   * You are in implicit/hash flow (#access_token=...)
   * BUT server routes cannot read the hash because it is never sent to server.
   * So we must redirect to a CLIENT page that can read window.location.hash
   */
  return NextResponse.redirect(new URL("/auth/callback/client", url.origin));
}
