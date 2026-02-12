// app/api/payments/by-reference/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; //  always run server-side (no static caching)
export const revalidate = 0; //  Next cache off

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function noCacheJson(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });

  //  prevent caching everywhere (browser/proxy/CDN)
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("Surrogate-Control", "no-store");
  res.headers.set("Vary", "*");

  return res;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = (searchParams.get("reference") || searchParams.get("ref") || "").trim();

    if (!reference) {
      return noCacheJson({ error: "Missing reference" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select(
        "reference,bill_type,status,vend_status,vend_provider,vend_reference,vend_response,amount,currency,created_at"
      )
      .eq("reference", reference)
      .single();

    if (error || !data) {
      return noCacheJson({ error: "Payment not found" }, { status: 404 });
    }

    return noCacheJson(
      {
        payment: data,
        server_time: new Date().toISOString(), // optional debug
      },
      { status: 200 }
    );
  } catch (e: any) {
    return noCacheJson({ error: e?.message || "Server error" }, { status: 500 });
  }
}
