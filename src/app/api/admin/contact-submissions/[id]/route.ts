import { NextResponse, type NextRequest } from "next/server";
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

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/contact-submissions/:id
// body: { "status": "read" | "responded" }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id: idParam } = await params;

  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = (body?.status || "").toLowerCase();
  if (status !== "read" && status !== "responded") {
    return NextResponse.json(
      { error: 'Invalid status. Use "read" or "responded".' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("contact_submissions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,name,email,subject,message,status,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, submission: data });
}

// DELETE /api/admin/contact-submissions/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id: idParam } = await params;

  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("contact_submissions")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
