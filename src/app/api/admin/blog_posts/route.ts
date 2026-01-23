import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  return NextResponse.json({ ok: true, route: "admin/blog-posts" });
}

export async function POST(req: Request) {
  try {
    // 1) Read bearer token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    // 2) Validate token (get user)
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = userData.user.id;

    // 3) Check admin role
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile lookup failed" }, { status: 403 });
    }

    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // 4) Read body
    const body = await req.json();
    const {
      title,
      excerpt,
      content,
      author,
      author_role,
      published_date,
      read_time,
      category,
      image_url,
    } = body;

    if (!title || !excerpt || !content || !author) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 5) Insert
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("blog_posts")
      .insert([
        {
          title,
          excerpt,
          content,
          author,
          author_role: author_role || "",
          published_date: published_date || new Date().toISOString(),
          read_time: read_time || "5 min read",
          category: category || "",
          image_url: image_url || "",
        },
      ])
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ post: inserted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
