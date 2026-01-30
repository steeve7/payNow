import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
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

  // after google login -> go to pay-bills (you wanted this)
  return NextResponse.redirect(new URL("/pay-bills", url.origin));
}
