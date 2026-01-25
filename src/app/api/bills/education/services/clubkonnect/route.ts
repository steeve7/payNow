// src/app/api/bills/education/services/clubkonnect/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function errorToDebug(e: any) {
  return {
    name: e?.name,
    message: e?.message,
    code: e?.code,
    errno: e?.errno,
    syscall: e?.syscall,
    cause: e?.cause ? String(e.cause) : null,
  };
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();

    let out: any = {};
    try {
      out = text ? JSON.parse(text) : {};
    } catch {
      out = { nonJsonResponse: text };
    }

    return { res, out };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const baseUrl = String(process.env.CLUBKONNECT_BASE_URL || "").trim();
  const apiKey = String(process.env.CLUBKONNECT_API_KEY || "").trim();
  const endpoint = String(
    process.env.CLUBKONNECT_EDUCATION_SERVICES_ENDPOINT || "/education/services"
  ).trim();

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Missing CLUBKONNECT_BASE_URL or CLUBKONNECT_API_KEY in .env" },
      { status: 500 }
    );
  }

  const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;

  try {
    const { res, out } = await fetchJsonWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
      12000
    );

    // If CK is unreachable / not responding, expose that clearly
    if (!res.ok) {
      return NextResponse.json(
        { error: "ClubKonnect services request failed", debug: { url, status: res.status }, raw: out },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, debug: { url }, raw: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e?.name === "AbortError" ? "Timeout (AbortError)" : e?.message || "fetch failed",
        debug: { url, ...errorToDebug(e) },
      },
      { status: 500 }
    );
  }
}
