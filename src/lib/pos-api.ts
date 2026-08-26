import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { api } from "@/lib/api";
import type { PrintFormat, PrintType } from "@/lib/admin-api";

/**
 * Point of Sale APIs — shifts, devices, Stripe Terminal readers, counter sales
 * and receipt printing. Response envelope matches the rest of the API:
 * { success, status, message, payload }.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const unwrap = (data: Json): Json => data?.payload ?? data?.data ?? data ?? {};
const msg = (data: Json, fallback: string): string =>
  (data?.message as string) ?? fallback;

export interface PosListParams {
  page: number;
  limit: number;
  dateRange?: DateRange;
  filters?: Json;
}

export interface PosListResult<T> {
  rows: T[];
  total: number;
  totalPages: number;
}

function buildBody({ page, limit, dateRange, filters }: PosListParams): Json {
  const body: Json = { page, limit };
  if (dateRange?.from) body.startDate = format(dateRange.from, "yyyy-MM-dd");
  if (dateRange?.to) body.endDate = format(dateRange.to, "yyyy-MM-dd");
  const clean = Object.fromEntries(
    Object.entries(filters ?? {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );
  if (Object.keys(clean).length) body.filters = clean;
  return body;
}

function parseList<T>(data: Json, limit: number): PosListResult<T> {
  const p = unwrap(data);
  const rows: T[] = Array.isArray(p)
    ? p
    : p.rows ?? p.items ?? p.list ?? p.shifts ?? p.devices ?? p.readers ?? p.locations ?? p.data ?? [];
  const pg: Json = data?.pagination ?? p.pagination ?? {};
  const total: number = pg.total ?? p.total ?? p.count ?? rows.length;
  const totalPages: number = pg.totalPages ?? p.totalPages ?? Math.max(1, Math.ceil(total / limit));
  return { rows, total, totalPages };
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

export const SHIFT_STATUSES = ["open", "paused", "closed", "ended"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export interface ShiftRow {
  id: number | string;
  shift_code?: string;
  branch_id?: number | null;
  branch?: { name?: string } | null;
  pos_device_id?: number | null;
  posDevice?: { name?: string; device_code?: string } | null;
  user_id?: number | null;
  user?: { full_name?: string; name?: string; email?: string } | null;
  status?: ShiftStatus;
  opening_float?: string | number;
  counted_cash?: string | number | null;
  expected_cash?: string | number | null;
  cash_difference?: string | number | null;
  total_sales?: string | number | null;
  total_orders?: number | null;
  cash_sales?: string | number | null;
  card_sales?: string | number | null;
  opening_notes?: string | null;
  closing_notes?: string | null;
  opened_at?: string;
  closed_at?: string | null;
  created_at?: string;
  [k: string]: unknown;
}

export async function openShift(body: {
  opening_float?: number;
  pos_device_id?: number | string;
  opening_notes?: string;
}): Promise<ShiftRow> {
  const { data } = await api.post("pos-shifts/open", body);
  return unwrap(data) as ShiftRow;
}

/** The cashier's own open or paused shift, or null when none is running. */
export async function getCurrentShift(): Promise<ShiftRow | null> {
  try {
    const { data } = await api.get("pos-shifts/current");
    const p = unwrap(data);
    const shift = (p?.shift ?? p) as ShiftRow;
    return shift && shift.id != null ? shift : null;
  } catch {
    // 404 simply means no shift is open right now.
    return null;
  }
}

export async function listShifts(params: PosListParams): Promise<PosListResult<ShiftRow>> {
  const { data } = await api.post("pos-shifts/list", buildBody(params));
  return parseList<ShiftRow>(data, params.limit);
}

export async function getShiftById(id: number | string): Promise<ShiftRow> {
  const { data } = await api.get(`pos-shifts/get/${id}`);
  return unwrap(data) as ShiftRow;
}

export async function closeShift(
  id: number | string,
  body: { counted_cash: number; closing_notes?: string }
): Promise<ShiftRow> {
  const { data } = await api.put(`pos-shifts/${id}/close`, body);
  return unwrap(data) as ShiftRow;
}

/** "paused" pauses the shift, "open" resumes it. */
export async function setShiftStatus(
  id: number | string,
  status: "open" | "paused"
): Promise<string> {
  const { data } = await api.put(`pos-shifts/${id}/status`, { status });
  return msg(data, status === "paused" ? "Shift paused." : "Shift resumed.");
}

