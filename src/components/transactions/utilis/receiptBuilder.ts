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
 * ✅ Receipt builder rules:
 * - NO Customer Email
 * - NO Vend Status
 * - Use payload phone/account for user's input
 * - Cable total = amount + 100
 * - Electricity total = vat + 100 + amount
 * - Education total = amount + 100
 */
export function buildReceiptRows(t: PaymentRow) {
  const p = t.payload || {};
  const billType = t.bill_type;
  const { raw, tx } = getVtpassRaw(t);

  const type = String(tx?.type || getBillTypeLabel(billType));
  const vtStatus = String(tx?.status || "");
  const status = normalizeStatus(vtStatus || t.status);

  const transactionId = String(tx?.transactionId || raw?.exchangeReference || "—");
  const reference = String(raw?.reference || raw?.requestId || t.reference || "—");
  const transactionDate = raw?.transaction_date || t.created_at;
  const responseDescription = String(raw?.response_description || "—");
  const productName = String(tx?.product_name || p?.product_name || "—");

  const payloadPhone = String(pickFirst(p, ["phone", "msisdn"], "—"));

  const rows: Array<{ label: string; value: string; mono?: boolean; pill?: boolean }> = [];

  // Airtime
  if (billType === "airtime") {
    rows.push({ label: "Type", value: type });
    rows.push({ label: "Mobile Number", value: payloadPhone, mono: true });
    rows.push({ label: "Status", value: status, pill: true });
    rows.push({ label: "Amount", value: moneyNaira(t.amount) });
    rows.push({ label: "Product Name", value: productName });
    rows.push({ label: "Transaction ID", value: transactionId, mono: true });
    rows.push({ label: "Reference", value: reference, mono: true });
    rows.push({ label: "Transaction Date", value: formatDate(transactionDate) });
    rows.push({ label: "Response Description", value: responseDescription });
    return rows;
  }

  // Data
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
    rows.push({ label: "Response Description", value: responseDescription });
    return rows;
  }

  // Cable
  if (billType === "cable") {
    const customerName = String(
      pickFirst(p, ["customerName", "customer_name", "verifiedCustomerName", "name"], "—")
    );

    const smartcardOrIuc = String(
      pickFirst(p, ["smartcardNumber", "smartcard_number", "iuc", "account", "billersCode"], "—")
    );

    const bouquet = String(
      pickFirst(p, ["bouquet", "bouquet_name", "package", "plan_name", "variation_name"], "—")
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
    rows.push({ label: "Response Description", value: responseDescription });
    return rows;
  }

  // Electricity
  if (billType === "electricity") {
    const customerName = String(pickFirst(p, ["customerName", "customer_name"], raw?.customerName || "—"));
    const customerAddress = String(
      pickFirst(p, ["customerAddress", "customer_address"], raw?.customerAddress || "—")
    );

    const meterNumber = String(
      pickFirst(p, ["meterNumber", "meter_number"], raw?.meterNumber || tx?.unique_element || "—")
    );

    const meterType = String(pickFirst(p, ["meterType", "meter_type"], "—"));

    const units = String(raw?.units || p?.units || "—");
    const vat = Number(raw?.vat ?? raw?.taxAmount ?? p?.vat ?? 0);
    const token = String(raw?.token || p?.token || "—");

    const totalAmount = Number(t.amount || 0) + SERVICE_CHARGE + Number(vat || 0);

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
    rows.push({ label: "Response Description", value: responseDescription });
    return rows;
  }

  // Education
  if (billType === "education") {
    const totalAmount = Number(t.amount || 0) + SERVICE_CHARGE;

    rows.push({ label: "Type", value: getBillTypeLabel(billType) });
    rows.push({ label: "Mobile Number", value: payloadPhone, mono: true });
    rows.push({ label: "Status", value: normalizeStatus(t.status), pill: true });
    rows.push({
      label: "Transaction ID",
      value: String(pickFirst(p, ["transactionId", "transaction_id"], "—")),
      mono: true,
    });
    rows.push({ label: "Reference", value: String(t.reference || "—"), mono: true });
    rows.push({ label: "Amount", value: moneyNaira(t.amount) });
    rows.push({ label: "Service Charge", value: moneyNaira(SERVICE_CHARGE) });
    rows.push({ label: "Total Amount", value: moneyNaira(totalAmount) });
    rows.push({ label: "Transaction Date", value: formatDate(t.created_at) });
    rows.push({
      label: "Response Description",
      value: String(pickFirst(p, ["response_description", "message"], "—")),
    });
    return rows;
  }

  // Fallback
  rows.push({ label: "Type", value: getBillTypeLabel(billType) });
  rows.push({ label: "Reference", value: String(t.reference || "—"), mono: true });
  rows.push({ label: "Transaction Date", value: formatDate(t.created_at) });
  rows.push({ label: "Status", value: normalizeStatus(t.status), pill: true });
  return rows;
}
