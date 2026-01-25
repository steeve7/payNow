import type { CableInput } from "./vtpassCable";

export async function vendClubKonnectCable(input: CableInput) {
  const baseUrl = process.env.CLUBKONNECT_BASE_URL;
  const apiKey = process.env.CLUBKONNECT_API_KEY;
  const endpoint =
    process.env.CLUBKONNECT_CABLE_ENDPOINT || "/tv/purchase";

  if (!baseUrl || !apiKey) {
    throw new Error("Missing CLUBKONNECT_BASE_URL or CLUBKONNECT_API_KEY in .env");
  }

  const reference = `ck_cable_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  // ClubKonnect fields vary by account/product.
  // Keep this consistent with your airtime style and adjust endpoint/keys if your CK docs differ.
  const body = {
    request_id: reference,
    provider: input.provider, // dstv/gotv/startimes (adjust mapping if CK uses different ids)
    smartcard: input.smartcardNumber,
    bouquet: input.bouquet,
    phone: input.phone,
    amount: input.amount ?? undefined,
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
    throw new Error(out?.message || out?.error || "ClubKonnect cable error");
  }

  const looksSuccess =
    out?.status === "success" ||
    out?.code === "00" ||
    String(out?.message || "").toLowerCase().includes("success");

  if (!looksSuccess) {
    throw new Error(out?.message || "ClubKonnect cable vending failed");
  }

  return { reference, provider: "clubkonnect", ...out };
}
