"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { imgUrl } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiErrorMessage } from "@/lib/auth-api";
import { uploadImage } from "@/lib/upload-api";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  createProductCategory,
  updateProductCategory,
  deleteRecord,
  fetchAllProductCategories,
  type ProductCategoryRow,
} from "@/lib/admin-api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, dashes only"),
  description: z.string().optional(),
  parent_id: z.string().optional(),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

// ─── Image Upload Box ─────────────────────────────────────────────────────────

function ImageUploadBox({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  hint?: string;
}) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB."); return; }
    setUploading(true);
    try {
      const url = await uploadImage(file, "categories");
      onChange(url);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Image upload failed."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgUrl(value)}
            alt={label}
            className="h-32 w-auto max-w-xs rounded-xl border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow-md hover:opacity-90"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/60 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          <span>{uploading ? "Uploading…" : "Click to upload"}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function CategoryForm({ category }: { category?: ProductCategoryRow }) {
  const router = useRouter();
  const isEdit = !!category;

  const [image, setImage] = React.useState<string | null>(
    category?.image_url ?? category?.image ?? null
  );
  const [parents, setParents] = React.useState<ProductCategoryRow[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getFieldState,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      parent_id: category?.parent_id ? String(category.parent_id) : "",
      is_active: category?.is_active ?? true,
    },
  });

  // Load parent categories
  React.useEffect(() => {
    fetchAllProductCategories()
      .then((cats) => {
        // Exclude current category from parent options
        setParents(cats.filter((c) => c.id !== category?.id));
      })
      .catch(() => {});
  }, [category?.id]);

  // Auto-slug from name on create
  const nameVal = watch("name");
  React.useEffect(() => {
    if (!isEdit && !getFieldState("slug").isDirty) {
      setValue("slug", slugify(nameVal));
    }
  }, [nameVal, isEdit, getFieldState, setValue]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const body = {
        name: values.name,
        slug: values.slug,
        description: values.description || undefined,
        parent_id: values.parent_id ? Number(values.parent_id) : null,
        is_active: values.is_active,
        image_url: image ?? undefined,
      };

      const msg = isEdit
        ? await updateProductCategory(category.id, body)
        : await createProductCategory(body);

      toast.success(msg);
      router.push("/products/categories");
    } catch (e) {
      toast.error(apiErrorMessage(e, `Couldn't ${isEdit ? "update" : "create"} category.`));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    setDeleting(true);
    try {
      const msg = await deleteRecord("productCategory", category.id);
      toast.success(msg);
      router.push("/products/categories");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't delete the category."));
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => router.push("/products/categories")}
              className="mb-1 flex items-center gap-1 text-sm text-[#005bd3] hover:underline"
            >
              ← Product categories
            </button>
            <h1 className="text-xl font-bold">
              {isEdit ? category.name : "New category"}
            </h1>
          </div>
          <div className="flex gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Save category"}
            </Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* ── Left column ──────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Basic info */}
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Basic information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cat-name">Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="cat-name"
                    placeholder="e.g. T-Shirts"
                    aria-invalid={!!errors.name}
                    {...register("name")}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cat-slug">
                    Slug <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center rounded-lg border border-input bg-muted/30 focus-within:ring-2 focus-within:ring-ring">
                    <span className="shrink-0 pl-3 text-sm text-muted-foreground">/</span>
                    <input
                      id="cat-slug"
                      placeholder="t-shirts"
                      aria-invalid={!!errors.slug}
                      className="min-w-0 flex-1 bg-transparent py-2 pr-3 pl-1 font-mono text-sm outline-none"
                      {...register("slug")}
                    />
                  </div>
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cat-desc">Description</Label>
                  <Textarea
                    id="cat-desc"
                    rows={3}
                    placeholder="Optional description of this category…"
                    {...register("description")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Images */}
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Images</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageUploadBox
                  label="Category image"
                  value={image}
                  onChange={setImage}
                  hint="Main listing image"
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Right sidebar ────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Status */}
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex cursor-pointer items-center gap-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      {...register("is_active")}
                    />
                    <div className="h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-[#29845a]" />
                    <div className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                  <span className="text-sm font-medium">Active</span>
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  {isEdit ? "Inactive categories won't appear in the store." : "Category will be active by default."}
                </p>
              </CardContent>
            </Card>

            {/* Parent category */}
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Parent category</Label>
                  <Controller
                    name="parent_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(v) => field.onChange(v ?? "")}
                      >
                        <SelectTrigger className="bg-card">
                          <SelectValue placeholder="None (top-level)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None (top-level)</SelectItem>
                          {parents.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for a top-level category.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Meta */}
            {isEdit && (
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono">{category.id}</span>
                  </div>
                  {category.products_count != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Products</span>
                      <span>{category.products_count}</span>
                    </div>
                  )}
                  {category.created_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{format(new Date(category.created_at), "MMM d, yyyy")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </form>
    <ConfirmDeleteDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      loading={deleting}
      onConfirm={handleDelete}
      title={`Delete "${category?.name}"?`}
      description="This can't be undone."
    />
    </>
  );
}

function format(date: Date, fmt: string): string {
  return fmt
    .replace("MMM", ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][date.getMonth()])
    .replace("d", String(date.getDate()))
    .replace("yyyy", String(date.getFullYear()));
}
