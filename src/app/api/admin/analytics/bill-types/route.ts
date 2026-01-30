import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = new Set(["super_admin", "manager"]);

function rangeFromFilter(filter: string, start?: string | null, end?: string | null) {
  const now = new Date();

  if (filter === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from, to: now };
  }

  if (filter === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    return { from, to: now };
  }

  if (filter === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from, to: now };
  }

  if (filter === "custom" && start && end) {
    const from = new Date(start);
    const to = new Date(end);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
      return { from: null as Date | null, to: null as Date | null };
    }
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  // "all" or unknown
  return { from: null as Date | null, to: null as Date | null };
}

export async function GET(req: Request) {
  // 1) Auth (cookie session)
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Role check (service role reads profile reliably)
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const role = String(profile?.role || "user").replace(/\s+/g, "_");
  if (!ALLOWED.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Query params
  const url = new URL(req.url);
  const filter = String(url.searchParams.get("filter") || "30d"); // today | 7d | 30d | custom | all
  const billType = String(url.searchParams.get("billType") || "all");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const { from, to } = rangeFromFilter(filter, start, end);

  // 4) Fetch payments (use supabaseAdmin to avoid RLS surprises)
  let q = supabaseAdmin
    .from("payments")
    .select("id,user_id,amount,status,bill_type,created_at");

  if (from && to) {
    q = q.gte("created_at", from.toISOString()).lte("created_at", to.toISOString());
  }

  if (billType && billType !== "all") {
    q = q.eq("bill_type", billType);
  }

  const { data: rows, error: rowsErr } = await q;
  if (rowsErr) {
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  // 5) Aggregate
  type Acc = {
    bill_type: string;
    attempts: number;
    success: number;
    revenue: number;
    users: Set<string>;
  };

  const map = new Map<string, Acc>();

  for (const r of rows || []) {
    const bt = String(r.bill_type || "unknown");
    const status = String(r.status || "").toLowerCase();
    const isSuccess = status === "success";
    const amount = Number(r.amount || 0);

    if (!map.has(bt)) {
      map.set(bt, {
        bill_type: bt,
        attempts: 0,
        success: 0,
        revenue: 0,
        users: new Set<string>(),
      });
    }

    const acc = map.get(bt)!;
    acc.attempts += 1;

    if (r.user_id) acc.users.add(String(r.user_id));

    if (isSuccess) {
      acc.success += 1;
      acc.revenue += Number.isFinite(amount) ? amount : 0;
    }
  }

  const result = Array.from(map.values()).map((acc) => {
    const transaction_count = acc.success; // your UI uses transaction_count as successful
    const total_revenue = acc.revenue;
    const avg_revenue = transaction_count === 0 ? 0 : total_revenue / transaction_count;
    const unique_users = acc.users.size;
    const success_rate = acc.attempts === 0 ? 0 : (acc.success / acc.attempts) * 100;

    return {
      bill_type: acc.bill_type,
      transaction_count,
      total_revenue,
      avg_revenue,
      unique_users,
      success_rate,
    };
  });

  // Optional: sort biggest volume first
  result.sort((a, b) => b.transaction_count - a.transaction_count);

  return NextResponse.json(result, { status: 200 });
}
