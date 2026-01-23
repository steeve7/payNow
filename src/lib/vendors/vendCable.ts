import { vendVTPassCable, type CableInput } from "./vtpassCable";
import { vendClubKonnectCable } from "./clubkonnectCable";

export type VendCableResult = {
  provider: "vtpass" | "clubkonnect";
  ok: boolean;
  reference?: string;
  raw: any;
};

export async function vendCable(input: CableInput): Promise<VendCableResult> {
  try {
    const res = await vendVTPassCable(input);
    return { provider: "vtpass", ok: true, reference: res.reference, raw: res };
  } catch (e: any) {
    console.warn("[vendCable] VTPass failed, falling back:", e?.message);
  }

  const res2 = await vendClubKonnectCable(input);
  return { provider: "clubkonnect", ok: true, reference: res2.reference, raw: res2 };
}
