// src/lib/vendors/vendElectricity.ts
import { vendVTPassElectricity } from "./vtpassElectricity";
import { vendClubKonnectElectricity } from "./clubkonnectElectricity";

export type VendElectricityInput = {
  billType: "electricity";
  serviceID: string;
  meterType: "prepaid" | "postpaid";
  meterNumber: string;
  phone: string;
  amount: number;
};

export type VendResult = {
  provider: "vtpass" | "clubkonnect";
  ok: boolean;
  reference?: string;
  raw: any; // will include tokenDetails if VTPass returns it
};

export async function vendElectricity(input: VendElectricityInput): Promise<VendResult> {
  try {
    const res = await vendVTPassElectricity(input);
    return {
      provider: "vtpass",
      ok: true,
      reference: res.reference,
      raw: res, //  includes tokenDetails when present
    };
  } catch (e: any) {
    console.warn("[vendElectricity] VTPass failed, falling back:", e?.message);
  }

  const res2 = await vendClubKonnectElectricity(input);
  return {
    provider: "clubkonnect",
    ok: true,
    reference: res2.reference,
    raw: res2, // may or may not include token depending on ClubKonnect response
  };
}