export async function printShiftReceipt(
  id: number | string,
  printType: PrintType = "thermal_80mm"
): Promise<Json> {
  const { data } = await api.post(`pos-shifts/${id}/print-receipt`, {
    print_type: printType,
  });
  return data as Json;
}

/** Z-report through the print service — supports PDF as well as HTML. */
export async function printShiftReport(
  id: number | string,
  body: { print_type?: PrintType; format?: PrintFormat; raw?: boolean } = {}
): Promise<Blob | Json> {
  const isRaw = body.raw ?? body.format === "pdf";
  const { data } = await api.post(`print/shift/${id}`, body, {
    responseType: isRaw ? "blob" : "json",
  });
  return data;
}

// ─── Devices ──────────────────────────────────────────────────────────────────

export const DEVICE_TYPES = ["tablet", "desktop", "mobile", "kiosk"] as const;
export const RECEIPT_TYPES = ["thermal_80mm", "thermal_58mm", "a4"] as const;

export interface PosDeviceRow {
  id: number | string;
  branch_id?: number | null;
  branch?: { name?: string } | null;
  name: string;
  device_code: string;
  device_type?: string;
  ip_address?: string | null;
  mac_address?: string | null;
  location?: string | null;
  receipt_type?: string;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export type PosDeviceInput = Omit<PosDeviceRow, "id" | "branch" | "created_at">;

export async function listPosDevices(
  params: PosListParams
): Promise<PosListResult<PosDeviceRow>> {
  const { data } = await api.post("pos-device/list", buildBody(params));
  return parseList<PosDeviceRow>(data, params.limit);
}

export async function getPosDevice(id: number | string): Promise<PosDeviceRow> {
  const { data } = await api.get(`pos-device/get/${id}`);
  return unwrap(data) as PosDeviceRow;
}

/** Devices belonging to the signed-in user's branch — used by the register. */
export async function getMyBranchDevices(): Promise<PosDeviceRow[]> {
  const { data } = await api.get("pos-device/my-branch");
  const p = unwrap(data);
  return (Array.isArray(p) ? p : p.rows ?? p.devices ?? p.data ?? []) as PosDeviceRow[];
}

export async function createPosDevice(body: Partial<PosDeviceInput>): Promise<string> {
  const { data } = await api.post("pos-device", body);
  return msg(data, "Device created.");
}

export async function updatePosDevice(
  id: number | string,
  body: Partial<PosDeviceInput>
): Promise<string> {
  const { data } = await api.put(`pos-device/${id}`, body);
  return msg(data, "Device updated.");
}

// ─── Stripe Terminal ──────────────────────────────────────────────────────────

export interface TerminalLocationRow {
  id: number | string;
  display_name: string;
  branch_id?: number | null;
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state?: string | null;
  postal_code?: string;
  country?: string;
  stripe_location_id?: string | null;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export interface TerminalReaderRow {
  id: number | string;
  label: string;
  device_type?: string;
  status?: string;
  location_id?: number | null;
  branch_id?: number | null;
  branch?: { name?: string } | null;
  serial_number?: string | null;
  stripe_reader_id?: string | null;
  is_active?: boolean;
  last_seen_at?: string | null;
  created_at?: string;
  [k: string]: unknown;
}

export async function createConnectionToken(locationId?: number | string): Promise<Json> {
  const { data } = await api.post("terminal/connection-token", {
    location_id: locationId,
  });
  return unwrap(data);
}

export async function createTerminalLocation(body: {
  display_name: string;
  branch_id?: number | string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country?: string;
}): Promise<string> {
  const { data } = await api.post("terminal/locations", body);
  return msg(data, "Location created.");
}

export async function listTerminalLocations(
  params: PosListParams
): Promise<PosListResult<TerminalLocationRow>> {
  const { data } = await api.post("terminal/locations/list", buildBody(params));
  return parseList<TerminalLocationRow>(data, params.limit);
}

export async function registerReader(body: {
  registration_code: string;
  label: string;
  branch_id: number | string;
}): Promise<string> {
  const { data } = await api.post("terminal/readers", body);
  return msg(data, "Reader registered.");
}

export async function listReaders(
  params: PosListParams
): Promise<PosListResult<TerminalReaderRow>> {
  const { data } = await api.post("terminal/readers/list", buildBody(params));
  return parseList<TerminalReaderRow>(data, params.limit);
}

export async function getReader(id: number | string): Promise<TerminalReaderRow> {
  const { data } = await api.get(`terminal/readers/${id}`);
  return unwrap(data) as TerminalReaderRow;
}

export async function deleteReader(id: number | string): Promise<string> {
  const { data } = await api.delete(`terminal/readers/${id}`);
  return msg(data, "Reader removed.");
}

export interface CollectPaymentResult {
  payment_reference?: string;
  status?: string;
  [k: string]: unknown;
}

/** Push the charge to the reader's screen; returns the reference to poll. */
export async function collectTerminalPayment(body: {
  order_code: string;
  reader_id: number | string;
  amount?: number;
}): Promise<CollectPaymentResult> {
  const { data } = await api.post("terminal/collect-payment", body);
  const p = unwrap(data);
  return {
    ...p,
    payment_reference:
      p.payment_reference ?? p.paymentReference ?? p.reference ?? p.payment?.payment_reference,
  } as CollectPaymentResult;
}

export async function getTerminalPaymentStatus(
  paymentReference: string
): Promise<Json> {
  const { data } = await api.get(`terminal/payment-status/${paymentReference}`);
  return unwrap(data);
}

export async function captureTerminalPayment(paymentReference: string): Promise<string> {
  const { data } = await api.post("terminal/capture", {
    payment_reference: paymentReference,
  });
  return msg(data, "Payment captured.");
}

export async function cancelReaderAction(readerId: number | string): Promise<string> {
  const { data } = await api.post("terminal/cancel-action", { reader_id: readerId });
  return msg(data, "Reader action cancelled.");
}

// ─── Counter sale ─────────────────────────────────────────────────────────────

export const PRINT_METHODS = [
  "dtf", "dtg", "screen_print", "embroidery", "sublimation", "uv_dtf", "vinyl",
] as const;
export type PrintMethod = (typeof PRINT_METHODS)[number];

export interface PosOrderItemInput {
  product_id: number | string;
  variant_id?: number | string | null;
  quantity: number;
  print_method?: PrintMethod;
  custom_text?: string;
  design_upload_ids?: (number | string)[];
}

export interface PosOrderInput {
  user_id?: number | string;
  email?: string;
  phone?: string;
  full_name?: string;
  delivery_type?: "home_delivery" | "store_pickup";
  shipping_address_id?: number | string | null;
  billing_address_id?: number | string | null;
  shipping_address?: Json;
  billing_address?: Json;
  items: PosOrderItemInput[];
  coupon_code?: string;
  pickup_location_id?: number | string;
  notes?: string;
  send_email?: boolean;
}

export interface PosOrderResult {
  id?: number | string;
  order_code?: string;
  order_number?: string;
  total_amount?: string | number;
  [k: string]: unknown;
}

/**
 * Create a counter sale. Store and branch come from the authenticated admin,
 * and omitting the customer makes it a walk-in sale.
 */
export async function createPosOrder(body: PosOrderInput): Promise<PosOrderResult> {
  const { data } = await api.post("orders/pos", body);
  const p = unwrap(data);
  return (p?.order ?? p) as PosOrderResult;
}

export const POS_PAYMENT_METHODS = [
  "cash",
  "stripe",
  "paypal",
  "bank_transfer",
  "stripe_and_cash",
  "paypal_and_cash",
  "without_payment",
] as const;
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export const POS_PAYMENT_LABELS: Record<PosPaymentMethod, string> = {
  cash: "Cash",
  stripe: "Card (Stripe)",
  paypal: "PayPal",
  bank_transfer: "Bank transfer",
  stripe_and_cash: "Card + cash",
  paypal_and_cash: "PayPal + cash",
  without_payment: "No payment (pay later)",
};

export interface PosPaymentSession {
  payment_reference?: string;
  checkout_url?: string;
  status?: string;
  [k: string]: unknown;
}

export async function createPosPaymentSession(body: {
  order_code: string;
  payment_method: PosPaymentMethod;
  cash_amount?: number;
  online_amount?: number | null;
  success_url?: string | null;
  cancel_url?: string | null;
}): Promise<PosPaymentSession> {
  const { data } = await api.post("payments/pos/session", body);
  const p = unwrap(data);
  return {
    ...p,
    checkout_url: p.checkout_url ?? p.url ?? p.redirect_url ?? p.session?.url,
    payment_reference: p.payment_reference ?? p.reference,
  } as PosPaymentSession;
}
