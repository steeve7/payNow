import type { PaymentRow } from "../types";

export const SERVICE_CHARGE = 100;

// ✅ Put in /public for best capture
export const PAYNOW_LOGO_SRC = "/image/paynowlogo.png";

// ✅ Wordmark as image so html2canvas never “misses” it
export const PAYNOW_WORDMARK_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="40">
    <text x="0" y="28"
      font-family="Arial, sans-serif"
      font-size="22"
      font-weight="800"
      fill="#3B82F6">PayNow</text>
  </svg>
`);

export const BILL_LABELS: Record<string, string> = {
  electricity: "Electricity",
  airtime: "Airtime",
  data: "Internet Data",
  cable: "Cable TV",
  showmax: "Showmax",
  education: "Education",
  "international-airtime": "International Airtime",
  intl_airtime: "International Airtime",
};

export const FILTERS = [
  { id: "all", label: "All Bills" },
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "cable", label: "Cable TV" },
  { id: "electricity", label: "Electricity" },
  { id: "showmax", label: "Showmax" },
  { id: "education", label: "Education" },
  { id: "international-airtime", label: "International Airtime" },
];

export function getBillTypeLabel(billType: string) {
  return BILL_LABELS[billType] || billType;
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function pickFirst(obj: any, keys: string[], fallback = "—") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

export function normalizeStatus(v?: string | null) {
  const s = String(v || "").toLowerCase();
  if (!s) return "—";
  if (s.includes("deliver")) return "delivered";
  if (s.includes("success")) return "success";
  if (s.includes("fail")) return "failed";
  if (s.includes("pending")) return "pending";
  return s;
}

export function pillClasses(status: string) {
  const s = normalizeStatus(status);
  if (s === "delivered" || s === "success")
    return "bg-green-100 text-green-700";
  if (s === "failed") return "bg-red-100 text-red-700";
  if (s === "pending") return "bg-gray-100 text-gray-700";
  return "bg-gray-100 text-gray-700";
}

export function moneyNaira(n: any) {
  const v = Number(n || 0);
  return `₦${v.toLocaleString()}`;
}

export function getVtpassRaw(t: PaymentRow) {
  const raw = t?.vend_response?.raw || {};
  const tx = raw?.content?.transactions || {};
  return { raw, tx };
}

export function getAccountDisplay(t: PaymentRow) {
  const p = t.payload || {};
  switch (t.bill_type) {
    case "data":
    case "airtime":
      return p.phone || p.msisdn || "—";
    case "electricity":
      return p.meterNumber || p.meter_number || p.account || "—";
    case "cable":
      return p.smartcardNumber || p.smartcard_number || p.iuc || p.account || "—";
    default:
      return p.account || p.phone || "—";
  }
}
