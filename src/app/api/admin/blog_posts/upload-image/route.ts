import { NextResponse } from "next/server";
import { requireBlogAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  // Must be logged in + role allowed
  const auth = await requireBlogAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const formData = await req.formData();

    // IMPORTANT: UI sends "image"
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/jpg", "image/gif"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, JPG, GIF or WEBP images are allowed." },
        { status: 400 }
      );
    }

    const maxBytes = 5 * 1024 * 1024; // 5MB to match UI
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "Image too large. Max is 5MB." }, { status: 400 });
    }

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

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: pub } = supabaseAdmin.storage.from("blog-images").getPublicUrl(path);

    // IMPORTANT: return imageUrl because UI uses out.imageUrl
    return NextResponse.json({ imageUrl: pub.publicUrl, path }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
