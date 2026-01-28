import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = new Set(["super_admin", "manager", "blog_manager"]);

async function requireAccess() {
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

// GET /api/admin/blog_posts/:id
export async function GET(_req: NextRequest, { params }: Ctx) {
  const access = await requireAccess();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}

// PATCH /api/admin/blog_posts/:id
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const access = await requireAccess();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

  let body: any = null;
  try {
    body = await req.json();
  } catch {}

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}

// DELETE /api/admin/blog_posts/:id
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const access = await requireAccess();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;

  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
