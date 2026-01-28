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

function toDayKey(d: Date) {
  // YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const access = await requireAdmin();
  if (!access) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  // Adjust field names if your table differs
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("created_at,status")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const map = new Map<string, { total: number; successful: number }>();

  for (const row of data || []) {
    const day = toDayKey(new Date(row.created_at));
    const curr = map.get(day) ?? { total: 0, successful: 0 };
    curr.total += 1;

    const status = String((row as any).status || "").toLowerCase();
    if (status === "success" || status === "successful" || status === "completed") {
      curr.successful += 1;
    }

    map.set(day, curr);
  }

  const result = Array.from(map.entries()).map(([date, v]) => ({
    date, // chart uses this string
    total: v.total,
    successful: v.successful,
    successRate: v.total > 0 ? (v.successful / v.total) * 100 : 0,
  }));

  return NextResponse.json(result);
}
