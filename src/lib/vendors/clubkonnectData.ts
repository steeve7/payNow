// src/lib/vendors/clubkonnectData.ts
import type { VendInput } from "./vendData";

export async function vendClubKonnectData(input: VendInput) {
  const baseUrl = process.env.CLUBKONNECT_BASE_URL;
  const apiKey = process.env.CLUBKONNECT_API_KEY;
  const endpoint = process.env.CLUBKONNECT_DATA_ENDPOINT || "/data/purchase";

  if (!baseUrl || !apiKey) {
    throw new Error("Missing CLUBKONNECT_BASE_URL or CLUBKONNECT_API_KEY in .env");
  }

  const reference = `ck_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  //  You MUST match their exact required body fields.
  // This is a template structure — update field names to match your ClubKonnect docs/dashboard.
  const body = {
    request_id: reference,
    phone: input.phone,
    network: input.network,
    plan_code: input.plan_code,
    amount: input.amount,
  };

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const out = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(out?.message || out?.error || "ClubKonnect error");
  }

  // You can tighten this once you see their real response shape
  const looksSuccess =
    out?.status === "success" ||
    out?.code === "00" ||
    String(out?.message || "").toLowerCase().includes("success");

  if (!looksSuccess) {
    throw new Error(out?.message || "ClubKonnect vending failed");
  }

  return {
    reference,
    provider: "clubkonnect",
    ...out,
  };
}
