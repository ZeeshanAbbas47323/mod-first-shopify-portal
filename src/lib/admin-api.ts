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
  "customer",
] as const;

export interface UserRow {
  id: number | string;
  full_name: string;
  email: string;
  phone?: string;
  role?: string;
  branch_id?: number | null;
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
  total?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  shipping?: number;
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
  if (Object.keys(filters).length) body.filters = filters;
  const { data } = await api.post("orders/list", body);
  return parseList<OrderRow>(data, params.limit);
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
  external_url?: string | null;
  open_in_new_tab?: boolean;
  visibility?: boolean;
  is_active?: boolean;
  created_at?: string;
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
  color_id?: number | string | null;
  size_id?: number | string | null;
  title?: string;
  sku?: string | null;
  barcode?: string | null;
  price?: number | null;
  sale_price?: number | null;
  compare_at_price?: number | null;
  quantity?: number;
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
  const rows = rawRows.map((r): ProductRow => ({
    ...r as ProductRow,
    title: (r.title ?? r.name ?? "") as string,
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
  }));
  const pagination = data?.pagination ?? {};
  const total: number =
    pagination.total ?? payload.total ?? payload.count ?? payload.totalRecords ?? rows.length;
  const totalPages: number =
    pagination.totalPages ?? payload.totalPages ?? Math.max(1, Math.ceil(total / params.limit));
  return { rows, total, totalPages };
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

export async function getDashboardOverview(body: DashboardBody = {}): Promise<DashboardOverview> {
  const { data } = await api.post("dashboard/overview", body);
  return dashParse<DashboardOverview>(data);
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
  site_name?: string;
  site_tagline?: string;
  site_description?: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  footer_logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  font_primary?: string;
  font_heading?: string;
  contact_email?: string;
  support_email?: string;
  contact_phone?: string;
  whatsapp_number?: string;
  address?: string;
  city?: string;
  country_code?: string;
  postal_code?: string;
  province_code?: string;
  business_hours?: string;
  facebook_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  youtube_url?: string;
  tiktok_url?: string;
  pinterest_url?: string;
  playstore_url?: string;
  appstore_url?: string;
  currency?: string;
  currency_symbol?: string;
  tax_percentage?: number | null;
  default_shipping_fee?: number | null;
  free_shipping_threshold?: number | null;
  min_order_amount?: number | null;
  first_order_discount_enabled?: boolean;
  first_order_discount_type?: string;
  first_order_discount_value?: number | null;
  first_order_max_discount?: number | null;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  is_active?: boolean;
}

export async function fetchWebsiteSettings(): Promise<WebsiteSettingRow | null> {
  const { data } = await api.post("website-settings/list", { page: 1, limit: 1 });
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  const rows: Json[] = p.rows ?? p.list ?? p.data ?? p.items ?? (Array.isArray(p) ? p : []);
  if (!rows.length) return null;
  return rows[0] as WebsiteSettingRow;
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

export interface PopupRow {
  id: number | string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  position?: "center" | "bottom-left" | "bottom-right" | string;
  is_active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
}

export async function listPopups(params: ListParams): Promise<ListResult<PopupRow>> {
  const { data } = await api.post("popups/list", buildBody(params));
  return parseList<PopupRow>(data, params.limit);
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
