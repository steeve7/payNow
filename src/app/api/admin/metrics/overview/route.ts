// src/app/api/admin/metrics/overview/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export const runtime = "nodejs";

function rangeFromTimeFilter(timeFilter: string, start?: string | null, end?: string | null) {
  const now = new Date();

  if (timeFilter === "today") {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    return { startISO: s.toISOString(), endISO: now.toISOString() };
  }

  if (timeFilter === "week") {
    const s = new Date(now);
    s.setDate(now.getDate() - 7);
    return { startISO: s.toISOString(), endISO: now.toISOString() };
  }

  if (timeFilter === "month") {
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
    e.setHours(23, 59, 59, 999);
    return { startISO: s.toISOString(), endISO: e.toISOString() };
  }

  // "all" or unknown -> no date filter
  return { startISO: null as string | null, endISO: null as string | null };
}

const toNum = (v: any) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    // 1) Auth (must have session cookie)
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      return NextResponse.json(
        { error: "Unauthorized", debug: { auth: { user: null }, authError } },
        { status: 401 }
      );
    }

    // 2) Role check (use same server client — RLS must allow reading own role)
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

    // 3) Filters
    const url = new URL(req.url);
    const timeFilter = String(url.searchParams.get("timeFilter") ?? "all");
    const billType = String(url.searchParams.get("billType") ?? "all");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const { startISO, endISO } = rangeFromTimeFilter(timeFilter, start, end);

    // 4) Query payments
    let q = supabase
      .from("payments")
      .select("id, user_id, amount, status, bill_type, created_at");

    if (startISO && endISO) q = q.gte("created_at", startISO).lte("created_at", endISO);

    if (billType && billType !== "all") {
      q = q.eq("bill_type", billType);
    }

    const { data: rows, error: rowsError } = await q;
    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 500 });
    }

    const allAttempts = rows?.length ?? 0;

    const successful = (rows ?? []).filter(
      (r) => String(r.status || "").toLowerCase() === "success"
    );

    const totalTransactions = successful.length;
    const totalRevenue = successful.reduce((sum, r) => sum + toNum(r.amount), 0);

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
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
