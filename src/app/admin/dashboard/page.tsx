// src/app/admin/dashboard/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import AdminDashboard from "@/components/features/AdminDashboard";

const ALLOWED = new Set([
  "super_admin",
  "manager",
  "customer_support",
  "blog_manager",
]);
export const runtime = "nodejs";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth?.user) redirect("/signin");

  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (pErr) redirect("/signin");

  const role = String(profile?.role || "user").replace(/\s+/g, "_");
  if (!ALLOWED.has(role)) redirect("/");

  return <AdminDashboard />;
}
