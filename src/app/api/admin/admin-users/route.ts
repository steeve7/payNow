// src/app/api/admin/admin-users/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const ADMIN_ROLES = ["super_admin", "manager", "customer_support", "blog_manager"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

async function requireSuperAdmin() {
  const supabase = await createSupabaseServerClient();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  console.log("AUTH:", auth, authErr);

  if (authErr || !auth?.user) return null;

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  console.log("PROFILE:", profile, profileErr);

  if (profileErr || !profile) return null;
  if (String(profile.role || "user") !== "super_admin") return null;

  return { userId: auth.user.id };
}

type CreateAdminBody = {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  role: AdminRole;
  email_confirm?: boolean;
};

// GET /api/admin/admin-users (list admins)
export async function GET(req: Request) {
  const access = await requireSuperAdmin();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim();
  const role = String(searchParams.get("role") || "").trim();

  let query = supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, phone, role, created_at")
    .in("role", [...ADMIN_ROLES])
    .order("created_at", { ascending: false });

  if (role && ADMIN_ROLES.includes(role as AdminRole)) {
    query = query.eq("role", role);
  }

  if (q) {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ admins: data || [] }, { status: 200 });
}

// POST /api/admin/admin-users (create admin)
export async function POST(req: Request) {
  const access = await requireSuperAdmin();
  if (!access) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: CreateAdminBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const full_name = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  const role = body.role;
  const email_confirm = body.email_confirm ?? true;

  if (!email || !password || !role) {
    return NextResponse.json(
      { error: "Missing required fields: email, password, role" },
      { status: 400 }
    );
  }

  if (!ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // 1) Create auth user
  const { data: created, error: createErr } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm,
      user_metadata: { full_name, phone },
    });

  if (createErr || !created?.user) {
    console.error("createUser error:", createErr);
    return NextResponse.json(
      { error: createErr?.message || "Database error creating new user" },
      { status: 500 }
    );
  }

  const newUserId = created.user.id;

  // 2) Upsert profile with role
// 2) Upsert profile with role (DEBUG FIRST)
const { data: jwtCtx, error: jwtErr } = await supabaseAdmin.rpc("debug_jwt_context");
console.log("JWT CONTEXT (supabaseAdmin -> Postgres):", jwtCtx, jwtErr);

const { error: upsertErr } = await supabaseAdmin.from("profiles").upsert(
  {
    id: newUserId,
    email,
    full_name: full_name || null,
    phone: phone || null,
    role,
  },
  { onConflict: "id" }
);

if (upsertErr) {
  console.error("profiles upsert error:", upsertErr);
  await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {});
  return NextResponse.json(
    {
      error: upsertErr.message || "Failed to save profile role",
      debug: {
        jwtCtx,
        upsertErr,
      },
    },
    { status: 500 }
  );
}

  return NextResponse.json(
    {
      user: {
        id: newUserId,
        email,
        role,
        full_name: full_name || null,
        phone: phone || null,
      },
    },
    { status: 201 }
  );
}
