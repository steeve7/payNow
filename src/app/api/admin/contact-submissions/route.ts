import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = new Set(["super_admin", "manager", "customer_support"]);

async function requireAdminAccess() {
  const supabase = await createSupabaseServerClient();

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  const userId = auth.user.id;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { ok: false as const, status: 403, error: "Profile lookup failed" };
  }

  const role = (profile.role || "user").toString();
  if (!ALLOWED_ROLES.has(role)) {
    return { ok: false as const, status: 403, error: "Not authorized" };
  }

  return { ok: true as const, userId, role };
}

export async function GET(req: Request) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "all").toLowerCase();

  const allowedStatus = new Set(["all", "unread", "read", "responded"]);
  if (!allowedStatus.has(status)) {
    return NextResponse.json(
      { error: "Invalid status filter" },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from("contact_submissions")
    .select("id,name,email,subject,message,status,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // returns array: ContactSubmission[]
  return NextResponse.json(data ?? []);
}
