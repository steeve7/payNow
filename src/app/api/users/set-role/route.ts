import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

type Body = {
  userId: string; // profiles.id (same as auth.users.id)
  role: "user" | "super_admin" | "manager" | "customer_support" | "blog_manager";
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  // 1) Auth
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Check caller role
  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 500 });

  if (me?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Parse body
  const body = (await req.json()) as Body;
  if (!body?.userId || !body?.role) {
    return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
  }

  // 4) Update target user's role
  const { error: upErr } = await supabase
    .from("profiles")
    .update({ role: body.role })
    .eq("id", body.userId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
