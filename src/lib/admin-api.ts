import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { api } from "@/lib/api";

/**
 * Users & Branches list APIs from the ModFirst collection.
 * Request shape: { page, limit, startDate, endDate, filters: {...} }
 * Response envelope: { success, status, message, payload: {...} }
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

export const USER_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "designer",
  "sales",
  "support",
  "content_writer",
  "production",
  "accountant",
  "pos_user",
  "customer",
] as const;

export interface UserRow {
  id: number | string;
  full_name: string;
  email: string;
  phone?: string;
  role?: string;
  branch_id?: number | null;
  discount_tier_id?: number | null;
  discountTier?: { id?: number | string; name?: string } | null;
  is_active?: boolean;
  is_locked?: boolean;
  is_admin?: boolean;
  image?: string | null;
  created_at?: string;
}

export interface BranchRow {
  id: number | string;
  name: string;
  code: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  manager_name?: string;
  manager_email?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  totalPages: number;
}

interface ListParams {
  page: number;
  limit: number;
  dateRange?: DateRange;
  filters?: Json;
}

function buildBody({ page, limit, dateRange, filters }: ListParams): Json {
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

function parseList<T>(data: Json, limit: number): ListResult<T> {
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const rows: T[] = Array.isArray(p)
    ? p
    : p.rows ?? p.items ?? p.list ?? p.users ?? p.branches ?? p.orders ?? p.customers ?? p.products ?? p.data ?? [];
  // API may put pagination at root level (data.pagination) or inside payload
  const pg: Json = data?.pagination ?? p.pagination ?? {};
  const total: number =
    pg.total ?? p.total ?? p.count ?? p.totalRecords ?? rows.length;
  const totalPages: number =
    pg.totalPages ?? p.totalPages ?? Math.max(1, Math.ceil(total / limit));
  return { rows, total, totalPages };
}

// ─── Order types ──────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "booked", "accepted", "design_review", "preparing",
  "label_create", "shipped", "ready_for_pickup", "completed", "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DELIVERY_TYPES = ["home_delivery", "store_pickup"] as const;

export interface OrderCustomer {
  id?: number | string;
  full_name?: string;
  email?: string;
  phone?: string;
}

export interface OrderRow {
  id: number | string;
  order_number?: string;
  status?: string;
  payment_status?: string;
  delivery_type?: string;
  total?: number | string;
  subtotal?: number | string;
  discount?: number | string;
  tax?: number | string;
  shipping?: number | string;
  items_count?: number;
  customer?: OrderCustomer | string | null;
  email?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface ListOrdersParams {
  page: number;
  limit: number;
  dateRange?: DateRange;
  status?: string;
  payment_status?: string;
  delivery_type?: string;
  order_number?: string;
  email?: string;
  /** Anything else the list endpoint accepts, e.g. user_id. */
  filters?: Json;
}

export async function listOrders(params: ListOrdersParams): Promise<ListResult<OrderRow>> {
  const body: Json = { page: params.page, limit: params.limit };
  if (params.dateRange?.from) body.startDate = format(params.dateRange.from, "yyyy-MM-dd");
  if (params.dateRange?.to) body.endDate = format(params.dateRange.to, "yyyy-MM-dd");
  const filters: Json = {};
  if (params.status) filters.status = params.status;
  if (params.payment_status) filters.payment_status = params.payment_status;
  if (params.delivery_type) filters.delivery_type = params.delivery_type;
  if (params.order_number) filters.order_number = params.order_number;
  if (params.email) filters.email = params.email;
  Object.assign(filters, params.filters ?? {});
  if (Object.keys(filters).length) body.filters = filters;
  const { data } = await api.post("orders/list", body);
  return parseList<OrderRow>(data, params.limit);
}

