import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = new Set(["super_admin"]); // adjust if needed

async function requireSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (error) return null;

  const role = String(profile?.role || "user");
  if (!ALLOWED_ROLES.has(role)) return null;

  return { userId: auth.user.id, role };
}

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/admin-users/:id
// body: { role: "manager" | "customer_support" | "blog_manager" | "user" | "super_admin" }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const access = await requireSuperAdmin();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    // ignore
  }

  const newRole = body?.role;
  if (!newRole || typeof newRole !== "string") {
    return NextResponse.json({ error: "Missing role" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ role: newRole })
    .eq("id", id)
    .select("id, email, full_name, phone, role, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ admin: data });
}

// DELETE /api/admin/admin-users/:id
// "disable user" option (soft delete): you can implement however you want
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const access = await requireSuperAdmin();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

  // Example: soft-disable via profiles flag (if you have one)
  // If you don’t have a column, remove this and implement your own.
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ disabled: true } as any)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
