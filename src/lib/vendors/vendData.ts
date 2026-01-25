// src/lib/vendors/vendData.ts
import { vendVTPassData } from "./vtpassData";
import { vendClubKonnectData } from "./clubkonnectData";

export type VendInput = {
  billType: "data";
  phone: string;
  network: "mtn" | "airtel" | "glo" | "9mobile";

  // VTPass
  serviceID?: string;
  plan_code: string;

  // ClubKonnect fallback uses this
  ck_plan_code?: string;

  plan_name?: string;
  validity?: string;
  amount: number;

  // optional forcing (same pattern as airtime)
  provider?: "vtpass" | "clubkonnect";
};

export type VendResult = {
  provider: "vtpass" | "clubkonnect";
  ok: boolean;
  reference?: string;
  raw: any;
};

export async function vendData(input: VendInput): Promise<VendResult> {
  const forced = input.provider || (process.env.FORCE_VENDOR_DATA as any);

  // Force CK (for testing only)
  if (forced === "clubkonnect") {
    const ck = await vendClubKonnectData(input);
    return { provider: "clubkonnect", ok: true, reference: ck.reference, raw: ck.raw };
  }

  //  Default: VTPass first
  try {
    const vt = await vendVTPassData(input);
    return { provider: "vtpass", ok: true, reference: vt.reference, raw: vt };
  } catch (e: any) {
    console.warn("[vendData] VTPass failed, falling back:", e?.message || e);
  }

  //  Fallback: ClubKonnect
  const ck = await vendClubKonnectData(input);
  return { provider: "clubkonnect", ok: true, reference: ck.reference, raw: ck.raw };
}
