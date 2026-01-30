import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  if (profileErr) return null;

  const role = String(profile?.role || "user").replace(/\s+/g, "_");
  if (!ALLOWED.has(role)) return null;

  return { userId: auth.user.id, role };
}

export async function GET() {
  const access = await requireAdmin();
  if (!access) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  // Assumption: your table is "contact_submissions" and unread means is_read = false
  const { count, error } = await supabaseAdmin
    .from("contact_submissions")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  // If your table/column name differs, don't break dashboard
  if (error) {
    return NextResponse.json({ unread: 0 });
  }

  return NextResponse.json({ unread: Number(count || 0) });
}
