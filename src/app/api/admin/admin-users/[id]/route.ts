import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_ROLES = new Set(["super_admin", "manager", "customer_support", "blog_manager"]);

async function requireSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return null;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (profileErr || !profile) return null;

  const role = String(profile.role || "user");
  if (role !== "super_admin") return null;

  return { userId: auth.user.id };
}

type PatchBody = {
  role: "super_admin" | "manager" | "customer_support" | "blog_manager";
};

// PATCH /api/admin/admin-users/:id (change role)
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const access = await requireSuperAdmin();
  if (!access) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const targetId = String(ctx.params.id || "").trim();
  if (!targetId) return NextResponse.json({ error: "Missing :id" }, { status: 400 });

  if (targetId === access.userId) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const newRole = body.role;
  if (!newRole || !ADMIN_ROLES.has(newRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetId)
    .select("id, email, full_name, phone, role, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ admin: data }, { status: 200 });
}

// DELETE /api/admin/admin-users/:id (disable user)
export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const access = await requireSuperAdmin();
  if (!access) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const targetId = String(ctx.params.id || "").trim();
  if (!targetId) return NextResponse.json({ error: "Missing :id" }, { status: 400 });

  if (targetId === access.userId) {
    return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
  }

  // Disable by banning for ~10 years
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
    ban_duration: "3650d",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { ok: true, disabled: true, user: { id: data.user?.id || targetId } },
    { status: 200 }
  );
}
