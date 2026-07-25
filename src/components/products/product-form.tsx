"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  ExternalLink,
  GripVertical,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiErrorMessage } from "@/lib/auth-api";
import { uploadImage, deleteFile, imageUrlToPath } from "@/lib/upload-api";
import {
  createProduct,
  updateProduct,
  fetchAllProductCategories,
  fetchAllVendors,
  listColors,
  listSizes,
  createColorAndReturn,
  createSizeAndReturn,
  PRODUCT_STATUSES,
  type ProductDetailRow,
  type ProductImageRow,
  type ProductCategoryRow,
  type VendorRow,
  type ColorRow,
  type SizeRow,
} from "@/lib/admin-api";
import {
  Dialog as InlineDialog,
  DialogContent as InlineDialogContent,
  DialogHeader as InlineDialogHeader,
  DialogTitle as InlineDialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn, imgUrl } from "@/lib/utils";

// ─── Schema ──────────────────────────────────────────────────────────────────

const VARIANT_STATUSES = ["active", "inactive", "out_of_stock"] as const;

const variantSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  color_id: z.string().min(1, "Color required"),
  size_id: z.string().min(1, "Size required"),
  sku: z.string().optional(),
  price: z.string().optional(),
  sale_price: z.string().optional(),
  status: z.enum(VARIANT_STATUSES),
});

const faqSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  question: z.string().min(1, "Question required"),
  answer: z.string().min(1, "Answer required"),
});

const productFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(PRODUCT_STATUSES),
  // Pricing
  price: z.string().optional(),
  compare_at_price: z.string().optional(),
  cost_per_item: z.string().optional(),
  // Inventory
  sku: z.string().optional(),
  quantity: z.string().optional(),
  // Discounts
  discount_percent: z.string().optional(),
  discount_amount: z.string().optional(),
  // Shipping
  requires_shipping: z.boolean(),
  weight: z.string().optional(),
  // Organization
  vendor: z.string().optional(),
  category: z.string().optional(),
  tags: z.string().optional(),
  // SEO
  slug: z.string().min(1, "URL handle is required"),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  // Arrays
  variants: z.array(variantSchema),
  faqs: z.array(faqSchema),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const parseNum = (v?: string) => {
  if (!v || v.trim() === "") return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

// ─── Image Grid ──────────────────────────────────────────────────────────────

function ProductImageGrid({
  images,
  onAdd,
  onRemove,
  uploading,
}: {
  images: ProductImageRow[];
  onAdd: (files: FileList) => void;
  onRemove: (idx: number) => void;
  uploading: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {images.map((img, i) => (
        <div key={i} className="group relative aspect-square">
          {imgUrl(img.url) ? (
            // eslint-disable-next-line @next/next/no-img-element -- product image URLs are external, next/image needs configured domain
            <img
              src={imgUrl(img.url)}
              alt={img.alt ?? `Product image ${i + 1}`}
              className="size-full rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="size-full rounded-lg border border-border bg-muted" />
          )}
          {i === 0 && (
            <Badge className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px]">
              Featured
            </Badge>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-1 right-1 hidden size-6 cursor-pointer items-center justify-center rounded-full bg-[#1a1a1a]/80 text-white transition-all duration-150 group-hover:flex"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      {/* Loading slot — shown while uploading */}
      {uploading && (
        <div className="flex aspect-square items-center justify-center rounded-lg border border-border bg-muted/60">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Add tile — hidden while uploading */}
      {!uploading && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-input bg-muted/40 text-muted-foreground transition-colors duration-150 hover:border-ring hover:text-foreground"
        >
          <ImagePlus className="size-5" />
          <span className="text-xs">Add</span>
        </button>
      )}

      <input
        ref={ref}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Profit Calculator ────────────────────────────────────────────────────────

function ProfitDisplay({ price, cost }: { price?: string; cost?: string }) {
  const p = parseNum(price);
  const c = parseNum(cost);
  if (!p || !c || c <= 0) return null;
  const profit = p - c;
  const margin = (profit / p) * 100;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Profit:{" "}
      <span className={profit >= 0 ? "text-[#29845a]" : "text-destructive"}>
        ${profit.toFixed(2)}
      </span>{" "}
      · Margin:{" "}
      <span className={margin >= 0 ? "text-[#29845a]" : "text-destructive"}>
        {margin.toFixed(1)}%
      </span>
    </p>
  );
}

// ─── Combobox primitive ──────────────────────────────────────────────────────

function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  loading = false,
  disabled = false,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        disabled={disabled || loading}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {loading ? (
          <span className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Loading…
          </span>
        ) : (
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected?.label ?? placeholder}
          </span>
        )}
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === opt.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Category Select ─────────────────────────────────────────────────────────

function CategorySelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | null) => void;
}) {
  const [cats, setCats] = React.useState<ProductCategoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchAllProductCategories()
      .then(setCats)
      .catch(() => setCats([]))
      .finally(() => setLoading(false));
  }, []);

  const resolvedValue = value
    ? cats.find((c) => String(c.id) === value || c.name === value)
      ? String(cats.find((c) => String(c.id) === value || c.name === value)!.id)
      : value
    : "__none__";

  const options = [
    { value: "__none__", label: "No category" },
    ...cats.map((c) => ({
      value: String(c.id),
      label: c.parent?.name ? `${c.parent.name} › ${c.name}` : c.name,
    })),
  ];

  return (
    <Combobox
      options={options}
      value={resolvedValue}
      onChange={(v) => onChange(v === "__none__" ? null : v)}
      placeholder="Select category"
      searchPlaceholder="Search categories…"
      loading={loading}
    />
  );
}

// ─── Vendor Select ───────────────────────────────────────────────────────────

function VendorSelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string | null) => void;
}) {
  const [vendors, setVendors] = React.useState<VendorRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchAllVendors()
      .then(setVendors)
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, []);

  const resolvedValue = value
    ? vendors.find((v) => String(v.id) === value || v.name === value)
      ? String(vendors.find((v) => String(v.id) === value || v.name === value)!.id)
      : value
    : "__none__";

  const options = [
    { value: "__none__", label: "No vendor" },
    ...vendors.map((v) => ({ value: String(v.id), label: v.name })),
  ];

  return (
    <Combobox
      options={options}
      value={resolvedValue}
      onChange={(v) => onChange(v === "__none__" ? null : v)}
      placeholder="Select vendor"
      searchPlaceholder="Search vendors…"
      loading={loading}
    />
  );
}

// ─── Color Combobox with inline create ───────────────────────────────────────

function ColorCombobox({
  value,
  onChange,
  colors,
  onCreated,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  colors: ColorRow[];
  onCreated: (c: ColorRow) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newHex, setNewHex] = React.useState("#000000");
  const [saving, setSaving] = React.useState(false);

  const filtered = colors.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const selected = colors.find((c) => String(c.id) === value);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await createColorAndReturn({ name: newName.trim(), hex_code: newHex });
      onCreated(created);
      onChange(String(created.id));
      setCreating(false);
      setOpen(false);
      setNewName("");
      setNewHex("#000000");
    } catch {
      toast.error("Failed to create color.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex h-8 w-full min-w-[100px] items-center justify-between rounded-md border bg-card px-2 text-sm",
            "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring",
            hasError ? "border-destructive" : "border-input"
          )}
        >
          {selected ? (
            <span className="flex items-center gap-1.5 truncate">
              <span
                className="inline-block size-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: selected.hex_code }}
              />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Color</span>
          )}
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search colors…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={String(c.id)}
                    onSelect={() => { onChange(String(c.id)); setOpen(false); setSearch(""); }}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="inline-block size-3 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: c.hex_code }}
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    {value === String(c.id) && <Check className="size-3 text-primary" />}
                  </CommandItem>
                ))}
                {filtered.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">No colors found</p>
                )}
              </CommandGroup>
            </CommandList>
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => { setCreating(true); setOpen(false); setNewName(search); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-medium text-primary hover:bg-accent"
              >
                <Plus className="size-3" /> Add new color
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <InlineDialog open={creating} onOpenChange={setCreating}>
        <InlineDialogContent className="sm:max-w-xs">
          <InlineDialogHeader>
            <InlineDialogTitle>New color</InlineDialogTitle>
          </InlineDialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                autoFocus
                placeholder="e.g. Royal Blue"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hex color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  className="size-9 cursor-pointer rounded-md border border-border p-0.5"
                />
                <Input
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  placeholder="#000000"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={!newName.trim() || saving} onClick={handleCreate}>
                {saving && <Loader2 className="size-3 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </InlineDialogContent>
      </InlineDialog>
    </>
  );
}

