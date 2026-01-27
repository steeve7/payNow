import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  // 1) Auth
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2) super_admin only
  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 500 });
  if (me?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 3) Body: email + role
  const body = await req.json().catch(() => null);
  const emailRaw = body?.email;
  const role = body?.role;

  if (!emailRaw || !role) {
    return NextResponse.json({ error: "Missing email or role" }, { status: 400 });
  }

  const email = String(emailRaw).trim().toLowerCase();

  // 4) Find user by email (case-insensitive)
  // We store emails in profiles.email, so match on lower(email)
  const { data: target, error: findErr } = await supabase
    .from("profiles")
    .select("id, email, role")
    .ilike("email", email) // case-insensitive exact match if you lower() client-side
    .single();

  if (findErr || !target) {
    return NextResponse.json(
      { error: "User not found. The user must sign up first." },
      { status: 404 }
    );
  }

  // 5) Update role
  const { error: upErr } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", target.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
