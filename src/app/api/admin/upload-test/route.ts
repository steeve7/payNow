import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");

  return NextResponse.json({
    ok: true,
    hasAuthorizationHeader: !!authHeader,
    hasBearer,
    headerPreview: authHeader ? authHeader.slice(0, 20) + "..." : null,
  });
}
