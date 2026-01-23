type ElectricityInput = {
  serviceID: string;
  meterType: "prepaid" | "postpaid";
  meterNumber: string;
  phone: string;
  amount: number;
};

export async function vendClubKonnectElectricity(input: ElectricityInput) {
  const baseUrl = process.env.CLUBKONNECT_BASE_URL;
  const apiKey = process.env.CLUBKONNECT_API_KEY;
  const endpoint =
    process.env.CLUBKONNECT_ELECTRICITY_ENDPOINT || "/electricity/purchase";

  if (!baseUrl || !apiKey) {
    throw new Error("Missing CLUBKONNECT_BASE_URL or CLUBKONNECT_API_KEY in .env");
  }

  const reference = `ck_elec_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const body = {
    request_id: reference,
    serviceID: input.serviceID,
    meterType: input.meterType,
    meterNumber: input.meterNumber,
    phone: input.phone,
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

  if (!res.ok) throw new Error(out?.message || out?.error || "ClubKonnect electricity error");

  const looksSuccess =
    out?.status === "success" ||
    out?.code === "00" ||
    String(out?.message || "").toLowerCase().includes("success");

  if (!looksSuccess) throw new Error(out?.message || "ClubKonnect electricity vending failed");

  return { reference, provider: "clubkonnect", ...out };
}
