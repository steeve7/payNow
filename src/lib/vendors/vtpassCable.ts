export type CableInput = {
  provider: "dstv" | "gotv" | "startimes";
  smartcardNumber: string; // billersCode
  bouquet: string; // variation_code
  phone: string; // required by VTPass pay
  amount?: number; // optional (VTPass can use bouquet price if omitted)
};

function vtpassBaseUrl() {
  const env = (process.env.VTPASS_ENV || "production").toLowerCase();
  return env === "production"
    ? "https://vtpass.com/api"
    : "https://sandbox.vtpass.com/api";
}

// request_id must start numeric (VTPass guidance)
function makeVtpassRequestId(prefix = "CABLE") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const yyyymmddhhmm = `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
  const rand = Math.random().toString(16).slice(2);
  return `${yyyymmddhhmm}${prefix}${rand}`;
}

export async function vendVTPassCable(input: CableInput) {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error("Missing VTPASS_API_KEY or VTPASS_SECRET_KEY in .env");
  }

  const request_id = makeVtpassRequestId("CABLE");
  const url = `${vtpassBaseUrl()}/pay`;

  const body: any = {
    request_id,
    serviceID: input.provider,
    billersCode: input.smartcardNumber,
    variation_code: input.bouquet,
    phone: input.phone,
  };

  // amount is OPTIONAL on VTPass TV subscription pay
  if (typeof input.amount === "number" && input.amount > 0) {
    body.amount = input.amount;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      "secret-key": secretKey,
    },
    body: JSON.stringify(body),
  });

  const outText = await res.text();
  let out: any = null;
  try {
    out = JSON.parse(outText);
  } catch {
    // keep raw
  }

  if (!res.ok) {
    throw new Error(out?.response_description || out?.message || `VTPass error. Raw: ${outText}`);
  }

  const looksSuccess =
    out?.code === "000" ||
    String(out?.response_description || "").toLowerCase().includes("successful") ||
    String(out?.content?.transactions?.status || "").toLowerCase().includes("delivered");

  if (!looksSuccess) {
    throw new Error(out?.response_description || out?.message || "VTPass cable vending failed");
  }

  return { reference: request_id, provider: "vtpass", ...out };
}
