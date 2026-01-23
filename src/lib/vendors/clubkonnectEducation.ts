type EducationInput = {
  serviceID: string;
  variation_code: string;
  phone: string;
  amount?: number;
  quantity?: number;
  contact?: string;
};

function extractPins(out: any): { pins: string[]; purchased_code?: string } {
  const pins: string[] = [];
  const purchased_code = out?.purchased_code || out?.content?.purchased_code;

  const tokens = out?.tokens || out?.content?.tokens;
  if (Array.isArray(tokens)) {
    tokens.forEach((t: any) => {
      const s = String(t || "").trim();
      if (s) pins.push(s);
    });
  }

  const cards = out?.cards || out?.content?.cards;
  if (Array.isArray(cards)) {
    cards.forEach((c: any) => {
      const p = String(c?.Pin || c?.pin || c?.PIN || "").trim();
      if (p) pins.push(p);
    });
  }

  if (purchased_code && pins.length === 0) {
    const s = String(purchased_code).trim();
    if (s) pins.push(s);
  }

  return { pins: Array.from(new Set(pins)), purchased_code: purchased_code ? String(purchased_code) : undefined };
}

export async function vendClubKonnectEducation(input: EducationInput) {
  const baseUrl = process.env.CLUBKONNECT_BASE_URL;
  const apiKey = process.env.CLUBKONNECT_API_KEY;
  const endpoint = process.env.CLUBKONNECT_EDUCATION_ENDPOINT || "/education/purchase";

  if (!baseUrl || !apiKey) throw new Error("Missing CLUBKONNECT_BASE_URL or CLUBKONNECT_API_KEY in .env");

  const reference = `ck_edu_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const body: any = {
    request_id: reference,
    serviceID: input.serviceID,
    variation_code: input.variation_code,
    phone: input.phone,
  };
  if (typeof input.amount === "number") body.amount = input.amount;
  if (typeof input.quantity === "number") body.quantity = input.quantity;
  if (input.contact) body.contact = input.contact;

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  const out = await res.json().catch(() => null);

  if (!res.ok) throw new Error(out?.message || out?.error || "ClubKonnect education error");

  const looksSuccess =
    out?.status === "success" ||
    out?.code === "00" ||
    String(out?.message || "").toLowerCase().includes("success");

  if (!looksSuccess) throw new Error(out?.message || "ClubKonnect education vending failed");

  const pinDetails = extractPins(out);

  return { reference, provider: "clubkonnect", pinDetails, ...out };
}
