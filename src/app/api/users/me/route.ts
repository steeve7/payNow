import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = auth.user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const role = profile?.role ?? "user";

  return NextResponse.json({
    id: profile?.id ?? userId,
    email: profile?.email ?? auth.user.email ?? null,
    name: profile?.full_name ?? null,
    phone: profile?.phone ?? null,

    role,
    adminRole: role, // backward compatibility
  });
}
