import { normalizeStatus } from "../utilis/formatters";
export { PAYNOW_LOGO_SRC, PAYNOW_WORDMARK_SRC } from "../utilis/formatters";

export function pillClasses(status: string) {
  const s = normalizeStatus(status);
  if (s === "delivered" || s === "success") return "bg-green-100 text-green-700";
  if (s === "failed") return "bg-red-100 text-red-700";
  if (s === "pending") return "bg-gray-100 text-gray-700";
  return "bg-gray-100 text-gray-700";
}
