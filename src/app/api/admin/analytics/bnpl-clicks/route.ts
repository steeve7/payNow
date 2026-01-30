import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = new Set(["super_admin", "manager"]);

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

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getRange(filter: string, start?: string | null, end?: string | null) {
  const now = new Date();
  if (filter === "custom" && start && end) {
    const from = new Date(start);
    const to = new Date(end);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (filter === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from, to: now };
  }
  if (filter === "30d" || filter === "all") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from, to: now };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return { from, to: now };
}

export async function GET(req: Request) {
  const access = await requireAdmin();
  if (!access) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") || "30d";
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const { from, to } = getRange(filter, start, end);

  const { data, error } = await supabaseAdmin
    .from("bnpl_clicks")
    .select("created_at,user_id")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true });

  // If table missing or query fails, return safe zeros (so dashboard still loads)
  if (error) {
    const msg = (error.message || "").toLowerCase();
    const isMissingTable =
      msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema");

    if (isMissingTable) {
      return NextResponse.json({
        totalClicks: 0,
        authenticatedUsers: 0,
        nonAuthenticatedClicks: 0,
        uniqueUsers: 0,
        clicksOverTime: [],
      });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let totalClicks = 0;
  let authenticatedUsers = 0;
  let nonAuthenticatedClicks = 0;

  const uniqueUsers = new Set<string>();
  const byDay = new Map<string, { clicks: number; unique: Set<string> }>();

  for (const row of data || []) {
    totalClicks += 1;

    const uid = row.user_id ? String(row.user_id) : "";
    if (uid) {
      authenticatedUsers += 1;
      uniqueUsers.add(uid);
    } else {
      nonAuthenticatedClicks += 1;
    }

    const dk = dayKey(new Date(row.created_at));
    const entry = byDay.get(dk) ?? { clicks: 0, unique: new Set<string>() };
    entry.clicks += 1;
    if (uid) entry.unique.add(uid);
    byDay.set(dk, entry);
  }

  const clicksOverTime = Array.from(byDay.entries()).map(([date, v]) => ({
    date,
    clicks: v.clicks,
    unique_users: v.unique.size,
  }));

  return NextResponse.json({
    totalClicks,
    authenticatedUsers,
    nonAuthenticatedClicks,
    uniqueUsers: uniqueUsers.size,
    clicksOverTime,
  });
}
