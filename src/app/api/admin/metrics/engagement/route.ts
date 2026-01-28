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
    .select("created_at,status,user_id")
    .gte("created_at", since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const months = new Map<
    string,
    { totalTransactions: number; users: Set<string> }
  >();

  for (const row of data || []) {
    const status = String((row as any).status || "").toLowerCase();
    if (!(status === "success" || status === "successful" || status === "completed")) continue;

    const uid = String((row as any).user_id || "");
    if (!uid) continue;

    const mk = monthKey(new Date(row.created_at));
    const entry = months.get(mk) ?? { totalTransactions: 0, users: new Set<string>() };
    entry.totalTransactions += 1;
    entry.users.add(uid);
    months.set(mk, entry);
  }

  const result = Array.from(months.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => {
      const activeUsers = v.users.size;
      const avgTransactionsPerUser = activeUsers > 0 ? v.totalTransactions / activeUsers : 0;

      return {
        month,
        avgTransactionsPerUser,
        activeUsers,
        totalTransactions: v.totalTransactions,
      };
    });

  return NextResponse.json(result);
}
