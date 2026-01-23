// src/lib/vendors/vendEducation.ts
import { vendVTPassEducation } from "./vtpassEducation";
import { vendClubKonnectEducation } from "./clubkonnectEducation";

export type VendEducationInput = {
  billType: "education";
  serviceID: string;
  variation_code: string;
  phone: string;
  amount?: number;
  quantity?: number;
  contact?: string;
};

export type VendResult = {
  provider: "vtpass" | "clubkonnect";
  ok: boolean;
  reference?: string;
  raw: any;
  pinDetails?: { pins: string[]; purchased_code?: string };
};

function getEnvSupportedServiceIDs(): string[] {
  const raw = process.env.VTPASS_EDUCATION_SUPPORTED_SERVICE_IDS || "";
  return raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export async function vendEducation(
  input: VendEducationInput,
  vtpassSupportedServiceIDs?: string[]
): Promise<VendResult> {
  const supported =
    (vtpassSupportedServiceIDs?.length ? vtpassSupportedServiceIDs : getEnvSupportedServiceIDs())
      .map((x) => x.toLowerCase());

  const isSupportedByVTPass = supported.includes(String(input.serviceID).toLowerCase());

  if (isSupportedByVTPass) {
    try {
      const res = await vendVTPassEducation(input);
      return {
        provider: "vtpass",
        ok: true,
        reference: res.reference,
        raw: res,
        pinDetails: res.pinDetails,
      };
    } catch (e: any) {
      console.warn("[vendEducation] VTPass failed, fallback:", e?.message);
    }
  } else {
    console.warn(
      `[vendEducation] Skipping VTPass: serviceID "${input.serviceID}" not supported; using ClubKonnect`
    );
  }

  const res2 = await vendClubKonnectEducation(input);
  return {
    provider: "clubkonnect",
    ok: true,
    reference: res2.reference,
    raw: res2,
    pinDetails: res2.pinDetails,
  };
}
