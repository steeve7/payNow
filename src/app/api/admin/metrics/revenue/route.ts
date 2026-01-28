import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = new Set(["super_admin", "manager"]);

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
  return `${y}-${m}`;
}

export async function GET() {
  const access = await requireAdmin();
  if (!access) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const since = new Date();
  since.setMonth(since.getMonth() - 8);

  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("created_at,status,bill_type,amount")
    .gte("created_at", since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byType = new Map<string, { count: number; sum: number }>();
  const overTime = new Map<string, { count: number; sum: number }>();

  for (const row of data || []) {
    const status = String((row as any).status || "").toLowerCase();
    if (!(status === "success" || status === "successful" || status === "completed")) continue;

    const billType = String((row as any).bill_type || "unknown");
    const amt = Number((row as any).amount || 0);
    const mk = monthKey(new Date(row.created_at));

    const t = byType.get(billType) ?? { count: 0, sum: 0 };
    t.count += 1;
    t.sum += amt;
    byType.set(billType, t);

    const m = overTime.get(mk) ?? { count: 0, sum: 0 };
    m.count += 1;
    m.sum += amt;
    overTime.set(mk, m);
  }

  const byTypeArr = Array.from(byType.entries()).map(([bill_type, v]) => ({
    bill_type,
    transaction_count: v.count,
    total_revenue: v.sum,
    avg_revenue: v.count > 0 ? v.sum / v.count : 0,
  }));

  const overTimeArr = Array.from(overTime.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      transaction_count: v.count,
      total_revenue: v.sum,
    }));

  return NextResponse.json({ byType: byTypeArr, overTime: overTimeArr });
}
