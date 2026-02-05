// app/api/admin/transactions/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ALLOWED = new Set(["super_admin", "manager", "customer_support"]);

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return null;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profileErr || !profile) return null;

  const role = String(profile?.role || "user").trim().replace(/\s+/g, "_");
  if (!ALLOWED.has(role)) return null;

  return { userId: auth.user.id, role };
}

export async function GET(req: Request) {
  try {
    const access = await requireAdmin();
    if (!access) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select(
        [
          "id",
          "reference",
          "bill_type",
          "gateway",
          "amount",
          "paid_amount",
          "currency",
          "status",
          "is_guest",
          "user_id",
          "customer_phone",
          "email",
          "vend_status",
          "vend_provider",
          "vend_reference",
          "created_at",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize to your existing UI expectation
    const normalized = (data || []).map((r: any) => ({
      id: r.id,
      transaction_token: r.reference, // <--- key fix
      bill_type: r.bill_type,
      gateway: r.gateway,
      amount: Number(r.amount || 0),
      paid_amount: r.paid_amount,
      currency: r.currency,
      status: r.status,
      created_at: r.created_at,

      // optional admin fields
      is_guest: r.is_guest,
      user_id: r.user_id,
      customer_phone: r.customer_phone,
      email: r.email,
      vend_status: r.vend_status,
      vend_provider: r.vend_provider,
      vend_reference: r.vend_reference,
    }));

    return NextResponse.json(normalized, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
