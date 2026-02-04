// app/api/debug/vtpass-auth/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.VTPASS_API_KEY || "";
  const secretKey = process.env.VTPASS_SECRET_KEY || "";

  const res = await fetch("https://sandbox.vtpass.com/api/merchant-verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      "secret-key": secretKey,
    },
    body: JSON.stringify({ serviceID: "gotv", billersCode: "1234567890" }),
  });

  const text = await res.text();

  return NextResponse.json({
    status: res.status,
    body: text.slice(0, 2000),
  });
}
