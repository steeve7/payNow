import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = new Set(["super_admin", "manager", "customer_support"]);

async function requireAccess() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  const role = String(profile?.role || "user");
  if (!ALLOWED_ROLES.has(role)) return null;

  return { userId: auth.user.id, role };
}

export async function GET() {
  const access = await requireAccess();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { count, error } = await supabaseAdmin
    .from("contact_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ unread: count || 0 });
}
