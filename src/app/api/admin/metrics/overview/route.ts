import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

function rangeFromTimeFilter(timeFilter: string, start?: string, end?: string) {
  const now = new Date();

  if (timeFilter === "today") {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    return { startISO: s.toISOString(), endISO: now.toISOString() };
  }

  if (timeFilter === "week") {
    // last 7 days
    const s = new Date(now);
    s.setDate(now.getDate() - 7);
    return { startISO: s.toISOString(), endISO: now.toISOString() };
  }

  if (timeFilter === "month") {
    // last 30 days
    const s = new Date(now);
    s.setDate(now.getDate() - 30);
    return { startISO: s.toISOString(), endISO: now.toISOString() };
  }

  if (timeFilter === "custom" && start && end) {
    const s = new Date(start);
    const e = new Date(end);
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) {
      return { startISO: null as string | null, endISO: null as string | null };
    }
    // include full end day
    e.setHours(23, 59, 59, 999);
    return { startISO: s.toISOString(), endISO: e.toISOString() };
  }

  return { startISO: null as string | null, endISO: null as string | null };
}


export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  // 1) Auth
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Role check
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const role = String(profile?.role ?? "user").replace(/\s+/g, "_");
  if (role !== "super_admin" && role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Filters from query string
  const url = new URL(req.url);
  const timeFilter = url.searchParams.get("timeFilter") ?? "all";
  const billType = url.searchParams.get("billType") ?? "all";
  const start = url.searchParams.get("start") ?? undefined;
  const end = url.searchParams.get("end") ?? undefined;

  const { startISO, endISO } = rangeFromTimeFilter(timeFilter, start, end);

  // 4) Query payments (only needed fields)
  let q = supabase
    .from("payments")
    .select("id, user_id, amount, status, bill_type, created_at");

  if (startISO && endISO) q = q.gte("created_at", startISO).lte("created_at", endISO);

  if (billType !== "all") {
    // bill_type examples: "intl_airtime", "airtime", "data", ...
    q = q.eq("bill_type", billType);
  }

  const { data: rows, error: rowsError } = await q;
  if (rowsError) {
    return NextResponse.json({ error: rowsError.message }, { status: 500 });
  }

  const allAttempts = rows?.length ?? 0;
  const successful = (rows ?? []).filter(
    (r) => String(r.status).toLowerCase() === "success"
  );

  const totalTransactions = successful.length;
  const totalRevenue = successful.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const activeUsers = new Set((rows ?? []).map((r) => r.user_id).filter(Boolean)).size;

  const successRate = allAttempts === 0 ? 0 : (totalTransactions / allAttempts) * 100;
  const nsm = activeUsers === 0 ? 0 : totalTransactions / activeUsers;
  const revenuePerTransaction = totalTransactions === 0 ? 0 : totalRevenue / totalTransactions;

  return NextResponse.json({
    totalTransactions,
    totalRevenue,
    activeUsers,
    successRate,
    nsm,
    revenuePerTransaction,
  });
}
