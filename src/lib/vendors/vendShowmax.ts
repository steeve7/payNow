// src/lib/vendors/vendShowmax.ts
import { vendVTPassShowmax } from "./vtpassShowmax";
import { vendClubKonnectShowmax } from "./clubkonnectShowmax";

export type VendShowmaxInput = {
  billType: "showmax";
  serviceID: "showmax";
  variation_code: string;
  billersCode: string; // phone number (showmax)
  amount?: number;
  contact?: string;
};

export type VendResult = {
  provider: "vtpass" | "clubkonnect";
  ok: boolean;
  reference?: string;
  raw: any;

  // showmax voucher/purchased_code
  voucherDetails?: { vouchers: string[]; purchased_code?: string };
};

export async function vendShowmax(input: VendShowmaxInput): Promise<VendResult> {
  // 1) VTPass first
  try {
    const res = await vendVTPassShowmax(input);
    return {
      provider: "vtpass",
      ok: true,
      reference: res.reference,
      raw: res,
      voucherDetails: res.voucherDetails,
    };
  } catch (e: any) {
    console.warn("[vendShowmax] VTPass failed, fallback:", e?.message);
  }

  // 2) fallback
  const res2 = await vendClubKonnectShowmax(input);
  return {
    provider: "clubkonnect",
    ok: true,
    reference: res2.reference,
    raw: res2,
    voucherDetails: res2.voucherDetails,
  };
}
