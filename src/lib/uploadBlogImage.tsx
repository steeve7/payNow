import { supabase } from "@/lib/supabaseClient";

export async function uploadBlogImage(file: File) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  const token = data.session?.access_token;
  if (!token) throw new Error("Missing access token. Please sign in again.");

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/admin/blog-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: fd,
  });

  const out = await res.json().catch(() => null);
  if (!res.ok) throw new Error(out?.error || `Upload failed (${res.status})`);

  return out.url as string;
}
