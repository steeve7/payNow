import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = String(searchParams.get("reference") || "").trim();
    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("reference,bill_type,status,vend_status,vend_response,created_at")
      .eq("reference", reference)
      .single();

    if (error || !data) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    return NextResponse.json({ payment: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
