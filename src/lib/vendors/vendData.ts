// src/lib/vendors/vendData.ts
import { vendVTPassData } from "./vtpassData";
import { vendClubKonnectData } from "./clubkonnectData";

export type VendInput = {
  billType: "data";
  phone: string;
  network: "mtn" | "airtel" | "glo" | "9mobile";
  serviceID?: string;       // ✅ ADD THIS
  plan_code: string;       // variation_code / plan_code
  plan_name?: string;
  validity?: string;
  customer_email?: string;
  product_name?: string;
  amount: number;
};

export type VendResult = {
  provider: "vtpass" | "clubkonnect";
  ok: boolean;
  reference?: string;
  raw: any;
};

export async function vendData(input: VendInput): Promise<VendResult> {
  // 1) Try VTPass first
  try {
    const res = await vendVTPassData(input);
    return { provider: "vtpass", ok: true, reference: res.reference, raw: res };
  } catch (e: any) {
    const vtErr = e?.message || "VTPass vend failed";
    console.warn("[vendData] VTPass failed, falling back:", vtErr);
  }

  // 2) Fallback: ClubKonnect
  const res2 = await vendClubKonnectData(input);
  return {
    provider: "clubkonnect",
    ok: true,
    reference: res2.reference,
    raw: res2,
  };
}
