import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    // 1) Token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    // 2) Validate token with ANON client
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser(token);

    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = userData.user.id;

    // 3) Admin role check (service role)
   const { data: profile, error: profileErr } = await supabaseAdmin
  .from("profiles")
  .select("role")
  .eq("id", userId)
  .single();

if (profileErr) {
  return NextResponse.json(
    { error: "Profile lookup failed", details: profileErr.message, userId },
    { status: 403 }
  );
}

if (!profile) {
  return NextResponse.json(
    { error: "Profile not found", userId },
    { status: 403 }
  );
}

if (profile.role !== "admin") {
  return NextResponse.json(
    { error: "Not authorized", role: profile.role, userId },
    { status: 403 }
  );
}


    // 4) Read formData
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, JPG or WEBP images are allowed." },
        { status: 400 }
      );
    }

    const maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "Image too large. Max is 3MB." }, { status: 400 });
    }

    // 5) Upload
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `posts/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("blog-images")
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 6) Return public URL
    const { data: pub } = supabaseAdmin.storage.from("blog-images").getPublicUrl(path);

    return NextResponse.json({ url: pub.publicUrl, path }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
