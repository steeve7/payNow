import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export async function PUT(req: Request, { params }: { params: { userId: string } }) {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
  if (me?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const role = body?.role;
  if (!role) return NextResponse.json({ error: "Missing role" }, { status: 400 });

  const { error } = await supabase.from("profiles").update({ role }).eq("id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
  if (me?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // "Remove admin" = demote to user
  const { error } = await supabase.from("profiles").update({ role: "user" }).eq("id", params.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
