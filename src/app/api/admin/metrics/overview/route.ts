// src/app/api/admin/metrics/overview/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/server";

export const runtime = "nodejs";

function rangeFromTimeFilter(
  timeFilter: string,
  start?: string | null,
  end?: string | null
) {
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

  return { startISO: null as string | null, endISO: null as string | null };
}

const toNum = (v: any) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function s(v: any) {
  return String(v ?? "").trim();
}

export async function GET(req: Request) {
  try {
    // 1) Session auth using cookie-based server client
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth?.user) {
      return NextResponse.json(
        { error: "Unauthorized", debug: { authError } },
        { status: 401 }
      );
    }

    // 2) Role check (still via session client, must be allowed by RLS on profiles)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const role = s(profile?.role).replace(/\s+/g, "_");
    if (role !== "super_admin" && role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3) Service-role client for analytics (bypass payments RLS)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4) Filters
    const url = new URL(req.url);
    const timeFilter = s(url.searchParams.get("timeFilter") ?? "all");
    const billType = s(url.searchParams.get("billType") ?? "all");
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const { startISO, endISO } = rangeFromTimeFilter(timeFilter, start, end);

    // 5) Query payments (admin client)
    let q = admin
      .from("payments")
      .select("id, user_id, amount, status, bill_type, created_at, is_guest, customer_phone");

    if (startISO && endISO) q = q.gte("created_at", startISO).lte("created_at", endISO);
    if (billType && billType !== "all") q = q.eq("bill_type", billType);

    const { data: rows, error: rowsError } = await q;
    if (rowsError) {
      return NextResponse.json(
        { error: rowsError.message, debug: { hint: rowsError.hint } },
        { status: 500 }
      );
    }

    const allAttempts = rows?.length ?? 0;

    const successful = (rows ?? []).filter(
      (r) => s(r.status).toLowerCase() === "success"
    );

    const totalTransactions = successful.length;
    const totalRevenue = successful.reduce((sum, r) => sum + toNum(r.amount), 0);

    // Active users: authed users + guest phones
    const userIds = new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean));
    const guestPhones = new Set(
      (rows ?? [])
        .filter((r: any) => r.is_guest === true)
        .map((r: any) => s(r.customer_phone))
        .filter(Boolean)
    );

    const activeUsers = userIds.size + guestPhones.size;

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
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
