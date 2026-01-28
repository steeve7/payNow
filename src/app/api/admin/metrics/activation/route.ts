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

export async function GET() {
  const access = await requireAdmin();
  if (!access) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  // total users = profiles count
  const { count: totalUsers, error: totalErr } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (totalErr) return NextResponse.json({ error: totalErr.message }, { status: 500 });

  // users with at least 1 successful payment
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("user_id,status");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const activated = new Set<string>();

  for (const row of data || []) {
    const status = String((row as any).status || "").toLowerCase();
    if (!(status === "success" || status === "successful" || status === "completed")) continue;

    const uid = String((row as any).user_id || "");
    if (uid) activated.add(uid);
  }

  const successfulFirstPayments = activated.size;
  const total = Number(totalUsers || 0);
  const activationRate = total > 0 ? (successfulFirstPayments / total) * 100 : 0;

  return NextResponse.json({
    totalUsers: total,
    successfulFirstPayments,
    activationRate,
  });
}
