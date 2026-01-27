import { createSupabaseServerClient } from "@/lib/server";

export async function requireBlogAdmin() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", auth.user.id)
    .single();

  if (pErr || !profile) {
    return { ok: false as const, status: 403, error: "Profile lookup failed" };
  }

  const role = profile.role;
  const allowed = role === "super_admin" || role === "blog_manager";
  if (!allowed) return { ok: false as const, status: 403, error: "Forbidden" };

  return { ok: true as const, supabase, user: auth.user, profile };
}
