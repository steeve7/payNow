import { NextResponse } from "next/server";
import { requireBlogAdmin } from "@/lib/adminAuth";

export async function GET() {
  const auth = await requireBlogAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabase } = auth;

  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("published_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data || [] });
}

export async function POST(req: Request) {
  const auth = await requireBlogAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { supabase } = auth;

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

  // Convert date-only string -> ISO timestamptz (midnight)
  const publishedISO = published_date
    ? new Date(`${published_date}T00:00:00.000Z`).toISOString()
    : new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from("blog_posts")
    .insert([
      {
        title,
        excerpt,
        content,
        author,
        author_role: author_role ?? "",
        published_date: publishedISO,
        read_time: read_time ?? "5 min read",
        category: category ?? "",
        image_url: image_url ?? "",
      },
    ])
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: inserted }, { status: 201 });
}
