import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeEmail(raw: string) {
  return (raw || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove zero-width chars
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string) {
  // simple + tolerant
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const emailRaw = url.searchParams.get("email") || "";
  const email = normalizeEmail(emailRaw);

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Email is required." },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: `Unable to validate email: "${email}"` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: `DB error: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, exists: !!data });
}
