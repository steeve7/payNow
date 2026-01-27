import { NextResponse } from "next/server";
import { requireBlogAdmin } from "@/lib/adminAuth";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const auth = await requireBlogAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabase } = auth;
  const id = ctx.params.id;

  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ post: data });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const auth = await requireBlogAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabase } = auth;
  const id = ctx.params.id;

  const body = await req.json().catch(() => ({}));

  const {
    title,
    excerpt,
    content,
    author,
    author_role,
    published_date, // "YYYY-MM-DD"
    read_time,
    category,
    image_url,
  } = body;

  if (!title || !excerpt || !content || !author) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const publishedISO = published_date
    ? new Date(`${published_date}T00:00:00.000Z`).toISOString()
    : new Date().toISOString();

  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      title,
      excerpt,
      content,
      author,
      author_role: author_role ?? "",
      published_date: publishedISO,
      read_time: read_time ?? "5 min read",
      category: category ?? "",
      image_url: image_url ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: data });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const auth = await requireBlogAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabase } = auth;
  const id = ctx.params.id;

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
