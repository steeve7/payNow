// receiptBuilder.ts
import type { PaymentRow } from "../types";
import {
  SERVICE_CHARGE,
  getBillTypeLabel,
  getVtpassRaw,
  moneyNaira,
  pickFirst,
  normalizeStatus,
  formatDate,
} from "./formatters";

/**
 * Receipt builder rules:
 * - NO Customer Email
 * - NO Vend Status
 * - Use payload phone/account for user's input
 * - Cable total = amount + 100
 * - Electricity total = vat + 100 + amount
 * - Education total = amount + 100
 * - Response Description shows ONLY for VTPass (NOT ClubKonnect)
 */
export function buildReceiptRows(t: PaymentRow) {
  const p = t.payload || {};
  const billType = t.bill_type;
  const { raw, tx } = getVtpassRaw(t);

  // -------------------------
  // Helpers (provider-aware)
  // -------------------------
  function getVendRaw(row: PaymentRow) {
    // stored shape: vend_response = { ok, raw, provider, reference }
    return (row as any)?.vend_response?.raw || (row as any)?.vend_response || null;
  }

  function getVendProvider(row: PaymentRow) {
    return String(
      (row as any)?.vend_provider || (row as any)?.vend_response?.provider || ""
    )
      .toLowerCase()
      .trim();
  }

  function isVtpass(row: PaymentRow) {
    return getVendProvider(row) === "vtpass";
  }

  function shouldShowResponseDescription(row: PaymentRow) {
    // only VTPass has response_description we care about
    return isVtpass(row);
  }

  function getProductName(row: PaymentRow) {
    const provider = getVendProvider(row);
    const vraw = getVendRaw(row);
    if (!vraw) return "—";

    if (provider === "clubkonnect") {
      return String(vraw?.productname || vraw?.product_name || "—");
    }

    // vtpass shape
    return String(
      vraw?.content?.transactions?.product_name || vraw?.product_name || "—"
    );
  }

  function getTransactionId(row: PaymentRow) {
    const provider = getVendProvider(row);
    const vraw = getVendRaw(row);
    if (!vraw) return "—";

    if (provider === "clubkonnect") {
      // CK uses orderid
      return String(vraw?.orderid || vraw?.orderId || "—");
    }

    //  VTPass uses transactionId (sometimes delayed)
    return String(
      vraw?.content?.transactions?.transactionId ||
        vraw?.transactionId ||
        vraw?.exchangeReference ||
        "—"
    );
  }

  // -------------------------
  // Common fields
  // -------------------------
  const type = String(tx?.type || getBillTypeLabel(billType));
  const vtStatus = String(tx?.status || "");
  const status = normalizeStatus(vtStatus || t.status);

  const reference = String(
    raw?.reference || raw?.requestId || t.reference || "—"
  );

  const transactionDate = raw?.transaction_date || t.created_at;

  // VTPass only (guarded later)
  const responseDescription = String(raw?.response_description || "—");

  // Always provider-aware (ClubKonnect vs VTPass)
  const productName = getProductName(t);
  const transactionId = getTransactionId(t);

  const payloadPhone = String(pickFirst(p, ["phone", "msisdn"], "—"));

  const rows: Array<{
    label: string;
    value: string;
    mono?: boolean;
    pill?: boolean;
  }> = [];

  // -------------------------
  // Airtime
  // -------------------------
  if (billType === "airtime") {
    rows.push({ label: "Type", value: type });
    rows.push({ label: "Mobile Number", value: payloadPhone, mono: true });
    rows.push({ label: "Status", value: status, pill: true });
    rows.push({ label: "Amount", value: moneyNaira(t.amount) });
    rows.push({ label: "Product Name", value: productName });
    rows.push({ label: "Transaction ID", value: transactionId, mono: true });
    rows.push({ label: "Reference", value: reference, mono: true });
    rows.push({ label: "Transaction Date", value: formatDate(transactionDate) });

    // ONLY VTPass
    if (shouldShowResponseDescription(t)) {
      rows.push({ label: "Response Description", value: responseDescription });
    }

    return rows;
  }

  // -------------------------
  // Data
  // -------------------------
  if (billType === "data") {
    const dataPlan = String(pickFirst(p, ["plan_name", "planName", "name"], "—"));
    const validity = String(pickFirst(p, ["validity"], "—"));

    rows.push({ label: "Type", value: type });
    rows.push({ label: "Mobile No", value: payloadPhone, mono: true });
    rows.push({ label: "Status", value: status, pill: true });
    rows.push({ label: "Product Name", value: productName });
    rows.push({ label: "Data Plan", value: dataPlan });
    rows.push({ label: "Validity", value: validity });
    rows.push({ label: "Transaction ID", value: transactionId, mono: true });
    rows.push({ label: "Reference", value: reference, mono: true });
    rows.push({ label: "Amount", value: moneyNaira(t.amount) });
    rows.push({ label: "Transaction Date", value: formatDate(transactionDate) });

    // ONLY VTPass
    if (shouldShowResponseDescription(t)) {
      rows.push({ label: "Response Description", value: responseDescription });
    }

    return rows;
  }

  // -------------------------
  // Cable
  // -------------------------
  if (billType === "cable") {
    const customerName = String(
      pickFirst(
        p,
        ["customerName", "customer_name", "verifiedCustomerName", "name"],
        "—"
      )
    );

    const smartcardOrIuc = String(
      pickFirst(
        p,
        ["smartcardNumber", "smartcard_number", "iuc", "account", "billersCode"],
        "—"
      )
    );

    const bouquet = String(
      pickFirst(
        p,
        ["bouquet", "bouquet_name", "package", "plan_name", "variation_name"],
        "—"
      )
    );

    const totalAmount = Number(t.amount || 0) + SERVICE_CHARGE;

    rows.push({ label: "Type", value: type });
    rows.push({ label: "Customer Name", value: customerName });
    rows.push({ label: "Mobile Number", value: payloadPhone, mono: true });
    rows.push({ label: "Status", value: status, pill: true });
    rows.push({ label: "Smartcard/IUC", value: smartcardOrIuc, mono: true });
    rows.push({ label: "Bouquet", value: bouquet });
    rows.push({ label: "Product Name", value: productName });
    rows.push({ label: "Transaction ID", value: transactionId, mono: true });
    rows.push({ label: "Reference", value: reference, mono: true });
    rows.push({ label: "Amount", value: moneyNaira(t.amount) });
    rows.push({ label: "Service Charge", value: moneyNaira(SERVICE_CHARGE) });
    rows.push({ label: "Total Amount", value: moneyNaira(totalAmount) });
    rows.push({ label: "Transaction Date", value: formatDate(transactionDate) });

    // ONLY VTPass
    if (shouldShowResponseDescription(t)) {
      rows.push({ label: "Response Description", value: responseDescription });
    }

    return rows;
  }

  // -------------------------
  // Electricity
  // -------------------------
  if (billType === "electricity") {
    const customerName = String(
      pickFirst(p, ["customerName", "customer_name"], raw?.customerName || "—")
    );

    const customerAddress = String(
      pickFirst(
        p,
        ["customerAddress", "customer_address"],
        raw?.customerAddress || "—"
      )
    );

    const meterNumber = String(
      pickFirst(
        p,
        ["meterNumber", "meter_number"],
        raw?.meterNumber || tx?.unique_element || "—"
      )
    );

    const meterType = String(pickFirst(p, ["meterType", "meter_type"], "—"));

    const units = String(raw?.units || p?.units || "—");
    const vat = Number(raw?.vat ?? raw?.taxAmount ?? p?.vat ?? 0);
    const token = String(raw?.token || p?.token || "—");

    const totalAmount =
      Number(t.amount || 0) + SERVICE_CHARGE + Number(vat || 0);

    rows.push({ label: "Type", value: type });
    rows.push({ label: "Customer Name", value: customerName });
    rows.push({ label: "Customer Address", value: customerAddress });
    rows.push({ label: "Mobile Phone", value: payloadPhone, mono: true });
    rows.push({ label: "Meter Number", value: meterNumber, mono: true });
    rows.push({ label: "Meter Type", value: meterType });
    rows.push({ label: "Provider", value: productName });
    rows.push({ label: "Units", value: units });
    rows.push({ label: "Vat", value: String(vat || "—") });
    rows.push({ label: "Token", value: token, mono: true });
    rows.push({ label: "Status", value: status, pill: true });
    rows.push({ label: "Transaction ID", value: transactionId, mono: true });
    rows.push({ label: "Reference", value: reference, mono: true });
    rows.push({ label: "Service Charge", value: moneyNaira(SERVICE_CHARGE) });
    rows.push({ label: "Amount", value: moneyNaira(t.amount) });
    rows.push({ label: "Total Amount", value: moneyNaira(totalAmount) });
    rows.push({ label: "Transaction Date", value: formatDate(transactionDate) });

    // ONLY VTPass
    if (shouldShowResponseDescription(t)) {
      rows.push({ label: "Response Description", value: responseDescription });
    }

    return rows;
  }

  // -------------------------
  // Education
  // -------------------------
  if (billType === "education") {
    const totalAmount = Number(t.amount || 0) + SERVICE_CHARGE;

    rows.push({ label: "Type", value: getBillTypeLabel(billType) });
    rows.push({ label: "Mobile Number", value: payloadPhone, mono: true });
    rows.push({ label: "Status", value: normalizeStatus(t.status), pill: true });
    rows.push({ label: "Transaction ID", value: transactionId, mono: true });
    rows.push({ label: "Reference", value: String(t.reference || "—"), mono: true });
    rows.push({ label: "Amount", value: moneyNaira(t.amount) });
    rows.push({ label: "Service Charge", value: moneyNaira(SERVICE_CHARGE) });
    rows.push({ label: "Total Amount", value: moneyNaira(totalAmount) });
    rows.push({ label: "Transaction Date", value: formatDate(t.created_at) });

    // ONLY VTPass (education may be vtpass; if later CK supports it, still safe)
    if (shouldShowResponseDescription(t)) {
      rows.push({ label: "Response Description", value: responseDescription });
    }

    return rows;
  }

  // -------------------------
  // Fallback
  // -------------------------
  rows.push({ label: "Type", value: getBillTypeLabel(billType) });
  rows.push({ label: "Reference", value: String(t.reference || "—"), mono: true });
  rows.push({ label: "Transaction Date", value: formatDate(t.created_at) });
  rows.push({ label: "Status", value: normalizeStatus(t.status), pill: true });

  // ONLY VTPass
  if (shouldShowResponseDescription(t)) {
    rows.push({ label: "Response Description", value: responseDescription });
  }

  return rows;
}
