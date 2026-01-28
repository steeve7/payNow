import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = new Set(["super_admin", "manager", "customer_support"]);

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  const role = String(profile?.role || "user");
  if (!ALLOWED.has(role)) return null;

  return { userId: auth.user.id, role };
}

function monthKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
}

export async function GET() {
  const access = await requireAdmin();
  if (!access) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const since = new Date();
  since.setMonth(since.getMonth() - 8); // last ~8 months

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("created_at,status,bill_type,user_id")
    .eq("bill_type", "electricity")
    .gte("created_at", since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // month -> set(user_id) for successful payments
  const byMonth = new Map<string, Set<string>>();

  for (const row of data || []) {
    const status = String((row as any).status || "").toLowerCase();
    if (!(status === "success" || status === "successful" || status === "completed")) continue;

    const uid = String((row as any).user_id || "");
    if (!uid) continue;

    const mk = monthKey(new Date(row.created_at));
    const set = byMonth.get(mk) ?? new Set<string>();
    set.add(uid);
    byMonth.set(mk, set);
  }

  const months = Array.from(byMonth.keys()).sort(); // ascending
  const result = months.map((m, idx) => {
    const current = byMonth.get(m) ?? new Set<string>();
    const prev = idx > 0 ? byMonth.get(months[idx - 1]) ?? new Set<string>() : new Set<string>();

    let retained = 0;
    if (prev.size > 0) {
      for (const uid of current) if (prev.has(uid)) retained += 1;
    }

    const rate = prev.size > 0 ? (retained / prev.size) * 100 : 0;

    return {
      month: m, // XAxis uses this
      usersPaying: current.size,
      retentionRate: rate,
    };
  });

  return NextResponse.json(result);
}
