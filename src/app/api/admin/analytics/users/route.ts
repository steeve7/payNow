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

function getRange(filter: string, start?: string | null, end?: string | null) {
  const now = new Date();
  if (filter === "custom" && start && end) {
    return { from: new Date(start), to: new Date(end) };
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
  // default
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

  // List users from Auth (admin API)
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = data.users || [];
  const totalUsers = users.length;

  const authenticatedUsers = users.filter((u) => !!u.last_sign_in_at).length;
  const nonAuthenticatedUsers = totalUsers - authenticatedUsers;

  const newUsersInPeriod = users.filter((u) => {
    const created = u.created_at ? new Date(u.created_at) : null;
    return created && created >= from && created <= to;
  }).length;

  return NextResponse.json({
    totalUsers,
    authenticatedUsers,
    nonAuthenticatedUsers,
    newUsersInPeriod,
  });
}