export interface OrderItem {
  id: number | string;
  order_id?: number | string;
  product_id?: number | string;
  variant_id?: number | string;
  quantity?: number;
  unit_price?: string | number;
  total_price?: string | number;
  product_name?: string;
  variant_name?: string;
  sku?: string;
  image?: string;
  product?: {
    id?: number | string;
    title?: string;
    images?: { url?: string }[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface OrderAddress {
  id?: number | string;
  full_name?: string;
  phone?: string;
  email?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  [k: string]: unknown;
}

export interface ActivityLog {
  id?: number | string;
  message?: string;
  action?: string;
  description?: string;
  created_at?: string;
  user?: { name?: string; email?: string } | string | null;
  [k: string]: unknown;
}

export interface PaymentLog {
  id?: number | string;
  order_id?: number | string;
  amount?: string | number;
  payment_method?: string;
  status?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface OrderDetail extends OrderRow {
  order_number?: string;
  order_code?: string;
  full_name?: string;
  phone?: string;
  channel?: string;
  humanize_channel?: string;
  humanize_status?: string;
  humanize_payment_status?: string;
  humanize_delivery_type?: string;
  humanize_shipping_status?: string;
  subtotal?: string | number;
  total_amount?: string | number;
  tax_amount?: string | number;
  shipping_fee?: string | number;
  discount_amount?: string | number;
  discount_label?: string | null;
  paid_amount?: string | number;
  cash_amount?: string | number;
  online_amount?: string | number;
  pos_payment_type?: string;
  humanize_pos_payment_type?: string;
  shipping_status?: string;
  notes?: string | null;
  items?: OrderItem[];
  shippingAddr?: OrderAddress | null;
  billingAddr?: OrderAddress | null;
  shipping_address_id?: number | null;
  billing_address_id?: number | null;
  pickupLoc?: unknown;
  pickup_location_id?: number | null;
  activityLogs?: ActivityLog[];
  paymentLogs?: PaymentLog[];
  shipments?: ShipmentRow[];
  comments?: unknown[];
  coupon?: unknown;
  coupon_id?: number | null;
  estimated_delivery_date?: string | null;
  order_date?: string;
  [k: string]: unknown;
}

export async function getOrder(id: number | string): Promise<OrderDetail> {
  const { data } = await api.get(`orders/${id}`);
  return (data?.payload ?? data?.data ?? data) as OrderDetail;
}

export async function updateOrderStatus(
  id: number | string,
  status: string,
  notes?: string
): Promise<string> {
  const { data } = await api.put(`orders/${id}/status`, { status, notes });
  return (data?.message as string) ?? "Status updated.";
}

export type PrintType = "thermal_80mm" | "thermal_58mm" | "a4";
export type PrintFormat = "html" | "pdf";

export async function printOrder(body: {
  order_code?: string;
  order_id?: number | string;
  print_type?: PrintType;
  format?: PrintFormat;
  raw?: boolean;
}): Promise<Blob | Json> {
  const isRaw = body.raw ?? (body.format === "pdf");
  const { data } = await api.post("print/order", body, {
    responseType: isRaw ? "blob" : "json",
  });
  return data;
}

/**
 * GET variant that streams the file straight back — used for "open in a new
 * tab", where the browser renders or downloads it itself.
 */
export async function printOrderRaw(params: {
  order_code?: string;
  order_id?: number | string;
  print_type?: PrintType;
  format?: PrintFormat;
}): Promise<Blob> {
  const { data } = await api.get("print/order", {
    params: { ...params, raw: true },
    responseType: "blob",
  });
  return data as Blob;
}

export async function listUsers(params: ListParams): Promise<ListResult<UserRow>> {
  const { data } = await api.post("users/list", buildBody(params));
  return parseList<UserRow>(data, params.limit);
}

export async function listBranches(
  params: ListParams
): Promise<ListResult<BranchRow>> {
  const { data } = await api.post("branches/list", buildBody(params));
  return parseList<BranchRow>(data, params.limit);
}

export interface SizeRow {
  id: number | string;
  name: string;
  display_name: string;
  is_active?: boolean;
  created_at?: string;
}

export interface ColorRow {
  id: number | string;
  name: string;
  hex_code: string;
  is_active?: boolean;
  created_at?: string;
}

export async function listSizes(params: ListParams): Promise<ListResult<SizeRow>> {
  const { data } = await api.post("sizes/list", buildBody(params));
  return parseList<SizeRow>(data, params.limit);
}

export async function listColors(
  params: ListParams
): Promise<ListResult<ColorRow>> {
  const { data } = await api.post("colors/list", buildBody(params));
  return parseList<ColorRow>(data, params.limit);
}

export async function createColorAndReturn(body: { name: string; hex_code: string }): Promise<ColorRow> {
  const { data } = await api.post("colors", { ...body, is_active: true });
  return (data?.payload ?? data?.data ?? data) as ColorRow;
}

export async function createSizeAndReturn(body: { name: string; display_name: string }): Promise<SizeRow> {
  const { data } = await api.post("sizes", { ...body, is_active: true });
  return (data?.payload ?? data?.data ?? data) as SizeRow;
}

export const MENU_LINK_TYPES = [
  "category",
  "product",
  "page",
  "collection",
  "external_url",
  "custom",
] as const;

export interface MenuRow {
  id: number | string;
  name: string;
  slug: string;
  menu_type: "frontend" | "dashboard";
  parent_id?: number | null;
  sort_order?: number;
  icon?: string | null;
  link_type?: string;
  link_value?: string | null;
  target_category_id?: number | null;
  target_product_id?: number | null;
  target_page_id?: number | null;
  external_url?: string | null;
  open_in_new_tab?: boolean;
  visibility?: boolean;
  is_active?: boolean;
  created_at?: string;
}

/** A menu with its sub-menus resolved, as rendered by the tree view. */
export interface MenuTreeNode extends MenuRow {
  children: MenuTreeNode[];
  /** Nesting level, 0 for top-level menus. */
  depth: number;
}

export interface MenuRightRow {
  id: number | string;
  menu_id: number;
  menu?: { name?: string; slug?: string } | null;
  role: string;
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  created_at?: string;
}

export async function listMenus(params: ListParams): Promise<ListResult<MenuRow>> {
  const { data } = await api.post("menus/list", buildBody(params));
  return parseList<MenuRow>(data, params.limit);
}

/** Children can arrive under any of these keys depending on the endpoint. */
function pickChildren(node: Json): Json[] {
  const kids =
    node?.children ?? node?.sub_menus ?? node?.subMenus ?? node?.submenus ?? node?.items;
  return Array.isArray(kids) ? kids : [];
}

/** Sort siblings by sort_order, falling back to name. */
function sortSiblings<T extends MenuRow>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => {
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    return ao !== bo ? ao - bo : (a.name ?? "").localeCompare(b.name ?? "");
  });
}

/** Attach depth to an already-nested payload. */
function normalizeTree(nodes: Json[], depth = 0): MenuTreeNode[] {
  return sortSiblings(
    nodes.map((n) => ({
      ...(n as MenuRow),
      depth,
      children: normalizeTree(pickChildren(n), depth + 1),
    })) as MenuTreeNode[]
  );
}

/** Build a tree from a flat list using parent_id. Orphans are kept at the root. */
export function buildMenuTree(rows: MenuRow[]): MenuTreeNode[] {
  const byId = new Map<string, MenuTreeNode>();
  rows.forEach((r) => byId.set(String(r.id), { ...r, depth: 0, children: [] }));

  const roots: MenuTreeNode[] = [];
  byId.forEach((node) => {
    const parent =
      node.parent_id != null ? byId.get(String(node.parent_id)) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  });

  const applyDepth = (nodes: MenuTreeNode[], depth: number): MenuTreeNode[] =>
    sortSiblings(nodes).map((n) => ({
      ...n,
      depth,
      children: applyDepth(n.children, depth + 1),
    }));

  return applyDepth(roots, 0);
}

/**
 * Menus as a hierarchy. Uses POST menus/tree; if that endpoint is unavailable
 * or returns a flat list, the tree is assembled client-side from parent_id.
 */
export async function fetchMenuTree(filters: Json = {}): Promise<MenuTreeNode[]> {
  const clean = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

  try {
    const { data } = await api.post("menus/tree", { filters: clean });
    const p: Json = data?.payload ?? data?.data ?? data ?? {};
    const nodes: Json[] = Array.isArray(p) ? p : p.rows ?? p.menus ?? p.items ?? p.tree ?? [];
    if (nodes.length) {
      // Nested payload → use as-is; flat payload → assemble from parent_id.
      const nested = nodes.some((n) => pickChildren(n).length > 0);
      return nested
        ? normalizeTree(nodes)
        : buildMenuTree(nodes as unknown as MenuRow[]);
    }
    if (Array.isArray(nodes)) return [];
  } catch {
    // fall through to the flat list below
  }

  const flat = await listMenus({ page: 1, limit: 500, filters: clean });
  return buildMenuTree(flat.rows);
}

// ─── Generic delete ───────────────────────────────────────────────────────────

export const DELETE_TABLES = [
  "websiteSetting", "user", "homeSection", "footerSection", "menu", "menuRight",
  "category", "color", "contentPage", "product", "productVariant",
  "productDescription", "productImage", "productFaq", "size", "productCategory",
  "blog", "popup", "newsletter", "orderComment", "coupon", "courier",
  "pickupLocation", "branch",
] as const;
export type DeleteTable = (typeof DELETE_TABLES)[number];

export async function deleteRecord(table: DeleteTable, id: number | string): Promise<string> {
  const { data } = await api.post("common/delete", { id, table });
  return (data?.message as string) ?? "Deleted.";
}

export async function updateRecordStatus(
  table: DeleteTable,
  id: number | string,
  is_active: boolean
): Promise<string> {
  const { data } = await api.patch("common/update-status", { id, table, is_active });
  return (data?.message as string) ?? "Status updated.";
}

// ─── Generic sort order ────────────────────────────────────────────────────────

export const SORT_ORDER_TABLES = [
  "menu", "category", "generalFaq", "productDescription", "productImage",
  "productFaq", "homeBanner", "homeSection", "homeSectionItem",
  "footerSection", "footerLink",
] as const;
export type SortOrderTable = (typeof SORT_ORDER_TABLES)[number];

export async function updateSortOrder(
  table: SortOrderTable,
  items: { id: number | string; sort_order: number }[]
): Promise<string> {
  const { data } = await api.post("common/sort-order", { table, items });
  return (data?.message as string) ?? "Order updated.";
}

/** Create endpoints — return the API's success message. */
async function createRecord(path: string, body: Json, fallback: string) {
  const { data } = await api.post(path, body);
  return (data?.message as string) ?? fallback;
}

export const createUser = (body: Json) =>
  createRecord("users", body, "User created.");
export const createBranch = (body: Json) =>
  createRecord("branches", body, "Branch created.");
export const createSize = (body: Json) =>
  createRecord("sizes", body, "Size created.");
export const createColor = (body: Json) =>
  createRecord("colors", body, "Color created.");

/** Update endpoints — PUT :id, return the API's success message. */
async function updateRecord(path: string, body: Json, fallback: string) {
  const { data } = await api.put(path, body);
  return (data?.message as string) ?? fallback;
}

export const updateUser = (id: number | string, body: Json) =>
  updateRecord(`users/${id}`, body, "User updated.");
export const unlockUser = async (id: number | string) => {
  const { data } = await api.put(`users/${id}/unlock`);
  return (data?.message as string) ?? "User unlocked.";
};

/** Invalidate the user's tokens so they are signed out everywhere. */
export const terminateUserSession = async (id: number | string) => {
  const { data } = await api.put(`users/${id}/terminate-session`);
  return (data?.message as string) ?? "Sessions terminated.";
};
export const updateBranch = (id: number | string, body: Json) =>
  updateRecord(`branches/${id}`, body, "Branch updated.");
export const updateSize = (id: number | string, body: Json) =>
  updateRecord(`sizes/${id}`, body, "Size updated.");
export const updateColor = (id: number | string, body: Json) =>
  updateRecord(`colors/${id}`, body, "Color updated.");

export const BLOG_STATUSES = ["draft", "published", "archived"] as const;

export interface BlogRow {
  id: number | string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string;
  featured_image?: string | null;
  category?: string | null;
  tags?: string | null;
  status?: "draft" | "published" | "archived";
  published_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export async function listBlogs(params: ListParams): Promise<ListResult<BlogRow>> {
  const { data } = await api.post("blogs/list", buildBody(params));
  return parseList<BlogRow>(data, params.limit);
}

export const createBlog = (body: Json) =>
  createRecord("blogs", body, "Blog created.");
export const updateBlog = (id: number | string, body: Json) =>
  updateRecord(`blogs/${id}`, body, "Blog updated.");

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "failed",
] as const;
export const SUBSCRIBER_STATUSES = ["subscribed", "unsubscribed", "pending"] as const;
export const SUBSCRIBER_SOURCES = [
  "footer",
  "popup",
  "checkout",
  "account",
  "manual",
] as const;

export interface CampaignRow {
  id: number | string;
  subject: string;
  preview_text?: string | null;
  content?: string;
  featured_image?: string | null;
  status?: string;
  scheduled_at?: string | null;
  sent_at?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface SubscriberRow {
  id: number | string;
  email: string;
  full_name?: string | null;
  status?: string;
  source?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export async function listCampaigns(
  params: ListParams
): Promise<ListResult<CampaignRow>> {
  const { data } = await api.post("newsletters/list", buildBody(params));
  return parseList<CampaignRow>(data, params.limit);
}

export const createCampaign = (body: Json) =>
  createRecord("newsletters", body, "Campaign created.");
export const updateCampaign = (id: number | string, body: Json) =>
  updateRecord(`newsletters/${id}`, body, "Campaign updated.");
export const sendCampaign = async (id: number | string) => {
  const { data } = await api.post(`newsletters/${id}/send`);
  return (data?.message as string) ?? "Campaign is being sent.";
};

export async function listSubscribers(
  params: ListParams
): Promise<ListResult<SubscriberRow>> {
  const { data } = await api.post("newsletters/subscribers/list", buildBody(params));
  return parseList<SubscriberRow>(data, params.limit);
}

export const createSubscriber = (body: Json) =>
  createRecord("newsletters/subscribers", body, "Subscriber added.");
export const updateSubscriber = (id: number | string, body: Json) =>
  updateRecord(`newsletters/subscribers/${id}`, body, "Subscriber updated.");

export const createMenu = (body: Json) =>
  createRecord("menus", body, "Menu created.");
export const updateMenu = (id: number | string, body: Json) =>
  updateRecord(`menus/${id}`, body, "Menu updated.");

export const createMenuRight = (body: Json) =>
  createRecord("menu-rights", body, "Menu right created.");
export const updateMenuRight = (id: number | string, body: Json) =>
  updateRecord(`menu-rights/${id}`, body, "Menu right updated.");

export async function listMenuRights(
  params: ListParams
): Promise<ListResult<MenuRightRow>> {
  const { data } = await api.post("menu-rights/list", buildBody(params));
  return parseList<MenuRightRow>(data, params.limit);
}

// ─── Products ────────────────────────────────────────────────────────────────

export const PRODUCT_STATUSES = ["published", "draft", "archived"] as const;
export const WEIGHT_UNITS = ["kg", "g", "lb", "oz"] as const;

export interface ProductImageRow {
  id?: number | string;
  url: string;
  alt?: string | null;
  sort_order?: number;
  is_featured?: boolean;
}

export interface ProductVariantRow {
  id?: number | string;
  product_id?: number | string;
  color_id?: number | string | null;
  size_id?: number | string | null;
  title?: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number | null;
  sale_price?: number | null;
  compare_at_price?: number | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  quantity?: number;
  image_url?: string | null;
  status?: string;
  is_active?: boolean;
}

export interface ProductFaqRow {
  id?: number | string;
  question: string;
  answer: string;
  sort_order?: number;
}

export interface ProductRow {
  id: number | string;
  title: string;
  slug?: string;
  status?: "published" | "draft" | "archived";
  vendor?: string | null;
  category?: string | null;
  price?: number | null;
  quantity?: number;
  variants_count?: number;
  featured_image?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface ProductDetailRow extends ProductRow {
  description?: string | null;
  compare_at_price?: number | null;
  cost_per_item?: number | null;
  sku?: string | null;
  barcode?: string | null;
  track_quantity?: boolean;
  weight?: number | null;
  weight_unit?: string;
  requires_shipping?: boolean;
  tags?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  category_id?: number | null;
  images?: ProductImageRow[];
  variants?: ProductVariantRow[];
  faqs?: ProductFaqRow[];
}

export async function listProducts(
  params: ListParams
): Promise<ListResult<ProductRow>> {
  const { data } = await api.post("products/list", buildBody(params));
  const payload = data?.payload ?? data?.data ?? data ?? {};
  const rawRows: Json[] = Array.isArray(payload)
    ? payload
    : payload.rows ?? payload.items ?? payload.products ?? payload.list ?? payload.data ?? [];
  // Normalize API field name differences (name→title, base_price→price, etc.)
  const rows = rawRows.map((r): ProductRow => {
    const variants = (Array.isArray(r.variants) ? r.variants : []) as Json[];
    const variantsCount =
      (r.variants_count ?? r.variantsCount ?? (variants.length || undefined)) as
        | number
        | undefined;

    // Stock lives per variant once a product has any, so the product-level
    // column has to add them up — otherwise every variant product reads as
    // out of stock.
    const variantQty = variants.length
      ? variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
      : undefined;
    const productQty = [
      r.quantity, r.total_quantity, r.stock, r.stock_quantity,
      r.available_quantity, r.inventory_quantity,
    ].find((v) => v != null);
    const quantity =
      variantQty != null && (productQty == null || Number(productQty) === 0)
        ? variantQty
        : productQty != null
          ? Number(productQty)
          : undefined;

    return {
    ...r as ProductRow,
    title: (r.title ?? r.name ?? "") as string,
    quantity,
    variants_count: variantsCount,
    price: r.price != null ? (r.price as number) : r.base_price != null ? parseFloat(r.base_price as string) : null,
    featured_image: (r.featured_image ?? r.image ?? r.thumbnail
      ?? (Array.isArray(r.images) && r.images.length > 0
          ? ((r.images as Record<string, unknown>[]).find((i) => i.is_primary)?.image_url
              ?? (r.images as Record<string, unknown>[]).find((i) => i.is_primary)?.url
              ?? (r.images as Record<string, unknown>[])[0]?.image_url
              ?? (r.images as Record<string, unknown>[])[0]?.url
              ?? null)
          : null)
      ?? null) as string | null,
    };
  });
  const pagination = data?.pagination ?? {};
  const total: number =
    pagination.total ?? payload.total ?? payload.count ?? payload.totalRecords ?? rows.length;
  const totalPages: number =
    pagination.totalPages ?? payload.totalPages ?? Math.max(1, Math.ceil(total / params.limit));
  return { rows, total, totalPages };
}

/** Pull an id out of either `color_id` or a nested `color: { id }`. */
function relationId(row: Json, key: "color" | "size"): number | null {
  const direct = row[`${key}_id`];
  if (direct != null) return Number(direct);
  const nested = row[key];
  if (nested && typeof nested === "object" && (nested as Json).id != null) {
    return Number((nested as Json).id);
  }
  return null;
}

/** Variants can come back under a few different keys and shapes. */
function normalizeVariants(raw: Json): ProductVariantRow[] {
  const list = (raw.variants ??
    raw.productVariants ??
    raw.product_variants ??
    []) as Json[];
  if (!Array.isArray(list)) return [];
  return list.map((v) => ({
    ...(v as ProductVariantRow),
    id: v.id,
    color_id: relationId(v, "color"),
    size_id: relationId(v, "size"),
    price: v.price != null ? Number(v.price) : v.base_price != null ? Number(v.base_price) : null,
    sale_price: v.sale_price != null ? Number(v.sale_price) : null,
    discount_percent: v.discount_percent != null ? Number(v.discount_percent) : null,
    discount_amount: v.discount_amount != null ? Number(v.discount_amount) : null,
    quantity: Number(v.quantity ?? v.stock ?? v.stock_quantity ?? 0),
    image_url: (v.image_url ?? v.image ?? null) as string | null,
    status: (v.status as string) ?? "active",
  }));
}

export async function getProduct(id: number | string): Promise<ProductDetailRow> {
  const { data } = await api.get(`products/get/${id}`);
  const raw = data?.payload ?? data?.data ?? data;
  // Normalize API field names to match the form / ProductDetailRow interface
  return {
    ...raw,
    title: raw.title ?? raw.name ?? "",
    price: raw.price ?? raw.base_price ?? null,
    compare_at_price: raw.compare_at_price ?? raw.sale_price ?? null,
    cost_per_item: raw.cost_per_item ?? raw.cost_price ?? null,
    meta_description: raw.meta_description ?? raw.meta_desc ?? null,
    // vendor may come back as an object { id, name } — pull out the id
    vendor: typeof raw.vendor === "object" && raw.vendor !== null
      ? String((raw.vendor as { id?: number | string }).id ?? "")
      : raw.vendor ?? null,
    vendor_id: raw.vendor_id
      ?? (typeof raw.vendor === "object" && raw.vendor !== null
        ? (raw.vendor as { id?: number | string }).id ?? null
        : null),
    // category may come back as an object — keep category_id canonical
    category_id: raw.category_id
      ?? (typeof raw.category === "object" && raw.category !== null
        ? (raw.category as { id?: number | string }).id ?? null
        : null),
    // images: normalize image_url → url for ProductImageRow
    images: Array.isArray(raw.images)
      ? raw.images.map((img: Record<string, unknown>) => ({
          ...img,
          url: (img.url ?? img.image_url ?? "") as string,
        }))
      : [],
    // variants: the id must survive so edits PUT instead of creating
    // duplicates, and colour/size may arrive as nested objects.
    variants: normalizeVariants(raw),
  } as ProductDetailRow;
}

export async function createProduct(
  body: Json
): Promise<{ id: number | string; message: string }> {
  const { data } = await api.post("products", body);
  const p: Json = data?.payload ?? data?.data ?? {};
  const id = p.id ?? p._id ?? data?.id;
  return { id, message: (data?.message as string) ?? "Product created." };
}

export const updateProduct = (id: number | string, body: Json) =>
  updateRecord(`products/${id}`, body, "Product updated.");

// ─── Vendors ─────────────────────────────────────────────────────────────────

export interface VendorRow {
  id: number | string;
  name: string;
  slug?: string;
  is_active?: boolean;
  created_at?: string;
}

export async function fetchAllVendors(): Promise<VendorRow[]> {
  const { data } = await api.post("vendors/list", { page: 1, limit: 200 });
  const result = parseList<VendorRow>(data, 200);
  return result.rows;
}

// ─── Product Categories ───────────────────────────────────────────────────────

export interface ProductCategoryRow {
  id: number | string;
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: number | null;
  parent?: { id?: number | string; name?: string } | null;
  image?: string | null;
  image_url?: string | null;
  banner?: string | null;
  icon?: string | null;
  is_active?: boolean;
  products_count?: number;
  created_at?: string;
  [k: string]: unknown;
}

export async function listProductCategories(
  params: ListParams
): Promise<ListResult<ProductCategoryRow>> {
  const { data } = await api.post("product-categories/list", buildBody(params));
  return parseList<ProductCategoryRow>(data, params.limit);
}

export async function fetchAllProductCategories(): Promise<ProductCategoryRow[]> {
  const { data } = await api.post("product-categories/list", { page: 1, limit: 200 });
  const result = parseList<ProductCategoryRow>(data, 200);
  return result.rows;
}

export const createProductCategory = (body: Json) =>
  createRecord("product-categories", body, "Category created.");

export const updateProductCategory = (id: number | string, body: Json) =>
  updateRecord(`product-categories/${id}`, body, "Category updated.");

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;

export interface ReviewRow {
  id: number | string;
  product_id?: number | null;
  product?: { name?: string; id?: number } | null;
  user_id?: number | null;
  user?: { full_name?: string; email?: string } | null;
  rating: number;
  title?: string | null;
  comment?: string | null;
  video_url?: string | null;
  is_verified?: boolean;
  status?: "pending" | "approved" | "rejected";
  helpful_count?: number;
  is_active?: boolean;
  created_at?: string;
}

export async function listReviews(
  params: ListParams
): Promise<ListResult<ReviewRow>> {
  const { data } = await api.post("reviews/list", buildBody(params));
  return parseList<ReviewRow>(data, params.limit);
}

export async function getReviewById(id: number | string): Promise<ReviewRow> {
  const { data } = await api.get(`reviews/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ReviewRow;
}

export const updateReview = (id: number | string, body: Json) =>
  updateRecord(`reviews/${id}`, body, "Review updated.");

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const DASHBOARD_PERIODS = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "custom",
] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export interface DashboardBody {
  period?: DashboardPeriod;
  startDate?: string;
  endDate?: string;
  branch_id?: number;
  limit?: number;
  threshold?: number;
}

export interface OverviewMetric {
  value: number;
  change_pct?: number | null;
  change_direction?: "up" | "down" | "neutral" | null;
}

export interface DashboardOverview {
  revenue?: OverviewMetric;
  orders?: OverviewMetric;
  new_customers?: OverviewMetric;
  aov?: OverviewMetric; // average order value
  pending_orders?: number;
  low_stock_count?: number;
  active_customers?: number;
  active_products?: number;
  [key: string]: unknown;
}

export interface TrendPoint {
  date?: string;
  label?: string;
  revenue?: number;
  orders?: number;
  customers?: number;
  count?: number;
  [key: string]: unknown;
}

export interface BreakdownItem {
  label?: string;
  name?: string;
  status?: string;
  channel?: string;
  method?: string;
  count?: number;
  orders?: number;
  revenue?: number;
  percentage?: number;
  [key: string]: unknown;
}

export interface TopProduct {
  id?: number | string;
  name?: string;
  title?: string;
  units_sold?: number;
  quantity_sold?: number;
  revenue?: number;
  image?: string | null;
  [key: string]: unknown;
}

export interface RecentOrder {
  id: number | string;
  order_number?: string;
  customer?: string | { full_name?: string; name?: string } | null;
  total?: number;
  status?: string;
  payment_status?: string;
  created_at?: string;
  items_count?: number;
  [key: string]: unknown;
}

export interface LowStockItem {
  id: number | string;
  name?: string;
  title?: string;
  sku?: string | null;
  quantity?: number;
  threshold?: number;
  image?: string | null;
  [key: string]: unknown;
}

export interface PendingActions {
  pending_reviews?: number;
  pending_refunds?: number;
  design_review_orders?: number;
  booked_orders?: number;
  unresolved_messages?: number;
  locked_users?: number;
  [key: string]: unknown;
}

function dashParse<T>(data: Json): T {
  return (data?.payload ?? data?.data ?? data) as T;
}

/** Containers the overview numbers may be nested inside. */
const OVERVIEW_CONTAINERS = [
  "summary", "overview", "metrics", "stats", "statistics", "totals", "kpis", "cards",
];

/** Value keys used when a metric arrives as an object rather than a number. */
const METRIC_VALUE_KEYS = ["value", "total", "amount", "count", "current"];
const METRIC_CHANGE_KEYS = [
  "change_pct", "changePct", "change_percentage", "changePercentage",
  "percent_change", "percentChange", "growth_pct", "growth", "change",
];

/** Coerce whatever shape a metric arrives in into { value, change_pct }. */
function toMetric(raw: unknown): OverviewMetric | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") return { value: raw };
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? undefined : { value: n };
  }
  if (typeof raw !== "object") return undefined;

  const obj = raw as Json;
  const valueKey = METRIC_VALUE_KEYS.find((k) => typeof obj[k] === "number" || typeof obj[k] === "string");
  if (!valueKey) return undefined;
  const value = Number(String(obj[valueKey]).replace(/[^0-9.-]/g, ""));
  if (isNaN(value)) return undefined;

  const changeKey = METRIC_CHANGE_KEYS.find((k) => obj[k] != null);
  const change = changeKey != null ? Number(obj[changeKey]) : undefined;

  return {
    value,
    change_pct: change != null && !isNaN(change) ? change : undefined,
    change_direction: (obj.change_direction ?? obj.direction ?? null) as OverviewMetric["change_direction"],
  };
}

/**
 * Find a metric by any of its known aliases, at the top level or inside one of
 * the usual container objects. Key naming varies between endpoints, so the
 * dashboard resolves values by alias instead of assuming one exact shape.
 */
function findMetric(payload: Json, aliases: string[]): OverviewMetric | undefined {
  const sources: Json[] = [
    payload,
    ...OVERVIEW_CONTAINERS.map((k) => payload?.[k]).filter(
      (v): v is Json => !!v && typeof v === "object" && !Array.isArray(v)
    ),
  ];
  for (const source of sources) {
    for (const alias of aliases) {
      const metric = toMetric(source?.[alias]);
      if (metric) return metric;
    }
  }
  return undefined;
}

const OVERVIEW_ALIASES = {
  revenue: ["revenue", "total_revenue", "totalRevenue", "revenue_total", "sales", "total_sales", "totalSales", "gross_revenue", "net_revenue", "grand_total"],
  orders: ["orders", "total_orders", "totalOrders", "order_count", "orders_count", "ordersCount", "total_order"],
  new_customers: ["new_customers", "newCustomers", "new_customer_count", "customers", "total_customers", "totalCustomers", "customers_count", "new_users", "new_user_count"],
  aov: ["aov", "average_order_value", "averageOrderValue", "avg_order_value", "avgOrderValue", "average_order", "avg_order"],
  pending_orders: ["pending_orders", "pendingOrders", "pending_order_count"],
  low_stock_count: ["low_stock_count", "lowStockCount", "low_stock", "low_stock_products", "lowStockProducts"],
  active_customers: ["active_customers", "activeCustomers", "total_customers"],
  active_products: ["active_products", "activeProducts", "total_products", "totalProducts", "products"],
} as const;

/**
 * Store overview KPIs. The raw payload is preserved so nothing is lost, with
 * the four headline metrics normalized onto stable keys for the dashboard.
 */
export async function getDashboardOverview(body: DashboardBody = {}): Promise<DashboardOverview> {
  const { data } = await api.post("dashboard/overview", body);
  const payload = dashParse<Json>(data) ?? {};

  const resolved: DashboardOverview = { ...payload };
  let found = 0;

  const headline = ["revenue", "orders", "new_customers", "aov"];
  (Object.keys(OVERVIEW_ALIASES) as (keyof typeof OVERVIEW_ALIASES)[]).forEach((key) => {
    const metric = findMetric(payload, [...OVERVIEW_ALIASES[key]]);
    if (!metric) return;
    found += 1;
    // Counters stay plain numbers; the headline metrics keep their change_pct.
    (resolved as Json)[key] = headline.includes(key) ? metric : metric.value;
  });

  if (!found && Object.keys(payload).length) {
    console.warn(
      "[dashboard/overview] no known metrics in payload — keys were:",
      Object.keys(payload)
    );
  }

  return resolved;
}

export async function getRevenueTrend(body: DashboardBody = {}): Promise<TrendPoint[]> {
  const { data } = await api.post("dashboard/revenue-trend", body);
  const p = dashParse<Json>(data);
  return (Array.isArray(p) ? p : p?.trend ?? p?.data ?? p?.rows ?? []) as TrendPoint[];
}

export async function getCustomerGrowthTrend(body: DashboardBody = {}): Promise<TrendPoint[]> {
  const { data } = await api.post("dashboard/customer-growth-trend", body);
  const p = dashParse<Json>(data);
  return (Array.isArray(p) ? p : p?.trend ?? p?.data ?? p?.rows ?? []) as TrendPoint[];
}

export async function getOrderStatusBreakdown(body: DashboardBody = {}): Promise<BreakdownItem[]> {
  const { data } = await api.post("dashboard/order-status-breakdown", body);
  const p = dashParse<Json>(data);
  return (Array.isArray(p) ? p : p?.breakdown ?? p?.data ?? p?.rows ?? []) as BreakdownItem[];
}

export async function getOrderChannelBreakdown(body: DashboardBody = {}): Promise<BreakdownItem[]> {
  const { data } = await api.post("dashboard/order-channel-breakdown", body);
  const p = dashParse<Json>(data);
  return (Array.isArray(p) ? p : p?.breakdown ?? p?.data ?? p?.rows ?? []) as BreakdownItem[];
}

export async function getPaymentMethodBreakdown(body: DashboardBody = {}): Promise<BreakdownItem[]> {
  const { data } = await api.post("dashboard/payment-method-breakdown", body);
  const p = dashParse<Json>(data);
  return (Array.isArray(p) ? p : p?.breakdown ?? p?.data ?? p?.rows ?? []) as BreakdownItem[];
}

export async function getTopProducts(body: DashboardBody = {}): Promise<TopProduct[]> {
  const { data } = await api.post("dashboard/top-products", body);
  const p = dashParse<Json>(data);
  return (Array.isArray(p) ? p : p?.products ?? p?.data ?? p?.rows ?? []) as TopProduct[];
}

export async function getRecentOrders(limit = 10): Promise<RecentOrder[]> {
  const { data } = await api.post("dashboard/recent-orders", { limit });
  const p = dashParse<Json>(data);
  return (Array.isArray(p) ? p : p?.orders ?? p?.data ?? p?.rows ?? []) as RecentOrder[];
}

export async function getLowStockAlerts(limit = 10, threshold = 10): Promise<LowStockItem[]> {
  const { data } = await api.post("dashboard/low-stock-alerts", { limit, threshold });
  const p = dashParse<Json>(data);
  return (Array.isArray(p) ? p : p?.products ?? p?.items ?? p?.data ?? p?.rows ?? []) as LowStockItem[];
}

export async function getPendingActions(): Promise<PendingActions> {
  const { data } = await api.get("dashboard/pending-actions");
  return dashParse<PendingActions>(data);
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export const SALES_GROUP_BY = ["day", "week", "month", "product", "category"] as const;
export type SalesGroupBy = (typeof SALES_GROUP_BY)[number];

export const ORDER_STATUSES_REPORT = [
  "booked","accepted","design_review","preparing",
  "label_create","shipped","ready_for_pickup","completed","cancelled",
] as const;

export const PAYMENT_STATUSES_REPORT = ["pending","paid","partially_paid","refunded","failed"] as const;

// Sales
export interface SalesDataRow {
  date?: string; label?: string; period?: string;
  orders?: number; subtotal?: number; discount?: number;
  tax?: number; shipping?: number; revenue?: number;
  units_sold?: number; [k: string]: unknown;
}
export interface SalesSummary {
  orders?: number; subtotal?: number; discount?: number;
  tax?: number; shipping?: number; revenue?: number; [k: string]: unknown;
}
export interface SalesReport { data: SalesDataRow[]; summary?: SalesSummary }

export async function getSalesReport(body: {
  startDate: string; endDate: string; groupBy?: SalesGroupBy; branch_id?: number;
}): Promise<SalesReport> {
  const { data } = await api.post("reports/sales", body);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const rows: SalesDataRow[] = Array.isArray(p) ? p : p.data ?? p.rows ?? p.items ?? [];
  const summary: SalesSummary = Array.isArray(p) ? {} : p.summary ?? p.totals ?? {};
  return { data: rows, summary };
}

// Orders
export interface OrderReportRow {
  id: number | string; order_number?: string;
  customer?: string | { full_name?: string; name?: string } | null;
  status?: string; payment_status?: string;
  subtotal?: number; discount?: number; tax?: number;
  shipping?: number; total?: number; items_count?: number;
  created_at?: string; [k: string]: unknown;
}
export interface OrderReportSummary {
  total_orders?: number; total_revenue?: number;
  total_discount?: number; total_tax?: number; total_shipping?: number; [k: string]: unknown;
}
export interface OrderReport {
  rows: OrderReportRow[]; summary?: OrderReportSummary;
  total: number; totalPages: number;
}
export async function getOrderReport(body: {
  startDate: string; endDate: string; page?: number; limit?: number;
  status?: string; payment_status?: string;
}): Promise<OrderReport> {
  const { data } = await api.post("reports/orders", body);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const rows: OrderReportRow[] = Array.isArray(p) ? p : p.rows ?? p.orders ?? p.data ?? [];
  const summary = (Array.isArray(p) ? {} : p.summary ?? p.totals ?? {}) as OrderReportSummary;
  const pag: Json = data?.pagination ?? p.pagination ?? {};
  const total = pag.total ?? p.total ?? rows.length;
  const limit = body.limit ?? 20;
  const totalPages = pag.totalPages ?? Math.max(1, Math.ceil(total / limit));
  return { rows, summary, total, totalPages };
}

// Inventory
export interface InventoryReportRow {
  id: number | string; name?: string; title?: string; sku?: string | null;
  category?: string | null; quantity?: number; cost_price?: number | null;
  stock_value?: number | null; status?: "in_stock" | "low_stock" | "out_of_stock";
  [k: string]: unknown;
}
export interface InventoryReportSummary {
  total_skus?: number; total_units?: number; total_stock_value?: number;
  out_of_stock_count?: number; low_stock_count?: number; [k: string]: unknown;
}
export interface InventoryReport { rows: InventoryReportRow[]; summary?: InventoryReportSummary }
export async function getInventoryReport(body?: {
  category_id?: number; low_stock_only?: boolean; threshold?: number;
}): Promise<InventoryReport> {
  const { data } = await api.post("reports/inventory", body ?? {});
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const rows: InventoryReportRow[] = Array.isArray(p) ? p : p.items ?? p.rows ?? p.data ?? [];
  const summary = (Array.isArray(p) ? {} : p.summary ?? p.totals ?? {}) as InventoryReportSummary;
  return { rows, summary };
}

// Customers
export interface CustomerReportRow {
  id: number | string; full_name?: string; name?: string; email?: string;
  total_orders?: number; total_spent?: number; avg_order_value?: number;
  last_order_at?: string; [k: string]: unknown;
}
export async function getCustomerReport(body?: {
  startDate?: string; endDate?: string; limit?: number;
}): Promise<CustomerReportRow[]> {
  const { data } = await api.post("reports/customers", body ?? {});
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return (Array.isArray(p) ? p : p.customers ?? p.rows ?? p.data ?? []) as CustomerReportRow[];
}

// Product Performance
export interface ProductPerfRow {
  id: number | string; name?: string; title?: string; category?: string | null;
  units_sold?: number; revenue?: number; cost?: number;
  profit?: number; margin?: number; [k: string]: unknown;
}
export async function getProductPerformanceReport(body: {
  startDate: string; endDate: string; category_id?: number;
  sortBy?: "revenue" | "units_sold"; limit?: number;
}): Promise<ProductPerfRow[]> {
  const { data } = await api.post("reports/product-performance", body);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return (Array.isArray(p) ? p : p.products ?? p.rows ?? p.data ?? []) as ProductPerfRow[];
}

// Financial
export interface FinancialBreakdownRow {
  method?: string; payment_method?: string;
  revenue?: number; discounts?: number; tax?: number;
  shipping?: number; fees?: number; refunds?: number; net_revenue?: number;
  [k: string]: unknown;
}
export interface FinancialReport {
  breakdown: FinancialBreakdownRow[];
  totals?: FinancialBreakdownRow;
}
export async function getFinancialReport(body: {
  startDate: string; endDate: string;
}): Promise<FinancialReport> {
  const { data } = await api.post("reports/financial", body);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const breakdown = (Array.isArray(p) ? p : p.breakdown ?? p.rows ?? p.data ?? []) as FinancialBreakdownRow[];
  const totals = (Array.isArray(p) ? undefined : p.totals ?? p.summary) as FinancialBreakdownRow | undefined;
  return { breakdown, totals };
}

// Coupon Usage
export interface CouponUsageRow {
  coupon_id?: number | string; id?: number | string;
  code?: string; name?: string;
  times_used?: number; total_discount?: number; [k: string]: unknown;
}
export async function getCouponUsageReport(body?: {
  startDate?: string; endDate?: string; coupon_id?: number;
}): Promise<CouponUsageRow[]> {
  const { data } = await api.post("reports/coupon-usage", body ?? {});
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return (Array.isArray(p) ? p : p.coupons ?? p.rows ?? p.data ?? []) as CouponUsageRow[];
}

// ─── Global Search (Admin) ────────────────────────────────────────────────────

export type AdminSearchType = "products" | "orders" | "users" | "vendors" | "coupons";

export interface AdminSearchItem {
  id: number | string;
  title?: string;
  name?: string;
  full_name?: string;
  order_number?: string;
  email?: string;
  code?: string;
  status?: string;
  total?: number;
  price?: number;
  base_price?: number;
  image?: string | null;
  image_url?: string | null;
  [k: string]: unknown;
}

export interface AdminSearchResults {
  products?: AdminSearchItem[];
  orders?: AdminSearchItem[];
  users?: AdminSearchItem[];
  vendors?: AdminSearchItem[];
  coupons?: AdminSearchItem[];
}

export async function globalAdminSearch(
  query: string,
  types?: AdminSearchType[],
  limit = 5
): Promise<AdminSearchResults> {
  const body: Json = { query, limit };
  if (types?.length) body.types = types;
  const { data } = await api.post("search/admin", body);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return (p.results ?? p) as AdminSearchResults;
}

// ─── Website Settings ─────────────────────────────────────────────────────────

export interface WebsiteSettingRow {
  id?: number | string;
  // Required on create
  site_name?: string;
  primary_color?: string;
  secondary_color?: string;
  font_primary?: string;
  font_heading?: string;
  // Optional
  site_tagline?: string | null;
  site_description?: string | null;
  logo_url?: string | null;             // generic fallback logo
  logo_white_url?: string | null;       // used in EMAILS (dark header band)
  logo_black_url?: string | null;       // used on RECEIPTS and PRINTS (white paper)
  favicon_url?: string | null;
  footer_logo_url?: string | null;
  accent_color?: string | null;
  contact_email?: string | null;
  support_email?: string | null;
  contact_phone?: string | null;
  whatsapp_number?: string | null;
  address?: string | null;
  city?: string | null;
  country_code?: string | null;
  postal_code?: string | null;
  province_code?: string | null;
  business_hours?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  youtube_url?: string | null;
  tiktok_url?: string | null;
  pinterest_url?: string | null;
  playstore_url?: string | null;
  appstore_url?: string | null;
  currency?: string;              // default USD
  currency_symbol?: string;       // default $
  tax_percentage?: number | null;
  default_shipping_fee?: number | null;
  free_shipping_threshold?: number | null;   // display only, not applied at checkout
  min_order_amount?: number | null;
  first_order_discount_enabled?: boolean;    // default false
  first_order_discount_type?: "percentage" | "fixed_amount" | string | null;
  first_order_discount_value?: number | null;
  first_order_max_discount?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  og_image_url?: string | null;
  order_prefix?: string;          // string, min 1, max 10
  is_active?: boolean;            // default true
}

/** Fetch website settings via list endpoint. */
export async function fetchWebsiteSettings(): Promise<WebsiteSettingRow | null> {
  const { data } = await api.post("website-settings/list", { page: 1, limit: 1 });
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const rows: Json[] = p.rows ?? p.list ?? p.data ?? p.items ?? (Array.isArray(p) ? p : []);
  return rows.length ? (rows[0] as WebsiteSettingRow) : null;
}

export async function createWebsiteSettings(
  body: Partial<WebsiteSettingRow>
): Promise<string> {
  const { data } = await api.post("website-settings", body);
  return (data?.message as string) ?? "Settings created.";
}

export async function updateWebsiteSettings(
  id: number | string,
  body: Partial<WebsiteSettingRow>
): Promise<string> {
  const { data } = await api.put(`website-settings/${id}`, body);
  return (data?.message as string) ?? "Settings saved.";
}

// ─── Shipping / Shipments ─────────────────────────────────────────────────────

export const SHIPMENT_STATUSES = [
  "PENDING", "LABEL_CREATED", "PICKUP_SCHEDULED", "PICKED_UP", "SHIPPED",
  "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "RETURNED", "FAILED",
  "CANCELLED", "PROCESSING",
] as const;

export interface ShipmentRow {
  id: number | string;
  order_id?: number | string;
  courier_id?: number | string;
  shipment_number?: string;
  tracking_number?: string;
  provider_shipment_id?: string;
  service_name?: string;
  currency?: string;
  provider_status?: string;
  status?: string;
  is_active?: boolean;
  pickup_address?: string;
  delivery_address?: string;
  shipped_at?: string;
  delivered_at?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface ShippingAddressInput {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PackageDetailsInput {
  description: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  quantity: number;
}

export async function createShipmentRate(body: {
  courier_id: number | string;
  order_id: number | string;
  shippingAddress?: ShippingAddressInput;
  packageDetails?: PackageDetailsInput;
}): Promise<string> {
  const { data } = await api.post("shippings/rates", body);
  return (data?.message as string) ?? "Shipment created.";
}

export async function listShipments(params: ListParams): Promise<ListResult<ShipmentRow>> {
  const { data } = await api.post("shippings/list", buildBody(params));
  return parseList<ShipmentRow>(data, params.limit);
}

export async function getShipmentById(id: number | string): Promise<ShipmentRow> {
  const { data } = await api.get(`shippings/${id}`);
  return (data?.payload ?? data?.data ?? data) as ShipmentRow;
}

export async function trackShipment(id: number | string): Promise<Json> {
  const { data } = await api.get(`shippings/${id}/track`);
  return (data?.payload ?? data?.data ?? data) as Json;
}

export async function voidShipment(id: number | string): Promise<string> {
  const { data } = await api.delete(`shippings/${id}`);
  return (data?.message as string) ?? "Shipment voided.";
}

export async function cancelPickup(id: number | string): Promise<string> {
  const { data } = await api.delete(`shippings/pickup/${id}`);
  return (data?.message as string) ?? "Pickup cancelled.";
}

export async function schedulePickup(body: {
  shipment_ids: (number | string)[];
  requested_start_time: string;
  requested_end_time: string;
}): Promise<string> {
  const { data } = await api.post("shippings/pickup/schedule", body);
  return (data?.message as string) ?? "Pickup scheduled.";
}

export async function getPickupById(pickupId: number | string): Promise<Json> {
  const { data } = await api.get(`shippings/pickup/${pickupId}`);
  return (data?.payload ?? data?.data ?? data) as Json;
}

export async function syncShipmentPickup(body: {
  courier_id: number | string;
  order_id: number | string;
  shippingAddress?: ShippingAddressInput;
  packageDetails?: PackageDetailsInput;
}): Promise<string> {
  const { data } = await api.post("shippings/pickup/sync", body);
  return (data?.message as string) ?? "Pickup synced.";
}

// ─── Couriers ─────────────────────────────────────────────────────────────────

export interface CourierRow {
  id: number | string;
  name: string;
  code: string;
  email?: string | null;
  contact_number?: string | null;
  booking_url?: string | null;
  tracking_url?: string | null;
  website?: string | null;
  notes?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export async function listCouriers(params: ListParams): Promise<ListResult<CourierRow>> {
  const { data } = await api.post("couriers/list", buildBody(params));
  return parseList<CourierRow>(data, params.limit);
}

export async function getCourierById(id: number | string): Promise<CourierRow> {
  const { data } = await api.get(`couriers/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as CourierRow;
}

export async function createCourier(body: Partial<CourierRow>): Promise<string> {
  const { data } = await api.post("couriers", body);
  return (data?.message as string) ?? "Courier created.";
}

export async function updateCourier(id: number | string, body: Partial<CourierRow>): Promise<string> {
  const { data } = await api.put(`couriers/${id}`, body);
  return (data?.message as string) ?? "Courier updated.";
}

export async function deleteCourier(id: number | string): Promise<string> {
  const { data } = await api.delete(`couriers/${id}`);
  return (data?.message as string) ?? "Courier deleted.";
}

// ─── Popups ───────────────────────────────────────────────────────────────────

export const POPUP_TYPES = ["announcement", "coupon", "newsletter"] as const;
export type PopupType = (typeof POPUP_TYPES)[number];

export interface PopupRow {
  id: number | string;
  title: string;
  message?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  button_text?: string | null;
  popup_type?: PopupType | string;
  coupon_code?: string | null;
  display_priority?: number;
  is_active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
}

export async function listPopups(params: ListParams): Promise<ListResult<PopupRow>> {
  const { data } = await api.post("popups/list", buildBody(params));
  return parseList<PopupRow>(data, params.limit);
}

export async function getPopupById(id: number | string): Promise<PopupRow> {
  const { data } = await api.get(`popups/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as PopupRow;
}

export async function createPopup(body: Partial<PopupRow>): Promise<string> {
  const { data } = await api.post("popups", body);
  return (data?.message as string) ?? "Popup created.";
}

export async function updatePopup(id: number | string, body: Partial<PopupRow>): Promise<string> {
  const { data } = await api.put(`popups/${id}`, body);
  return (data?.message as string) ?? "Popup updated.";
}

export async function deletePopup(id: number | string): Promise<string> {
  const { data } = await api.delete(`popups/${id}`);
  return (data?.message as string) ?? "Popup deleted.";
}

// ─── Coupons ─────────────────────────────────────────────────────────────────

export const COUPON_TYPES = ["percentage", "fixed_amount", "free_shipping"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const COUPON_STATUSES = ["active", "expired", "used_up"] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export interface CouponRow {
  id: number | string;
  code: string;
  type: CouponType;
  value: number;
  min_order_amount?: number | null;
  usage_limit?: number | null;
  per_user_limit?: number | null;
  used_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: CouponStatus;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export async function listCoupons(params: ListParams): Promise<ListResult<CouponRow>> {
  const { data } = await api.post("coupons/list", buildBody(params));
  return parseList<CouponRow>(data, params.limit);
}

export async function getCouponById(id: number | string): Promise<CouponRow> {
  const { data } = await api.get(`coupons/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as CouponRow;
}

export async function createCoupon(body: Partial<CouponRow>): Promise<string> {
  const { data } = await api.post("coupons", body);
  return (data?.message as string) ?? "Coupon created.";
}

export async function updateCoupon(id: number | string, body: Partial<CouponRow>): Promise<string> {
  const { data } = await api.put(`coupons/${id}`, body);
  return (data?.message as string) ?? "Coupon updated.";
}

export async function validateCoupon(body: {
  code: string;
  order_amount: number;
  user_id?: number;
}): Promise<Json> {
  const { data } = await api.post("coupons/validate", body);
  return (data?.payload ?? data?.data ?? data) as Json;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export const INVENTORY_REASONS = [
  "STOCK_IN", "STOCK_OUT", "MANUAL_ADJUSTMENT",
  "ORDER_PLACED", "ORDER_CANCELLED", "RETURNED", "DAMAGED",
] as const;
export type InventoryReason = (typeof INVENTORY_REASONS)[number];

export interface InventoryStock {
  product_id: number | string;
  variant_id?: number | string | null;
  quantity: number;
  reserved?: number;
  available?: number;
  [k: string]: unknown;
}

export interface InventoryLogRow {
  id: number | string;
  product_id?: number | string;
  variant_id?: number | string | null;
  quantity_change?: number;
  quantity_before?: number;
  quantity_after?: number;
  reason?: string;
  notes?: string | null;
  performed_by?: number | string | null;
  performer?: { full_name?: string; email?: string } | null;
  created_at?: string;
  [k: string]: unknown;
}

export async function increaseInventory(body: {
  product_id: number | string;
  variant_id?: number | string | null;
  quantity: number;
  reason?: InventoryReason;
  notes?: string;
}): Promise<string> {
  const { data } = await api.post("inventory/increase", body);
  return (data?.message as string) ?? "Stock increased.";
}

export async function decreaseInventory(body: {
  product_id: number | string;
  variant_id?: number | string | null;
  quantity: number;
  reason?: InventoryReason;
  notes?: string;
}): Promise<string> {
  const { data } = await api.post("inventory/decrease", body);
  return (data?.message as string) ?? "Stock decreased.";
}

export async function adjustInventory(body: {
  product_id: number | string;
  variant_id?: number | string | null;
  quantity: number;
  notes?: string;
}): Promise<string> {
  const { data } = await api.post("inventory/adjust", body);
  return (data?.message as string) ?? "Stock adjusted.";
}

export async function getInventoryStock(
  productId: number | string,
  variantId?: number | string
): Promise<InventoryStock> {
  const qs = variantId !== undefined && variantId !== null ? `?variant_id=${variantId}` : "";
  const { data } = await api.get(`inventory/get/${productId}${qs}`);
  return (data?.payload ?? data?.data ?? data) as InventoryStock;
}

export async function listInventoryLogs(params: ListParams): Promise<ListResult<InventoryLogRow>> {
  const { data } = await api.post("inventory/logs", buildBody(params));
  return parseList<InventoryLogRow>(data, params.limit);
}

// ─── Pickup Locations ─────────────────────────────────────────────────────────

export interface PickupLocationRow {
  id: number | string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export async function listPickupLocations(params: ListParams): Promise<ListResult<PickupLocationRow>> {
  const { data } = await api.post("pickup-locations/list", buildBody(params));
  return parseList<PickupLocationRow>(data, params.limit);
}

export async function createPickupLocation(body: Partial<PickupLocationRow>): Promise<string> {
  const { data } = await api.post("pickup-locations", body);
  return (data?.message as string) ?? "Pickup location created.";
}

export async function updatePickupLocation(id: number | string, body: Partial<PickupLocationRow>): Promise<string> {
  const { data } = await api.put(`pickup-locations/${id}`, body);
  return (data?.message as string) ?? "Pickup location updated.";
}

export async function deletePickupLocation(id: number | string): Promise<string> {
  const { data } = await api.delete(`pickup-locations/${id}`);
  return (data?.message as string) ?? "Pickup location deleted.";
}

// ─── Footer Sections ──────────────────────────────────────────────────────────

export interface FooterLinkRow {
  id?: number | string;
  name: string;
  url: string;
  type?: string;      // url / route / email / phone
  target?: string;    // _self / _blank
  icon?: string | null;
  badge?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface FooterSectionRow {
  id: number | string;
  section_key?: string;
  title?: string;
  description?: string;
  image_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
  links?: FooterLinkRow[];
  created_at?: string;
}

export async function listFooterSections(): Promise<FooterSectionRow[]> {
  const { data } = await api.post("footer-sections/list", { page: 1, limit: 50 });
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const rows: Json[] = p.rows ?? p.list ?? p.items ?? p.data ?? (Array.isArray(p) ? p : []);
  return rows as FooterSectionRow[];
}

export async function createFooterSection(
  body: Partial<FooterSectionRow> & { section_key: string; links?: FooterLinkRow[] }
): Promise<string> {
  const { data } = await api.post("footer-sections", body);
  return (data?.message as string) ?? "Footer section created.";
}

export async function updateFooterSection(
  id: number | string,
  body: Partial<FooterSectionRow>
): Promise<string> {
  const { data } = await api.put(`footer-sections/${id}`, body);
  return (data?.message as string) ?? "Footer section updated.";
}

export async function manageFooterLinks(
  sectionId: number | string,
  links: ({ _action: "add" | "update" | "delete"; id?: number | string; [k: string]: unknown })[]
): Promise<string> {
  const { data } = await api.post(`footer-sections/${sectionId}/links`, { links });
  return (data?.message as string) ?? "Links saved.";
}

// ─── Content Pages ────────────────────────────────────────────────────────────

export const CONTENT_TYPES = [
  "page", "blog_post", "faq", "policy", "privacy", "terms",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  page: "Page",
  blog_post: "Blog post",
  faq: "FAQ",
  policy: "Policy",
  privacy: "Privacy",
  terms: "Terms",
};

export interface ContentPageRow {
  id: number | string;
  title: string;
  slug: string;
  content: string;
  content_type: ContentType;
  meta_title?: string | null;
  meta_desc?: string | null;
  meta_keywords?: string | null;
  canonical_url?: string | null;
  featured_image?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string;
  updated_at?: string;
  humanize_content_type?: string;
}

export interface ContentPageInput {
  title: string;
  content: string;
  content_type: ContentType;
  meta_title?: string | null;
  meta_desc?: string | null;
  meta_keywords?: string | null;
  canonical_url?: string | null;
  featured_image?: string | null;
  is_active?: boolean;
}

export async function listContentPages(
  params: ListParams
): Promise<ListResult<ContentPageRow>> {
  const { data } = await api.post("content-pages/list", buildBody(params));
  return parseList<ContentPageRow>(data, params.limit);
}

export async function getContentPage(
  id: number | string
): Promise<ContentPageRow> {
  const { data } = await api.get(`content-pages/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ContentPageRow;
}

export const createContentPage = (body: ContentPageInput) =>
  createRecord("content-pages", body, "Content page created.");

export const updateContentPage = (id: number | string, body: Partial<ContentPageInput>) =>
  updateRecord(`content-pages/${id}`, body, "Content page updated.");

// ─── Order Comments ───────────────────────────────────────────────────────────

export const ORDER_COMMENT_TYPES = [
  "note", "status_update", "customer_message", "internal_flag",
] as const;
export type OrderCommentType = (typeof ORDER_COMMENT_TYPES)[number];

export const ORDER_COMMENT_TYPE_LABELS: Record<OrderCommentType, string> = {
  note: "Note",
  status_update: "Status update",
  customer_message: "Customer message",
  internal_flag: "Internal flag",
};

export interface OrderCommentRow {
  id: number | string;
  order_id: number | string;
  comment: string;
  comment_type?: OrderCommentType;
  is_internal?: boolean;
  attachment_url?: string | null;
  user_id?: number | string | null;
  user?: { full_name?: string; name?: string; email?: string } | null;
  created_by?: number | string | null;
  creator?: { full_name?: string; name?: string; email?: string } | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface OrderCommentInput {
  order_id: number | string;
  comment: string;
  comment_type?: OrderCommentType;
  is_internal?: boolean;
  attachment_url?: string | null;
  is_active?: boolean;
}

/** The timeline for one order, oldest first. */
export async function listOrderComments(
  orderId: number | string
): Promise<OrderCommentRow[]> {
  const { data } = await api.get(`order-comments/order/${orderId}`);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const rows: OrderCommentRow[] = Array.isArray(p)
    ? p
    : p.rows ?? p.comments ?? p.items ?? p.data ?? [];
  return [...rows].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return at - bt;
  });
}

export async function listAllOrderComments(
  params: ListParams
): Promise<ListResult<OrderCommentRow>> {
  const { data } = await api.post("order-comments/list", buildBody(params));
  return parseList<OrderCommentRow>(data, params.limit);
}

export async function createOrderComment(body: OrderCommentInput): Promise<string> {
  const { data } = await api.post("order-comments", body);
  return (data?.message as string) ?? "Comment added.";
}

export async function updateOrderComment(
  id: number | string,
  body: Partial<Omit<OrderCommentInput, "order_id">>
): Promise<string> {
  const { data } = await api.put(`order-comments/${id}`, body);
  return (data?.message as string) ?? "Comment updated.";
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  "stripe", "paypal", "cash", "bank_transfer",
  "stripe_and_cash", "paypal_and_cash", "without_payment",
] as const;

export const PAYMENT_RECORD_STATUSES = [
  "pending", "paid", "failed", "refunded", "partially_refunded", "cancelled",
] as const;

export interface PaymentRow {
  id: number | string;
  order_id?: number | string;
  amount?: string | number;
  gateway_fee?: string | number | null;
  net_received?: string | number | null;
  refunded_amount?: string | number | null;
  currency?: string;
  payment_reference?: string | null;
  payment_method?: string;
  status?: string;
  receipt_url?: string | null;
  failure_reason?: string | null;
  captured_at?: string | null;
  created_at?: string;
  [k: string]: unknown;
}

export async function listPayments(params: ListParams): Promise<ListResult<PaymentRow>> {
  const { data } = await api.post("payments/list", buildBody(params));
  return parseList<PaymentRow>(data, params.limit);
}

/** Every payment recorded against one order. */
export async function listOrderPayments(
  orderId: number | string
): Promise<PaymentRow[]> {
  const res = await listPayments({ page: 1, limit: 100, filters: { order_id: orderId } });
  return res.rows;
}

export async function listPaymentLogs(params: ListParams): Promise<ListResult<Json>> {
  const { data } = await api.post("payments/logs", buildBody(params));
  return parseList<Json>(data, params.limit);
}

// ─── Payment Refunds ──────────────────────────────────────────────────────────

export interface RefundRow {
  id: number | string;
  payment_id: number | string;
  amount?: string | number;
  reason?: string | null;
  status?: string;
  metadata?: Json | null;
  created_at?: string;
  [k: string]: unknown;
}

function refundParse(data: Json): Json {
  return (data?.payload ?? data?.data ?? data ?? {}) as Json;
}

export async function createRefund(body: {
  payment_id: number | string;
  amount: number;
  reason?: string;
  metadata?: Json;
}): Promise<string> {
  const { data } = await api.post("payment-refunds", body);
  return (data?.message as string) ?? "Refund created.";
}

export async function getRefundById(id: number | string): Promise<RefundRow> {
  const { data } = await api.get(`payment-refunds/${id}`);
  return refundParse(data) as RefundRow;
}

export async function listRefundsByPayment(
  paymentId: number | string
): Promise<RefundRow[]> {
  const { data } = await api.get(`payment-refunds/payment/${paymentId}`);
  const p = refundParse(data);
  return (Array.isArray(p) ? p : p.rows ?? p.refunds ?? p.items ?? p.data ?? []) as RefundRow[];
}

export async function cancelRefund(id: number | string): Promise<string> {
  const { data } = await api.put(`payment-refunds/${id}/cancel`);
  return (data?.message as string) ?? "Refund cancelled.";
}

/** Refunds that still count against a payment's balance. */
export function refundedTotal(refunds: RefundRow[]): number {
  return refunds
    .filter((r) => !["cancelled", "canceled", "failed"].includes(String(r.status ?? "").toLowerCase()))
    .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
}

// ─── Home Sections (storefront theme) ─────────────────────────────────────────

export interface HomeSectionItemRow {
  id: number | string;
  home_section_id?: number | string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image_url?: string | null;
  mobile_image_url?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  badge?: string | null;
  sort_order?: number;
  is_active?: boolean;
  [k: string]: unknown;
}

export interface HomeSectionRow {
  id: number | string;
  section_key: string;
  section_name?: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  background_image?: string | null;
  background_color?: string | null;
  layout_type?: string | null;
  sort_order?: number;
  is_active?: boolean;
  section_settings?: Json | null;
  items?: HomeSectionItemRow[];
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface HomeSectionInput {
  section_key: string;
  section_name?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  background_image?: string | null;
  background_color?: string;
  layout_type?: string;
  sort_order?: number;
  is_active?: boolean;
  section_settings?: Json | null;
  items?: Partial<HomeSectionItemRow>[];
}

/** Items are managed in one batched call, each tagged with what to do. */
export type HomeSectionItemAction =
  | ({ _action: "add" } & Partial<HomeSectionItemRow>)
  | ({ _action: "update"; id: number | string } & Partial<HomeSectionItemRow>)
  | { _action: "delete"; id: number | string };

const normalizeSection = (s: Json): HomeSectionRow => ({
  ...(s as HomeSectionRow),
  items: (Array.isArray(s.items)
    ? s.items
    : (s.homeSectionItems ?? s.sectionItems ?? [])) as HomeSectionItemRow[],
});

export async function listHomeSections(
  params: ListParams
): Promise<ListResult<HomeSectionRow>> {
  const { data } = await api.post("home-sections/list", buildBody(params));
  const result = parseList<Json>(data, params.limit);
  return { ...result, rows: result.rows.map(normalizeSection) };
}

/** Every section with its items, ordered — used by the theme editor. */
export async function fetchAllHomeSections(): Promise<HomeSectionRow[]> {
  const res = await listHomeSections({ page: 1, limit: 100 });
  return [...res.rows].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
}

export async function getHomeSection(id: number | string): Promise<HomeSectionRow> {
  const { data } = await api.get(`home-sections/get/${id}`);
  return normalizeSection((data?.payload ?? data?.data ?? data ?? {}) as Json);
}

export async function getHomeSectionByKey(key: string): Promise<HomeSectionRow> {
  const { data } = await api.get(`home-sections/frontend/${key}`);
  return normalizeSection((data?.payload ?? data?.data ?? data ?? {}) as Json);
}

export const createHomeSection = (body: HomeSectionInput) =>
  createRecord("home-sections", body, "Section created.");

export const updateHomeSection = (
  id: number | string,
  body: Partial<HomeSectionInput>
) => updateRecord(`home-sections/${id}`, body, "Section updated.");

export async function manageHomeSectionItems(
  sectionId: number | string,
  items: HomeSectionItemAction[]
): Promise<string> {
  const { data } = await api.post(`home-sections/${sectionId}/items`, { items });
  return (data?.message as string) ?? "Items updated.";
}

// ─── User PIN / Screen lock ───────────────────────────────────────────────────

export interface PinStatus {
  is_pin_set?: boolean;
  pin_enabled?: boolean;
  auto_lock_minutes?: number | null;
  pin_updated_at?: string | null;
  [k: string]: unknown;
}

/** Whether the signed-in user has a screen-lock PIN, and its auto-lock delay. */
export async function getPinStatus(): Promise<PinStatus> {
  const { data } = await api.get("users/pin/status");
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return {
    ...p,
    is_pin_set: p.is_pin_set ?? p.pin_enabled ?? p.has_pin ?? p.isPinSet ?? false,
    auto_lock_minutes: p.auto_lock_minutes ?? p.autoLockMinutes ?? null,
  };
}

export async function setPin(pin: string, confirmPin: string): Promise<string> {
  const { data } = await api.post("users/pin/set", { pin, confirmPin });
  return (data?.message as string) ?? "PIN set.";
}

/** Returns true when the PIN matches — used by the lock screen. */
export async function verifyPin(pin: string): Promise<boolean> {
  const { data } = await api.post("users/pin/verify", { pin });
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return (data?.success ?? p?.valid ?? p?.verified ?? true) !== false;
}

export async function changePin(body: {
  currentPin: string;
  newPin: string;
  confirmNewPin: string;
}): Promise<string> {
  const { data } = await api.put("users/pin/change", body);
  return (data?.message as string) ?? "PIN changed.";
}

export async function disablePin(currentPin: string): Promise<string> {
  const { data } = await api.delete("users/pin", { data: { currentPin } });
  return (data?.message as string) ?? "PIN disabled.";
}

export async function updateAutoLock(minutes: number): Promise<string> {
  const { data } = await api.put("users/pin/auto-lock", {
    auto_lock_minutes: minutes,
  });
  return (data?.message as string) ?? "Auto-lock updated.";
}

/** Admin action — set a new PIN for another user who has been locked out. */
export async function resetUserPin(body: {
  userId: number | string;
  newPin: string;
  confirmNewPin: string;
}): Promise<string> {
  const { data } = await api.put("users/pin/reset", body);
  return (data?.message as string) ?? "PIN reset.";
}

// ─── Wishlists ────────────────────────────────────────────────────────────────

export interface WishlistRow {
  id: number | string;
  user_id?: number | string | null;
  user?: { full_name?: string; name?: string; email?: string } | null;
  product_id: number | string;
  product?: {
    id?: number | string;
    title?: string;
    name?: string;
    price?: number | string | null;
    featured_image?: string | null;
    quantity?: number;
  } | null;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export async function listWishlists(
  params: ListParams
): Promise<ListResult<WishlistRow>> {
  const { data } = await api.post("wishlists/list", buildBody(params));
  return parseList<WishlistRow>(data, params.limit);
}

export async function getWishlistById(id: number | string): Promise<WishlistRow> {
  const { data } = await api.get(`wishlists/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as WishlistRow;
}

/** Saves the product for the signed-in user. */
export async function createWishlist(body: {
  product_id: number | string;
  is_active?: boolean;
}): Promise<string> {
  const { data } = await api.post("wishlists", body);
  return (data?.message as string) ?? "Added to wishlist.";
}

// ─── Single-record fetches filling out earlier modules ────────────────────────

export async function getFooterSection(id: number | string): Promise<FooterSectionRow> {
  const { data } = await api.get(`footer-sections/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as FooterSectionRow;
}

export async function getCampaignById(id: number | string): Promise<CampaignRow> {
  const { data } = await api.get(`newsletters/${id}`);
  return (data?.payload ?? data?.data ?? data) as CampaignRow;
}

export async function getSubscriberById(id: number | string): Promise<SubscriberRow> {
  const { data } = await api.get(`newsletters/subscribers/${id}`);
  return (data?.payload ?? data?.data ?? data) as SubscriberRow;
}

// ─── Branch membership ────────────────────────────────────────────────────────

export async function assignUserToBranch(body: {
  user_id: number | string;
  branch_id: number | string;
}): Promise<string> {
  const { data } = await api.post("branches/assign-user", body);
  return (data?.message as string) ?? "User assigned to branch.";
}

export async function removeUserFromBranch(body: {
  user_id: number | string;
  branch_id: number | string;
}): Promise<string> {
  const { data } = await api.delete(`branches/remove-user/${body.user_id}`, {
    data: body,
  });
  return (data?.message as string) ?? "User removed from branch.";
}

// ─── Discount Tiers ───────────────────────────────────────────────────────────

export const DISCOUNT_TIER_TYPES = ["percentage", "fixed_amount"] as const;
export type DiscountTierType = (typeof DISCOUNT_TIER_TYPES)[number];

export const DISCOUNT_TIER_TYPE_LABELS: Record<string, string> = {
  percentage: "Percentage",
  fixed_amount: "Fixed amount",
};

export interface DiscountTierRow {
  id: number | string;
  name: string;
  discount_type: string;
  discount_value: number | string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

export interface DiscountTierInput {
  name: string;
  discount_type: string;
  discount_value: number;
  is_active?: boolean;
}

export async function listDiscountTiers(
  params: ListParams
): Promise<ListResult<DiscountTierRow>> {
  const { data } = await api.post("discount-tiers/list", buildBody(params));
  return parseList<DiscountTierRow>(data, params.limit);
}

/** Every tier, for the pickers that attach a tier to a customer. */
export async function fetchAllDiscountTiers(): Promise<DiscountTierRow[]> {
  const res = await listDiscountTiers({ page: 1, limit: 100 });
  return res.rows;
}

export async function getDiscountTier(id: number | string): Promise<DiscountTierRow> {
  const { data } = await api.get(`discount-tiers/${id}`);
  return (data?.payload ?? data?.data ?? data) as DiscountTierRow;
}

export const createDiscountTier = (body: DiscountTierInput) =>
  createRecord("discount-tiers", body, "Discount tier created.");

export const updateDiscountTier = (
  id: number | string,
  body: Partial<DiscountTierInput>
) => updateRecord(`discount-tiers/${id}`, body, "Discount tier updated.");

// ─── API Users (storefront credentials) ───────────────────────────────────────

export interface ApiUserRow {
  id: number | string;
  name: string;
  api_key?: string | null;
  website_setting_id?: number | null;
  websiteSetting?: { id?: number | string; site_name?: string } | null;
  branch_id?: number | null;
  branch?: { id?: number | string; name?: string } | null;
  is_active?: boolean;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
}

/** Returned once on create and regenerate — never retrievable again. */
export interface ApiCredentials {
  api_key?: string;
  api_password?: string;
  [k: string]: unknown;
}

function pickCredentials(data: Json): ApiCredentials | null {
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const c: Json = p.credentials ?? p.credential ?? p;
  const key = c?.api_key ?? c?.apiKey ?? null;
  const password = c?.api_password ?? c?.apiPassword ?? c?.api_secret ?? null;
  return key || password ? { ...c, api_key: key, api_password: password } : null;
}

export async function listApiUsers(params: ListParams): Promise<ListResult<ApiUserRow>> {
  const { data } = await api.post("api-users/list", buildBody(params));
  return parseList<ApiUserRow>(data, params.limit);
}

export async function getApiUser(id: number | string): Promise<ApiUserRow> {
  const { data } = await api.get(`api-users/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ApiUserRow;
}

export async function createApiUser(body: {
  name: string;
  website_setting_id: number | string;
  branch_id: number | string;
  is_active?: boolean;
}): Promise<{ message: string; credentials: ApiCredentials | null }> {
  const { data } = await api.post("api-users/", body);
  return {
    message: (data?.message as string) ?? "API user created.",
    credentials: pickCredentials(data),
  };
}

export async function updateApiUser(
  id: number | string,
  body: {
    name?: string;
    website_setting_id?: number | string;
    branch_id?: number | string;
    is_active?: boolean;
  }
): Promise<string> {
  const { data } = await api.put(`api-users/${id}`, body);
  return (data?.message as string) ?? "API user updated.";
}

export async function regenerateApiCredentials(
  id: number | string
): Promise<{ message: string; credentials: ApiCredentials | null }> {
  const { data } = await api.put(`api-users/${id}/regenerate`);
  return {
    message: (data?.message as string) ?? "Credentials regenerated.",
    credentials: pickCredentials(data),
  };
}

/** All stores, for the API-user store picker. */
export async function fetchAllWebsiteSettings(): Promise<WebsiteSettingRow[]> {
  const { data } = await api.post("website-settings/list", { page: 1, limit: 100 });
  return parseList<WebsiteSettingRow>(data, 100).rows;
}

// ─── Contact form submissions ─────────────────────────────────────────────────

export const INQUIRY_STATUSES = ["new", "in_progress", "resolved", "archived"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  archived: "Archived",
};

export const HELP_TOPICS = [
  "custom_order", "dtf_transfer", "bulk_quote", "artwork_help", "shipping", "other",
] as const;

export const HELP_TOPIC_LABELS: Record<string, string> = {
  custom_order: "Custom order",
  dtf_transfer: "DTF transfer",
  bulk_quote: "Bulk quote",
  artwork_help: "Artwork help",
  shipping: "Shipping",
  other: "Other",
};

export interface ContactSubmissionRow {
  id: number | string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  help_topic?: string;
  message: string;
  status?: InquiryStatus;
  admin_notes?: string | null;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export async function listContactSubmissions(
  params: ListParams
): Promise<ListResult<ContactSubmissionRow>> {
  const { data } = await api.post("contact-submissions/list", buildBody(params));
  return parseList<ContactSubmissionRow>(data, params.limit);
}

export async function getContactSubmission(
  id: number | string
): Promise<ContactSubmissionRow> {
  const { data } = await api.get(`contact-submissions/${id}`);
  return (data?.payload ?? data?.data ?? data) as ContactSubmissionRow;
}

export async function updateContactSubmission(
  id: number | string,
  body: { status?: InquiryStatus; admin_notes?: string; is_active?: boolean }
): Promise<string> {
  const { data } = await api.put(`contact-submissions/${id}`, body);
  return (data?.message as string) ?? "Submission updated.";
}

// ─── Net 30 applications ──────────────────────────────────────────────────────

export interface Net30ApplicationRow {
  id: number | string;
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  phone_country_code?: string | null;
  company_tax_id?: string;
  years_in_business?: number;
  requested_credit_amount?: number | string;
  resale_certificate_url?: string | null;
  business_license_url?: string | null;
  status?: InquiryStatus;
  admin_notes?: string | null;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export async function listNet30Applications(
  params: ListParams
): Promise<ListResult<Net30ApplicationRow>> {
  const { data } = await api.post("net30-applications/list", buildBody(params));
  return parseList<Net30ApplicationRow>(data, params.limit);
}

export async function getNet30Application(
  id: number | string
): Promise<Net30ApplicationRow> {
  const { data } = await api.get(`net30-applications/${id}`);
  return (data?.payload ?? data?.data ?? data) as Net30ApplicationRow;
}

export async function updateNet30Application(
  id: number | string,
  body: { status?: InquiryStatus; admin_notes?: string; is_active?: boolean }
): Promise<string> {
  const { data } = await api.put(`net30-applications/${id}`, body);
  return (data?.message as string) ?? "Application updated.";
}

// ─── Product images ───────────────────────────────────────────────────────────

export interface ProductImageDetailRow {
  id: number | string;
  product_id: number | string;
  image_url: string;
  is_primary?: boolean;
  sort_order?: number;
  is_active?: boolean;
  [k: string]: unknown;
}

export async function listProductImages(
  productId: number | string
): Promise<ProductImageDetailRow[]> {
  const { data } = await api.post("product-images/list", {
    page: 1,
    limit: 100,
    filters: { product_id: productId },
  });
  return parseList<ProductImageDetailRow>(data, 100).rows.sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
}

export async function getProductImage(id: number | string): Promise<ProductImageDetailRow> {
  const { data } = await api.get(`product-images/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ProductImageDetailRow;
}

export const createProductImage = (body: {
  product_id: number | string;
  image_url: string;
  is_primary?: boolean;
  sort_order?: number;
  is_active?: boolean;
}) => createRecord("product-images", body, "Image added.");

export async function createProductImagesBulk(
  productId: number | string,
  images: { image_url: string; is_primary?: boolean; sort_order?: number }[]
): Promise<string> {
  const { data } = await api.post("product-images/bulk", {
    product_id: productId,
    images,
  });
  return (data?.message as string) ?? "Images added.";
}

export const updateProductImage = (
  id: number | string,
  body: Partial<ProductImageDetailRow>
) => updateRecord(`product-images/${id}`, body, "Image updated.");

// ─── Product descriptions ─────────────────────────────────────────────────────

export interface ProductDescriptionRow {
  id: number | string;
  product_id: number | string;
  heading: string;
  description: string;
  sort_order?: number;
  is_active?: boolean;
  [k: string]: unknown;
}

export async function listProductDescriptions(
  productId: number | string
): Promise<ProductDescriptionRow[]> {
  const { data } = await api.post("product-descriptions/list", {
    page: 1,
    limit: 100,
    filters: { product_id: productId },
  });
  return parseList<ProductDescriptionRow>(data, 100).rows.sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
}

export async function getProductDescription(
  id: number | string
): Promise<ProductDescriptionRow> {
  const { data } = await api.get(`product-descriptions/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ProductDescriptionRow;
}

export const createProductDescription = (body: {
  product_id: number | string;
  heading: string;
  description: string;
  sort_order?: number;
  is_active?: boolean;
}) => createRecord("product-descriptions", body, "Description added.");

export async function createProductDescriptionsBulk(
  productId: number | string,
  descriptions: { heading: string; description: string; sort_order?: number }[]
): Promise<string> {
  const { data } = await api.post("product-descriptions/bulk", {
    product_id: productId,
    descriptions,
  });
  return (data?.message as string) ?? "Descriptions added.";
}

export const updateProductDescription = (
  id: number | string,
  body: Partial<ProductDescriptionRow>
) => updateRecord(`product-descriptions/${id}`, body, "Description updated.");

// ─── Product FAQs ─────────────────────────────────────────────────────────────

export interface ProductFaqDetailRow {
  id: number | string;
  product_id: number | string;
  question: string;
  answer: string;
  sort_order?: number;
  is_active?: boolean;
  [k: string]: unknown;
}

export async function listProductFaqs(
  productId: number | string
): Promise<ProductFaqDetailRow[]> {
  const { data } = await api.post("product-faqs/list", {
    page: 1,
    limit: 100,
    filters: { product_id: productId },
  });
  return parseList<ProductFaqDetailRow>(data, 100).rows.sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
}

export async function getProductFaq(id: number | string): Promise<ProductFaqDetailRow> {
  const { data } = await api.get(`product-faqs/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ProductFaqDetailRow;
}

export const createProductFaq = (body: {
  product_id: number | string;
  question: string;
  answer: string;
  sort_order?: number;
  is_active?: boolean;
}) => createRecord("product-faqs", body, "FAQ added.");

export async function createProductFaqsBulk(
  productId: number | string,
  faqs: { question: string; answer: string; sort_order?: number }[]
): Promise<string> {
  const { data } = await api.post("product-faqs", { product_id: productId, faqs });
  return (data?.message as string) ?? "FAQs added.";
}

export const updateProductFaq = (
  id: number | string,
  body: Partial<ProductFaqDetailRow>
) => updateRecord(`product-faqs/${id}`, body, "FAQ updated.");

// ─── Product variants, scan and sale pricing ──────────────────────────────────

export async function listProductVariants(
  params: ListParams
): Promise<ListResult<ProductVariantRow>> {
  const { data } = await api.post("product-variants/list", buildBody(params));
  return parseList<ProductVariantRow>(data, params.limit);
}

export async function getProductVariant(
  id: number | string
): Promise<ProductVariantRow> {
  const { data } = await api.get(`product-variants/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ProductVariantRow;
}

/** Barcode/SKU lookup — tries the variant SKU first, then the product SKU. */
export async function scanProduct(body: {
  code?: string;
  product_id?: number | string;
  variant_id?: number | string;
}): Promise<Json> {
  const { data } = await api.post("products/scan", body);
  return (data?.payload ?? data?.data ?? data) as Json;
}

export async function applySale(body: {
  categoryId?: number | string;
  productIds?: (number | string)[];
  type: "PERCENT" | "FIXED";
  discount_percent?: number;
  sale_price?: number;
}): Promise<string> {
  const { data } = await api.post("products/sale/apply", body);
  return (data?.message as string) ?? "Sale applied.";
}

export async function removeSale(body: {
  categoryId?: number | string;
  productIds?: (number | string)[];
}): Promise<string> {
  const { data } = await api.post("products/sale/remove", body);
  return (data?.message as string) ?? "Sale removed.";
}

// ─── Order operations ─────────────────────────────────────────────────────────

export async function assignOrderCourier(
  id: number | string,
  body: {
    courier_id: number | string;
    rate_id?: string;
    carrier_account_id?: string;
    service_name?: string;
    carrier_name?: string;
    service_code?: string;
  }
): Promise<string> {
  const { data } = await api.put(`orders/${id}/courier`, body);
  return (data?.message as string) ?? "Courier assigned.";
}

export async function cancelOrder(
  id: number | string,
  body: { user_id: number | string; reason: string }
): Promise<string> {
  const { data } = await api.put(`orders/${id}/cancel`, body);
  return (data?.message as string) ?? "Order cancelled.";
}

export async function getOrderByCode(code: string): Promise<OrderDetail> {
  const { data } = await api.get(`orders/code/${code}`);
  return (data?.payload ?? data?.data ?? data) as OrderDetail;
}

export async function getOrderStatusByCode(code: string): Promise<Json> {
  const { data } = await api.get(`orders/status/${code}`);
  return (data?.payload ?? data?.data ?? data) as Json;
}

export interface BulkStatusResult {
  updated: (number | string)[];
  failed: { id: number | string; reason?: string }[];
  message: string;
}

/** Moves many orders at once; illegal transitions come back in `failed`. */
export async function bulkUpdateOrderStatus(body: {
  order_ids: (number | string)[];
  status: string;
  notes?: string;
}): Promise<BulkStatusResult> {
  const { data } = await api.post("orders/bulk-status", body);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return {
    updated: (p.updated ?? []) as (number | string)[],
    failed: (p.failed ?? []) as { id: number | string; reason?: string }[],
    message: (data?.message as string) ?? "Orders updated.",
  };
}

// ─── Activity log ─────────────────────────────────────────────────────────────

export interface ActivityLogRow {
  id: number | string;
  entity_type?: string;
  entity_id?: number | string;
  action?: string;
  notes?: string | null;
  performed_by?: number | string | null;
  performer?: { full_name?: string; name?: string; email?: string } | null;
  user?: { full_name?: string; name?: string; email?: string } | null;
  created_at?: string;
  [k: string]: unknown;
}

export async function listActivityLogs(
  params: ListParams
): Promise<ListResult<ActivityLogRow>> {
  const { data } = await api.post("activity-logs/list", buildBody(params));
  return parseList<ActivityLogRow>(data, params.limit);
}

export async function getActivityLog(id: number | string): Promise<ActivityLogRow> {
  const { data } = await api.get(`activity-logs/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ActivityLogRow;
}

// ─── Addresses & cart (customer records) ──────────────────────────────────────

export interface AddressRow {
  id: number | string;
  user_id?: number | string | null;
  full_name?: string;
  phone?: string;
  email?: string | null;
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

/** Admin-wide address list (the plain list endpoint is customer-scoped). */
export async function listAddresses(params: ListParams): Promise<ListResult<AddressRow>> {
  const { data } = await api.post("addresses/admin/list", buildBody(params));
  return parseList<AddressRow>(data, params.limit);
}

export async function getAddress(id: number | string): Promise<AddressRow> {
  const { data } = await api.get(`addresses/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as AddressRow;
}

export interface CartItemRow {
  id: number | string;
  user_id?: number | string | null;
  product_id?: number | string;
  product?: { title?: string; name?: string; price?: number | string; featured_image?: string | null } | null;
  variant_id?: number | string | null;
  quantity?: number;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export async function listCartItems(params: ListParams): Promise<ListResult<CartItemRow>> {
  const { data } = await api.post("cart-items/list", buildBody(params));
  return parseList<CartItemRow>(data, params.limit);
}

export async function getCartItem(id: number | string): Promise<CartItemRow> {
  const { data } = await api.get(`cart-items/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as CartItemRow;
}

// ─── Design uploads ───────────────────────────────────────────────────────────

export interface DesignUploadRow {
  id: number | string;
  user_id?: number | string | null;
  user?: { full_name?: string; name?: string; email?: string } | null;
  order_id?: number | string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  print_method?: string | null;
  notes?: string | null;
  status?: string;
  is_active?: boolean;
  created_at?: string;
  [k: string]: unknown;
}

export async function listDesignUploads(
  params: ListParams
): Promise<ListResult<DesignUploadRow>> {
  const { data } = await api.post("design-uploads/list", buildBody(params));
  return parseList<DesignUploadRow>(data, params.limit);
}

export async function getDesignUpload(id: number | string): Promise<DesignUploadRow> {
  const { data } = await api.get(`design-uploads/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as DesignUploadRow;
}

export const createDesignUpload = (body: Json) =>
  createRecord("design-uploads", body, "Design uploaded.");

export const updateDesignUpload = (id: number | string, body: Json) =>
  updateRecord(`design-uploads/${id}`, body, "Design updated.");

// ─── Duration report ──────────────────────────────────────────────────────────

export interface DurationReport {
  orders: Json[];
  summary: Json;
  pagination?: Json;
}

export async function getDurationReport(body: {
  period?: DashboardPeriod;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  include_orders?: boolean;
  page?: number;
  limit?: number;
  filters?: Json;
}): Promise<DurationReport> {
  const { data } = await api.post("reports/duration", body);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return {
    orders: (Array.isArray(p) ? p : p.orders ?? p.rows ?? p.data ?? []) as Json[],
    summary: (p.summary ?? p.totals ?? {}) as Json,
    pagination: data?.pagination ?? p.pagination,
  };
}

/** Excel export — returns the .xlsx blob. */
export async function exportDurationReport(body: {
  period?: DashboardPeriod;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Json;
}): Promise<Blob> {
  const { data } = await api.post("reports/duration/excel", body, {
    responseType: "blob",
  });
  return data as Blob;
}

// ─── Remaining single-record fetches ──────────────────────────────────────────

export async function getMenuById(id: number | string): Promise<MenuRow> {
  const { data } = await api.get(`menus/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as MenuRow;
}

export async function getMenuRightById(id: number | string): Promise<MenuRightRow> {
  const { data } = await api.get(`menu-rights/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as MenuRightRow;
}

export async function getSizeById(id: number | string): Promise<SizeRow> {
  const { data } = await api.get(`sizes/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as SizeRow;
}

export async function getColorById(id: number | string): Promise<ColorRow> {
  const { data } = await api.get(`colors/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ColorRow;
}

export async function getVendorById(id: number | string): Promise<VendorRow> {
  const { data } = await api.get(`vendors/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as VendorRow;
}

export async function getBranchById(id: number | string): Promise<BranchRow> {
  const { data } = await api.get(`branches/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as BranchRow;
}

export async function getPickupLocationById(
  id: number | string
): Promise<PickupLocationRow> {
  const { data } = await api.get(`pickup-locations/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as PickupLocationRow;
}

export async function getBlogById(id: number | string): Promise<BlogRow> {
  const { data } = await api.get(`blogs/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as BlogRow;
}

export async function getOrderComment(id: number | string): Promise<OrderCommentRow> {
  const { data } = await api.get(`order-comments/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as OrderCommentRow;
}

export async function getProductCategoryById(
  id: number | string
): Promise<ProductCategoryRow> {
  const { data } = await api.get(`product-categories/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as ProductCategoryRow;
}

/** The store settings for the signed-in admin. */
export async function getCurrentWebsiteSettings(): Promise<WebsiteSettingRow> {
  const { data } = await api.get("website-settings/current");
  return (data?.payload ?? data?.data ?? data) as WebsiteSettingRow;
}

export async function getWebsiteSettingsById(
  id: number | string
): Promise<WebsiteSettingRow> {
  const { data } = await api.get(`website-settings/get/${id}`);
  return (data?.payload ?? data?.data ?? data) as WebsiteSettingRow;
}

export async function getCheckoutPromotions(): Promise<Json> {
  const { data } = await api.get("promotions/checkout");
  return (data?.payload ?? data?.data ?? data) as Json;
}

export async function createCheckoutSession(body: Json): Promise<Json> {
  const { data } = await api.post("payments/checkout-session", body);
  return (data?.payload ?? data?.data ?? data) as Json;
}
