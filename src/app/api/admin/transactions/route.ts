import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = new Set(["super_admin", "manager", "customer_support"]);

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return null;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profileErr) return null;

  const role = String(profile?.role || "user").replace(/\s+/g, "_");
  if (!ALLOWED.has(role)) return null;

  return { userId: auth.user.id, role };
}

export async function GET(req: Request) {
  const access = await requireAdmin();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);

  // Try the full select first
  const attempt = await supabaseAdmin
    .from("payments")
    .select("id, transaction_token, bill_type, amount, status, created_at, account_number")
    .order("created_at", { ascending: false })
    .limit(limit);

  // If it fails due to missing column(s), fallback to a safe select
  if (attempt.error) {
    const msg = attempt.error.message || "";
    const looksLikeMissingColumn =
      msg.toLowerCase().includes("column") && msg.toLowerCase().includes("does not exist");

    if (!looksLikeMissingColumn) {
      return NextResponse.json({ error: attempt.error.message }, { status: 500 });
    }

    const fallback = await supabaseAdmin
      .from("payments")
      .select("id, transaction_token, bill_type, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }

    // Normalize to match your frontend shape (account_number optional)
    const normalized = (fallback.data || []).map((r: any) => ({
      ...r,
      account_number: null,
    }));

    return NextResponse.json(normalized);
  }

  return NextResponse.json(attempt.data || []);
}