// ─── Size Combobox with inline create ────────────────────────────────────────

function SizeCombobox({
  value,
  onChange,
  sizes,
  onCreated,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  sizes: SizeRow[];
  onCreated: (s: SizeRow) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDisplay, setNewDisplay] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const filtered = sizes.filter((s) =>
    (s.display_name ?? s.name).toLowerCase().includes(search.toLowerCase())
  );
  const selected = sizes.find((s) => String(s.id) === value);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await createSizeAndReturn({
        name: newName.trim(),
        display_name: newDisplay.trim() || newName.trim(),
      });
      onCreated(created);
      onChange(String(created.id));
      setCreating(false);
      setOpen(false);
      setNewName("");
      setNewDisplay("");
    } catch {
      toast.error("Failed to create size.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex h-8 w-full min-w-[90px] items-center justify-between rounded-md border bg-card px-2 text-sm",
            "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring",
            hasError ? "border-destructive" : "border-input"
          )}
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? (selected.display_name ?? selected.name) : "Size"}
          </span>
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-44 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search sizes…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filtered.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={String(s.id)}
                    onSelect={() => { onChange(String(s.id)); setOpen(false); setSearch(""); }}
                    className="flex items-center gap-2"
                  >
                    <span className="flex-1 truncate">{s.display_name ?? s.name}</span>
                    {value === String(s.id) && <Check className="size-3 text-primary" />}
                  </CommandItem>
                ))}
                {filtered.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">No sizes found</p>
                )}
              </CommandGroup>
            </CommandList>
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => { setCreating(true); setOpen(false); setNewName(search); setNewDisplay(search); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-medium text-primary hover:bg-accent"
              >
                <Plus className="size-3" /> Add new size
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <InlineDialog open={creating} onOpenChange={setCreating}>
        <InlineDialogContent className="sm:max-w-xs">
          <InlineDialogHeader>
            <InlineDialogTitle>New size</InlineDialogTitle>
          </InlineDialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Code <span className="text-muted-foreground">(e.g. XL)</span></label>
              <Input
                autoFocus
                placeholder="XL"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display name <span className="text-muted-foreground">(e.g. Extra Large)</span></label>
              <Input
                placeholder="Extra Large"
                value={newDisplay}
                onChange={(e) => setNewDisplay(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={!newName.trim() || saving} onClick={handleCreate}>
                {saving && <Loader2 className="size-3 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </InlineDialogContent>
      </InlineDialog>
    </>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Section({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("shadow-none", className)}>
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(!title && "pt-6")}>{children}</CardContent>
    </Card>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function ProductForm({ product }: { product?: ProductDetailRow }) {
  const router = useRouter();
  const isEdit = !!product;

  // Images are managed outside react-hook-form
  const [images, setImages] = React.useState<ProductImageRow[]>(
    product?.images ?? []
  );
  const [removedImageUrls, setRemovedImageUrls] = React.useState<string[]>([]);
  const [imgUploading, setImgUploading] = React.useState(false);

  // Colors + sizes for variant selects
  const [colors, setColors] = React.useState<ColorRow[]>([]);
  const [sizes, setSizes] = React.useState<SizeRow[]>([]);
  React.useEffect(() => {
    listColors({ page: 1, limit: 200, filters: { is_active: true } })
      .then((r) => setColors(r.rows))
      .catch(() => {});
    listSizes({ page: 1, limit: 200, filters: { is_active: true } })
      .then((r) => setSizes(r.rows))
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      title: product?.title ?? "",
      description: product?.description ?? "",
      status: product?.status ?? "draft",
      price: product?.price != null ? String(product.price) : "",
      compare_at_price: product?.compare_at_price != null ? String(product.compare_at_price) : "",
      cost_per_item: product?.cost_per_item != null ? String(product.cost_per_item) : "",
      sku: product?.sku ?? "",
      quantity: product?.quantity != null ? String(product.quantity) : "",
      discount_percent: (product as { discount_percent?: number | null })?.discount_percent != null
        ? String((product as { discount_percent?: number | null }).discount_percent) : "",
      discount_amount: (product as { discount_amount?: number | null })?.discount_amount != null
        ? String((product as { discount_amount?: number | null }).discount_amount) : "",
      requires_shipping: product?.requires_shipping ?? false,
      weight: product?.weight != null ? String(product.weight) : "",
      vendor: typeof product?.vendor === "object" && product?.vendor !== null
        ? String((product.vendor as { id?: number | string }).id ?? "")
        : product?.vendor ?? "",
      category: product?.category_id != null
        ? String(product.category_id)
        : typeof product?.category === "object" && product?.category !== null
          ? String((product.category as { id?: number | string }).id ?? "")
          : product?.category ?? "",
      tags: Array.isArray(product?.tags)
        ? (product.tags as string[]).join(", ")
        : product?.tags ?? "",
      slug: product?.slug
        ?? (product?.canonical_url ? (product.canonical_url.split("/products/")[1] ?? "") : ""),
      meta_title: product?.meta_title ?? "",
      meta_description: product?.meta_description ?? "",
      variants: (product?.variants ?? []).map((v) => ({
        id: v.id,
        color_id: v.color_id != null ? String(v.color_id) : "",
        size_id: v.size_id != null ? String(v.size_id) : "",
        sku: v.sku ?? "",
        price: v.price != null ? String(v.price) : "",
        sale_price: v.sale_price != null ? String(v.sale_price) : "",
        status: (v.status as typeof VARIANT_STATUSES[number]) ?? "active",
      })),
      faqs: (product?.faqs ?? []).map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
      })),
    },
  });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
    move: moveVariant,
  } = useFieldArray({ control, name: "variants" });

  const dragIdx = React.useRef<number | null>(null);

  const {
    fields: faqFields,
    append: appendFaq,
    remove: removeFaq,
  } = useFieldArray({ control, name: "faqs" });

  // Auto-slug from title while creating
  const title = useWatch({ control, name: "title" });
  const priceVal = useWatch({ control, name: "price" });
  const costVal = useWatch({ control, name: "cost_per_item" });
  const requiresShipping = useWatch({ control, name: "requires_shipping" });
  const metaTitle = useWatch({ control, name: "meta_title" });
  const metaDesc = useWatch({ control, name: "meta_description" });
  const slugVal = useWatch({ control, name: "slug" });

  React.useEffect(() => {
    if (!isEdit && !getFieldState("slug").isDirty) {
      setValue("slug", slugify(title));
    }
  }, [title, isEdit, getFieldState, setValue]);

  // Upload images — show blob preview immediately, swap with real URL when done
  const handleImagesAdd = async (files: FileList) => {
    setImgUploading(true);
    const arr = Array.from(files);

    // 1. Add blob previews instantly so the user sees them right away
    const blobs = arr.map((f) => URL.createObjectURL(f));
    setImages((prev) => [
      ...prev,
      ...blobs.map((url, i) => ({
        url,
        alt: null,
        sort_order: prev.length + i,
        is_featured: prev.length === 0 && i === 0,
      })),
    ]);

    // 2. Upload each file individually; swap blob URL with real URL as each finishes
    const results = await Promise.allSettled(arr.map((f) => uploadImage(f, "products")));

    setImages((prev) => {
      const next = [...prev];
      results.forEach((result, i) => {
        const idx = next.findIndex((img) => img.url === blobs[i]);
        if (result.status === "fulfilled") {
          if (idx !== -1) next[idx] = { ...next[idx], url: result.value };
          URL.revokeObjectURL(blobs[i]);
        } else {
          // Remove failed blob preview
          if (idx !== -1) next.splice(idx, 1);
          URL.revokeObjectURL(blobs[i]);
        }
      });
      return next;
    });

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(`${failed} image${failed > 1 ? "s" : ""} failed to upload.`);
    }

    setImgUploading(false);
  };

  const onSubmit = async (values: ProductFormValues) => {
    const hasVariants = values.variants.length > 0;
    const body = {
      // API field names
      name: values.title,
      slug: values.slug || undefined,
      description: values.description || undefined,
      short_desc: undefined as string | undefined,
      status: values.status,
      // Pricing — API uses base_price / sale_price / cost_price
      base_price: parseNum(values.price) ?? 0,
      sale_price: parseNum(values.compare_at_price) ?? undefined,
      cost_price: parseNum(values.cost_per_item) ?? undefined,
      sku: values.sku || undefined,
      // Product-level stock is only sent when the product has NO variants —
      // when variants exist, stock is tracked per-variant via the inventory API.
      quantity: hasVariants ? undefined : parseNum(values.quantity) ?? undefined,
      discount_percent: parseNum(values.discount_percent) ?? undefined,
      discount_amount: parseNum(values.discount_amount) ?? undefined,
      weight: parseNum(values.weight) ?? undefined,
      vendor_id: values.vendor ? Number(values.vendor) || undefined : undefined,
      category_id: values.category ? Number(values.category) || undefined : undefined,
      tags: values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined,
      meta_title: values.meta_title || undefined,
      meta_desc: values.meta_description || undefined,
      is_active: true,
      is_featured: false,
      is_customizable: true,
      images: images
        .filter((img) => img.url && !img.url.startsWith("blob:"))
        .map((img, i) => ({
          image_url: img.url,
          alt: img.alt || undefined,
          sort_order: i,
          is_primary: i === 0,
        })),
      // variants sent separately via /product-variants/bulk after product save
      faqs: values.faqs.map((f, i) => ({
        ...(f.id ? { id: f.id } : {}),
        question: f.question,
        answer: f.answer,
        sort_order: i,
      })),
    };

    const makeVariantBody = (v: typeof values.variants[number]) => ({
      color_id: Number(v.color_id),
      size_id: Number(v.size_id),
      sku: v.sku || undefined,
      price: parseNum(v.price),
      sale_price: parseNum(v.sale_price),
      status: v.status,
      is_active: true,
    });

    try {
      // Delete removed images from storage
      if (removedImageUrls.length > 0) {
        await Promise.allSettled(
          removedImageUrls.map((url) => {
            const path = imageUrlToPath(url);
            return path ? deleteFile(path) : Promise.resolve();
          })
        );
        setRemovedImageUrls([]);
      }

      if (isEdit) {
        const msg = await updateProduct(product.id, body);

        // Existing variants → PUT each one individually
        const existingVariants = values.variants.filter((v) => v.id);
        for (const v of existingVariants) {
          await api.put(`product-variants/${v.id}`, makeVariantBody(v));
        }

        // New variants (no id) → bulk create
        const newVariants = values.variants.filter((v) => !v.id).map(makeVariantBody);
        if (newVariants.length > 0) {
          await api.post("product-variants/bulk", {
            product_id: product.id,
            variants: newVariants,
          });
        }

        toast.success(msg);
        router.push("/products");
      } else {
        const { id, message } = await createProduct(body);
        const newVariants = values.variants.map(makeVariantBody);
        if (newVariants.length > 0) {
          await api.post("product-variants/bulk", {
            product_id: id,
            variants: newVariants,
          });
        }
        toast.success(message ?? "Product created successfully.");
        router.push("/products");
      }
    } catch (err) {
      toast.error(
        apiErrorMessage(err, `Couldn't ${isEdit ? "update" : "create"} the product.`)
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* ── Top bar ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => router.push("/products")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-bold">
          {isEdit ? product.title : "Add product"}
        </h1>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/products")}
          >
            Discard
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save" : "Save product"}
          </Button>
        </div>
      </div>

      {/* ── Layout: left content + right sidebar ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── Left column ── */}
        <div className="flex flex-1 flex-col gap-4 min-w-0">

          {/* Title & Description */}
          <Section>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-title">Title</Label>
                <Input
                  id="p-title"
                  placeholder="Short sleeve t-shirt"
                  aria-invalid={!!errors.title}
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Controller
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <RichTextEditor
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Describe your product…"
                    />
                  )}
                />
              </div>
            </div>
          </Section>

          {/* Media */}
          <Section title="Media">
            {images.length === 0 && !imgUploading ? (
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/40 py-10 text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                onClick={() => {
                  const inp = document.getElementById(
                    "product-img-input"
                  ) as HTMLInputElement;
                  inp?.click();
                }}
              >
                <ImagePlus className="size-8" />
                <p className="text-sm font-medium">Click to add images</p>
                <p className="text-xs">PNG, JPG, WebP supported</p>
                <input
                  id="product-img-input"
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files?.length && handleImagesAdd(e.target.files)
                  }
                />
              </div>
            ) : (
              <ProductImageGrid
                images={images}
                onAdd={handleImagesAdd}
                onRemove={(i) => setImages((prev) => {
                  const removed = prev[i];
                  if (removed?.url && !removed.url.startsWith("blob:")) {
                    setRemovedImageUrls((r) => [...r, removed.url]);
                  }
                  return prev.filter((_, idx) => idx !== i);
                })}
                uploading={imgUploading}
              />
            )}
            {images.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                First image is the featured image. Click × to remove.
              </p>
            )}
          </Section>

          {/* Pricing */}
          <Section title="Pricing">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-price">Price</Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input id="p-price" type="number" step="0.01" min="0" placeholder="0.00" className="pl-6" {...register("price")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-compare">Compare-at price</Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input id="p-compare" type="number" step="0.01" min="0" placeholder="0.00" className="pl-6" {...register("compare_at_price")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cost">Cost per item</Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input id="p-cost" type="number" step="0.01" min="0" placeholder="0.00" className="pl-6" {...register("cost_per_item")} />
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-discount-pct">Discount (%)</Label>
                <div className="relative">
                  <Input id="p-discount-pct" type="number" step="0.01" min="0" max="100" placeholder="0" className="pr-6" {...register("discount_percent")} />
                  <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-discount-amt">Discount amount</Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input id="p-discount-amt" type="number" step="0.01" min="0" placeholder="0.00" className="pl-6" {...register("discount_amount")} />
                </div>
              </div>
            </div>
            <ProfitDisplay price={priceVal} cost={costVal} />
          </Section>

          {/* Inventory */}
          <Section title="Inventory">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="p-sku">SKU (Stock Keeping Unit)</Label>
                <Input id="p-sku" placeholder="SKU-001" className="max-w-xs" {...register("sku")} />
              </div>
              {variantFields.length === 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="p-qty">Quantity</Label>
                  <Input id="p-qty" type="number" min="0" step="1" placeholder="0" className="max-w-xs" {...register("quantity")} />
                  <p className="text-xs text-muted-foreground">
                    Initial stock for this product. Use the stock manager on the products list to adjust it later.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Stock is tracked per variant. Use the stock manager on the products list to set quantities for each variant.
                </div>
              )}
            </div>
          </Section>

          {/* Shipping */}
          <Section title="Shipping">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">This is a physical product</p>
                  <p className="text-xs text-muted-foreground">
                    Customers will be prompted to enter a shipping address
                  </p>
                </div>
                <Controller
                  control={control}
                  name="requires_shipping"
                  render={({ field }) => (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => field.onChange(!field.value)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        field.value ? "bg-primary" : "bg-input"
                      )}
                    >
                      <span className={cn("pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg transition-transform duration-200", field.value ? "translate-x-5" : "translate-x-0")} />
                    </button>
                  )}
                />
              </div>
              {requiresShipping && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label>Weight <span className="text-xs text-muted-foreground">(lbs)</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.0"
                      className="max-w-36"
                      {...register("weight")}
                    />
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* Variants */}
          <Section title="Variants">
            <div className="space-y-3">
              {variantFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No variants yet. Add variants for different color + size combinations.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="w-8 px-3 py-2 text-left font-medium text-muted-foreground"></th>
                        <th className="min-w-32 px-3 py-2 text-left font-medium">Color</th>
                        <th className="min-w-28 px-3 py-2 text-left font-medium">Size</th>
                        <th className="min-w-24 px-3 py-2 text-left font-medium">SKU</th>
                        <th className="min-w-24 px-3 py-2 text-left font-medium">Price</th>
                        <th className="min-w-24 px-3 py-2 text-left font-medium">Sale price</th>
                        <th className="min-w-28 px-3 py-2 text-left font-medium">Status</th>
                        <th className="w-8 px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantFields.map((field, idx) => (
                        <tr
                          key={field.id}
                          draggable
                          onDragStart={() => { dragIdx.current = idx; }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragIdx.current !== null && dragIdx.current !== idx) {
                              moveVariant(dragIdx.current, idx);
                              dragIdx.current = idx;
                            }
                          }}
                          onDragEnd={() => { dragIdx.current = null; }}
                          className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-2 py-2 text-muted-foreground">
                            <GripVertical className="size-4 cursor-grab active:cursor-grabbing" />
                          </td>
                          {/* Color */}
                          <td className="px-2 py-2">
                            <Controller
                              name={`variants.${idx}.color_id`}
                              control={control}
                              render={({ field: f }) => (
                                <ColorCombobox
                                  value={f.value}
                                  onChange={f.onChange}
                                  colors={colors}
                                  onCreated={(c) => setColors((prev) => [...prev, c])}
                                  hasError={!!errors.variants?.[idx]?.color_id}
                                />
                              )}
                            />
                          </td>
                          {/* Size */}
                          <td className="px-2 py-2">
                            <Controller
                              name={`variants.${idx}.size_id`}
                              control={control}
                              render={({ field: f }) => (
                                <SizeCombobox
                                  value={f.value}
                                  onChange={f.onChange}
                                  sizes={sizes}
                                  onCreated={(s) => setSizes((prev) => [...prev, s])}
                                  hasError={!!errors.variants?.[idx]?.size_id}
                                />
                              )}
                            />
                          </td>
                          {/* SKU */}
                          <td className="px-2 py-2">
                            <Input
                              placeholder="SKU"
                              className="h-8 font-mono text-sm"
                              {...register(`variants.${idx}.sku`)}
                            />
                          </td>
                          {/* Price */}
                          <td className="px-2 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="h-8 pl-5 text-sm"
                                {...register(`variants.${idx}.price`)}
                              />
                            </div>
                          </td>
                          {/* Sale price */}
                          <td className="px-2 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="h-8 pl-5 text-sm"
                                {...register(`variants.${idx}.sale_price`)}
                              />
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-2 py-2">
                            <Controller
                              name={`variants.${idx}.status`}
                              control={control}
                              render={({ field: f }) => (
                                <Select value={f.value} onValueChange={f.onChange}>
                                  <SelectTrigger className="h-8 text-sm capitalize">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {VARIANT_STATUSES.map((s) => (
                                      <SelectItem key={s} value={s} className="capitalize">
                                        {s.replace(/_/g, " ")}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeVariant(idx)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendVariant({ color_id: "", size_id: "", sku: "", price: "", sale_price: "", status: "active" })}
              >
                <Plus className="size-4" />
                Add variant
              </Button>
            </div>
          </Section>

          {/* FAQ */}
          <Section title="Frequently Asked Questions">
            <div className="space-y-3">
              {faqFields.map((field, idx) => (
                <div key={field.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Q{idx + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFaq(idx)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <Input
                    placeholder="What is the return policy?"
                    aria-invalid={!!errors.faqs?.[idx]?.question}
                    {...register(`faqs.${idx}.question`)}
                  />
                  {errors.faqs?.[idx]?.question && (
                    <p className="text-xs text-destructive">{errors.faqs[idx]?.question?.message}</p>
                  )}
                  <Textarea
                    rows={2}
                    placeholder="We accept returns within 30 days…"
                    aria-invalid={!!errors.faqs?.[idx]?.answer}
                    {...register(`faqs.${idx}.answer`)}
                  />
                  {errors.faqs?.[idx]?.answer && (
                    <p className="text-xs text-destructive">{errors.faqs[idx]?.answer?.message}</p>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendFaq({ question: "", answer: "" })}
              >
                <Plus className="size-4" />
                Add FAQ
              </Button>
            </div>
          </Section>
        </div>

        {/* ── Right sidebar ── */}
        <div className="flex flex-col gap-4 lg:w-96 lg:shrink-0">

          {/* Status */}
          <Section title="Status">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  items={{ published: "Published", draft: "Draft", archived: "Archived" }}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Section>

          {/* Organization */}
          <Section title="Organization">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <CategorySelect value={field.value} onChange={field.onChange} />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Controller
                  control={control}
                  name="vendor"
                  render={({ field }) => (
                    <VendorSelect value={field.value} onChange={(v) => field.onChange(v ?? "")} />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-tags">Tags</Label>
                <Input id="p-tags" placeholder="t-shirt, custom, summer" {...register("tags")} />
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </div>
            </div>
          </Section>

          {/* SEO */}
          <Section title="Search engine listing">
            <div className="space-y-3">
              {/* Preview */}
              <div className="rounded-lg bg-muted/40 p-3 text-xs">
                <p className="text-[#1a0dab] dark:text-[#8ab4f8] font-medium truncate">
                  {metaTitle || title || "Product title"}
                </p>
                <p className="text-[#006621] dark:text-[#4db97e] truncate">
                  {product?.canonical_url
                    ? (() => { try { return new URL(product.canonical_url).host; } catch { return "yourstore.com"; } })()
                    : "yourstore.com"}/products/{slugVal || "product-handle"}
                </p>
                <p className="text-muted-foreground line-clamp-2 mt-0.5">
                  {metaDesc || "Product description will appear here in search results."}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="p-slug">URL handle</Label>
                  {product?.canonical_url && (
                    <a
                      href={product.canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      View on store <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground shrink-0">/products/</span>
                  <Input
                    id="p-slug"
                    placeholder="product-handle"
                    className="font-mono text-xs"
                    {...register("slug")}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-meta-title">Meta title</Label>
                <Input id="p-meta-title" placeholder="Defaults to title" {...register("meta_title")} />
                <p className="text-xs text-muted-foreground text-right">
                  {metaTitle?.length ?? 0}/70
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-meta-desc">Meta description</Label>
                <Textarea
                  id="p-meta-desc"
                  rows={3}
                  placeholder="Describe this product for search engines…"
                  {...register("meta_description")}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {metaDesc?.length ?? 0}/160
                </p>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* ── Bottom save bar ── */}
      <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={() => router.push("/products")}>
          Discard
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? "Save changes" : "Save product"}
        </Button>
      </div>
    </form>
  );
}
