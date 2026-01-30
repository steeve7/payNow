// /api/users/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: auth, error } = await supabase.auth.getUser();

  console.log("🧠 /api/users/me auth:", auth, error);

  if (!auth?.user) {
    return NextResponse.json(
      { error: "Unauthorized", debug: { auth, error } },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", auth.user.id)
    .single();

  console.log("🧠 profile:", profile, profileError);

  return NextResponse.json({
    userId: auth.user.id,
    email: auth.user.email,
    role: profile?.role ?? null,
  });
}
