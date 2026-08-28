"use client";

import * as React from "react";
import {
  type Control,
  type UseFormRegister,
  Controller,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import {
  ChevronDown,
  ImagePlus,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ColorCombobox, SizeCombobox } from "@/components/products/option-comboboxes";
import { apiErrorMessage } from "@/lib/auth-api";
import { uploadImage } from "@/lib/upload-api";
import { cn, imgUrl } from "@/lib/utils";
import type { ColorRow, SizeRow } from "@/lib/admin-api";

const VARIANT_STATUSES = ["active", "inactive", "out_of_stock"] as const;
type VariantStatus = (typeof VARIANT_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  out_of_stock: "Out of stock",
};

/** One row of the form's `variants` field array. */
export interface VariantValue {
  id?: number | string;
  color_id?: string;
  size_id?: string;
  sku?: string;
  price: string;
  sale_price?: string;
  discount_percent?: string;
  discount_amount?: string;
  quantity?: string;
  image_url?: string | null;
  status: VariantStatus;
}

/**
 * The parent form's values are wider than this section needs — only `variants`
 * is touched here, so the caller narrows its control once on the way in.
 */
export interface VariantsForm {
  variants: VariantValue[];
}
type FormShape = VariantsForm;

const blankVariant = (
  color_id: string,
  size_id: string,
  price: string
): VariantValue => ({
  color_id,
  size_id,
  sku: "",
  price,
  sale_price: "",
  discount_percent: "",
  discount_amount: "",
  quantity: "",
  image_url: null,
  status: "active",
});

// ─── Option chips ─────────────────────────────────────────────────────────────

function OptionRow({
  label,
  children,
  chips,
  onRemoveChip,
}: {
  label: string;
  children: React.ReactNode;
  chips: { key: string; label: string; swatch?: string | null }[];
  onRemoveChip: (key: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="w-16 shrink-0 text-sm">{label}</Label>
        {children}
      </div>
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-[4.5rem]">
          {chips.map((c) => (
            <span
              key={c.key}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-0.5 pl-2 pr-1 text-xs"
            >
              {c.swatch && (
                <span
                  className="size-3 rounded-full border border-black/10"
                  style={{ background: c.swatch }}
                />
              )}
              {c.label}
              <button
                type="button"
                aria-label={`Remove ${c.label}`}
                onClick={() => onRemoveChip(c.key)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Variant image ────────────────────────────────────────────────────────────

function VariantImage({
  value,
  onChange,
  size = "size-10",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  size?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    setUploading(true);
    try {
      onChange(await uploadImage(file, "variants"));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Image upload failed."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={value ? "Replace image" : "Upload image"}
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 disabled:opacity-50",
          size
        )}
      >
        {uploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl(value)} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-4" />
        )}
      </button>
      {value && !uploading && (
        <button
          type="button"
          aria-label="Remove image"
          onClick={() => onChange(null)}
          className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-white"
        >
          <X className="size-2.5" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function VariantsSection({
  control,
  register,
  colors,
  sizes,
  onColorCreated,
  onSizeCreated,
  basePrice,
}: {
  control: Control<FormShape>;
  register: UseFormRegister<FormShape>;
  colors: ColorRow[];
  sizes: SizeRow[];
  onColorCreated: (c: ColorRow) => void;
  onSizeCreated: (s: SizeRow) => void;
  /** Used as the default price for newly generated variants. */
  basePrice?: string;
}) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "variants",
  });
  const watched = useWatch({ control, name: "variants" });
  const variants = React.useMemo(
    () => (watched ?? []) as VariantValue[],
    [watched]
  );

  const [pendingColor, setPendingColor] = React.useState("");
  const [pendingSize, setPendingSize] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const colorName = React.useCallback(
    (id?: string) => colors.find((c) => String(c.id) === id)?.name ?? "",
    [colors]
  );
  const colorHex = React.useCallback(
    (id?: string) =>
      (colors.find((c) => String(c.id) === id)?.hex_code as string | undefined) ??
      null,
    [colors]
  );
  const sizeName = React.useCallback(
    (id?: string) => {
      const s = sizes.find((x) => String(x.id) === id);
      return s?.display_name ?? s?.name ?? "";
    },
    [sizes]
  );

  // Options in play, derived from the variants that already exist.
  const usedColors = React.useMemo(
    () => [...new Set(variants.map((v) => v.color_id).filter(Boolean))] as string[],
    [variants]
  );
  const usedSizes = React.useMemo(
    () => [...new Set(variants.map((v) => v.size_id).filter(Boolean))] as string[],
    [variants]
  );

  /** Add every missing colour × size pair, keeping the rows already entered. */
  const addCombination = (colorId: string, sizeId: string) => {
    const exists = variants.some(
      (v) => (v.color_id ?? "") === colorId && (v.size_id ?? "") === sizeId
    );
    if (!exists) append(blankVariant(colorId, sizeId, basePrice ?? ""));
  };

  const addColor = (colorId: string) => {
    if (!colorId || usedColors.includes(colorId)) return;
    if (usedSizes.length === 0) addCombination(colorId, "");
    else usedSizes.forEach((sizeId) => addCombination(colorId, sizeId));
    setPendingColor("");
  };

  const addSize = (sizeId: string) => {
    if (!sizeId || usedSizes.includes(sizeId)) return;
    if (usedColors.length === 0) {
      addCombination("", sizeId);
    } else {
      // A colour-only row becomes the first row of that colour's size group.
      usedColors.forEach((colorId) => {
        const bare = variants.findIndex(
          (v) => v.color_id === colorId && !v.size_id
        );
        if (bare >= 0) {
          update(bare, { ...variants[bare], size_id: sizeId });
        } else {
          addCombination(colorId, sizeId);
        }
      });
    }
    setPendingSize("");
  };

  const removeColor = (colorId: string) => {
    const keep = variants
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.color_id === colorId)
      .map(({ i }) => i)
      .sort((a, b) => b - a);
    keep.forEach((i) => remove(i));
  };

  const removeSize = (sizeId: string) => {
    const idxs = variants
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.size_id === sizeId)
      .map(({ i }) => i)
      .sort((a, b) => b - a);
    idxs.forEach((i) => remove(i));
  };

  // Group by colour, the way Shopify nests variants under the first option.
  const groups = React.useMemo(() => {
    const map = new Map<string, number[]>();
    variants.forEach((v, i) => {
      const key = v.color_id ?? "";
      map.set(key, [...(map.get(key) ?? []), i]);
    });
    return [...map.entries()];
  }, [variants]);

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleRow = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const applyToSelected = (field: "price" | "quantity", value: string) => {
    selected.forEach((i) => {
      const v = variants[i];
      if (v) update(i, { ...v, [field]: value });
    });
    setSelected(new Set());
  };

  const totalQty = variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);

  return (
    <div className="space-y-4">
      {/* ── Options ── */}
      <div className="space-y-2">
        <OptionRow
          label="Colour"
          chips={usedColors.map((id) => ({
            key: id,
            label: colorName(id) || `#${id}`,
            swatch: colorHex(id),
          }))}
          onRemoveChip={removeColor}
        >
          <div className="min-w-48 flex-1">
            <ColorCombobox
              value={pendingColor}
              onChange={(v) => {
                setPendingColor(v);
                addColor(v);
              }}
              colors={colors}
              onCreated={onColorCreated}
            />
          </div>
        </OptionRow>

        <OptionRow
          label="Size"
          chips={usedSizes.map((id) => ({
            key: id,
            label: sizeName(id) || `#${id}`,
          }))}
          onRemoveChip={removeSize}
        >
          <div className="min-w-48 flex-1">
            <SizeCombobox
              value={pendingSize}
              onChange={(v) => {
                setPendingSize(v);
                addSize(v);
              }}
              sizes={sizes}
              onCreated={onSizeCreated}
            />
          </div>
        </OptionRow>

        <p className="text-xs text-muted-foreground">
          Pick a colour or a size to start — each combination becomes its own
          variant. A variant needs at least one of the two.
        </p>
      </div>

      {/* ── Bulk bar ── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <BulkField
            label="Set price"
            prefix="$"
            onApply={(v) => applyToSelected("price", v)}
          />
          <BulkField
            label="Set quantity"
            onApply={(v) => applyToSelected("quantity", v)}
          />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Variant list ── */}
      {fields.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm font-medium">No variants yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add a colour or size above, or create a single variant manually.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => append(blankVariant("", "", basePrice ?? ""))}
          >
            <Plus className="size-4" />
            Add variant
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="flex-1">
              {variants.length} variant{variants.length === 1 ? "" : "s"}
            </span>
            <span className="w-24 text-right">Price</span>
            <span className="w-20 text-right">Qty</span>
            <span className="w-16" />
          </div>

          {groups.map(([groupKey, indexes]) => {
            const isOpen = !collapsed.has(groupKey);
            const groupQty = indexes.reduce(
              (sum, i) => sum + (Number(variants[i]?.quantity) || 0),
              0
            );
            const grouped = groupKey !== "" && indexes.length > 1;

            return (
              <div key={groupKey || "ungrouped"}>
                {grouped && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupKey)}
                    className="flex w-full items-center gap-2 border-b border-border bg-muted/20 px-3 py-2 text-left text-sm hover:bg-muted/40"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        !isOpen && "-rotate-90"
                      )}
                    />
                    {colorHex(groupKey) && (
                      <span
                        className="size-4 rounded-full border border-black/10"
                        style={{ background: colorHex(groupKey) ?? undefined }}
                      />
                    )}
                    <span className="font-medium">{colorName(groupKey)}</span>
                    <span className="text-xs text-muted-foreground">
                      {indexes.length} variant{indexes.length === 1 ? "" : "s"}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {groupQty} in stock
                    </span>
                  </button>
                )}

                {(!grouped || isOpen) &&
                  indexes.map((idx) => {
                    const v = variants[idx];
                    if (!v) return null;
                    const label =
                      [colorName(v.color_id), sizeName(v.size_id)]
                        .filter(Boolean)
                        .join(" / ") || "Untitled variant";

                    return (
                      <div
                        key={fields[idx]?.id ?? idx}
                        className={cn(
                          "flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/20",
                          grouped && "pl-9",
                          selected.has(idx) && "bg-[#e0f0ff]/40"
                        )}
                      >
                        <Checkbox
                          checked={selected.has(idx)}
                          onCheckedChange={() => toggleRow(idx)}
                          aria-label={`Select ${label}`}
                        />

                        <Controller
                          name={`variants.${idx}.image_url`}
                          control={control}
                          render={({ field: f }) => (
                            <VariantImage
                              value={(f.value as string | null) ?? null}
                              onChange={f.onChange}
                            />
                          )}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{label}</p>
                          <Input
                            placeholder="SKU"
                            className="mt-0.5 h-6 border-0 bg-transparent px-0 font-mono text-xs text-muted-foreground shadow-none focus-visible:ring-0"
                            {...register(`variants.${idx}.sku`)}
                          />
                        </div>

                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="h-8 pl-5 text-sm"
                            {...register(`variants.${idx}.price`)}
                          />
                        </div>

                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="0"
                          className="h-8 w-20 text-sm"
                          {...register(`variants.${idx}.quantity`)}
                        />

                        <VariantDetailPopover
                          control={control}
                          register={register}
                          index={idx}
                          label={label}
                          colors={colors}
                          sizes={sizes}
                          onColorCreated={onColorCreated}
                          onSizeCreated={onSizeCreated}
                        />

                        <button
                          type="button"
                          aria-label={`Delete ${label}`}
                          onClick={() => remove(idx)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            );
          })}

          <div className="flex items-center gap-3 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => append(blankVariant("", "", basePrice ?? ""))}
            >
              <Plus className="size-3.5" />
              Add variant
            </Button>
            <span className="ml-auto tabular-nums">
              {totalQty} in stock across {variants.length} variant
              {variants.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bulk field ───────────────────────────────────────────────────────────────

function BulkField({
  label,
  prefix,
  onApply,
}: {
  label: string;
  prefix?: string;
  onApply: (value: string) => void;
}) {
  const [value, setValue] = React.useState("");
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          min="0"
          step={prefix ? "0.01" : "1"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={label}
          className={cn("h-8 w-28 text-sm", prefix && "pl-5")}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={!value.trim()}
        onClick={() => {
          onApply(value);
          setValue("");
        }}
      >
        Apply
      </Button>
    </div>
  );
}

// ─── Per-variant details ──────────────────────────────────────────────────────

function VariantDetailPopover({
  control,
  register,
  index,
  label,
  colors,
  sizes,
  onColorCreated,
  onSizeCreated,
}: {
  control: Control<FormShape>;
  register: UseFormRegister<FormShape>;
  index: number;
  label: string;
  colors: ColorRow[];
  sizes: SizeRow[];
  onColorCreated: (c: ColorRow) => void;
  onSizeCreated: (s: SizeRow) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={`Edit ${label}`}
            title="More options"
          >
            <Settings2 className="size-4" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 space-y-3 p-3">
        <p className="text-sm font-medium">{label}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Colour</Label>
            <Controller
              name={`variants.${index}.color_id`}
              control={control}
              render={({ field: f }) => (
                <ColorCombobox
                  value={(f.value as string) ?? ""}
                  onChange={f.onChange}
                  colors={colors}
                  onCreated={onColorCreated}
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Size</Label>
            <Controller
              name={`variants.${index}.size_id`}
              control={control}
              render={({ field: f }) => (
                <SizeCombobox
                  value={(f.value as string) ?? ""}
                  onChange={f.onChange}
                  sizes={sizes}
                  onCreated={onSizeCreated}
                />
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Sale price</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="h-8 text-sm"
              {...register(`variants.${index}.sale_price`)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Controller
              name={`variants.${index}.status`}
              control={control}
              render={({ field: f }) => (
                <Select
                  items={STATUS_LABELS}
                  value={f.value as string}
                  onValueChange={f.onChange}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Discount %</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="0"
              className="h-8 text-sm"
              {...register(`variants.${index}.discount_percent`)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Discount amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="h-8 text-sm"
              {...register(`variants.${index}.discount_amount`)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
