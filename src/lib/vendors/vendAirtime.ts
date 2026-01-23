// src/lib/vendors/vendAirtime.ts
import { vendVTPassAirtime } from "./vtpassAirtime";
import { vendClubKonnectAirtime } from "./clubkonnectAirtime";

export type VendAirtimeInput = {
  billType: "airtime";
  phone: string;
  network: "mtn" | "airtel" | "glo" | "9mobile";
  amount: number;
};

export type VendResult = {
  provider: "vtpass" | "clubkonnect";
  ok: boolean;
  reference?: string;
  raw: any;
};

export async function vendAirtime(input: VendAirtimeInput): Promise<VendResult> {
  try {
    const res = await vendVTPassAirtime(input);
    return { provider: "vtpass", ok: true, reference: res.reference, raw: res };
  } catch (e: any) {
    console.warn("[vendAirtime] VTPass failed, falling back:", e?.message);
  }

  const res2 = await vendClubKonnectAirtime(input);
  return { provider: "clubkonnect", ok: true, reference: res2.reference, raw: res2 };
}
