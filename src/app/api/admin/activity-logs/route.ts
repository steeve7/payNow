import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
  if (me?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // If you haven't implemented logs yet, return empty list safely
  return NextResponse.json([]);
}
