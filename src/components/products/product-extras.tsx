"use client";

import * as React from "react";
import {
  ChevronDown,
  HelpCircle,
  ImagePlus,
  Loader2,
  Plus,
  Star,
  Text,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { apiErrorMessage } from "@/lib/auth-api";
import { uploadImages } from "@/lib/upload-api";
import { cn, imgUrl } from "@/lib/utils";
import {
  createProductDescription,
  createProductFaq,
  createProductImagesBulk,
  deleteRecord,
  listProductDescriptions,
  listProductFaqs,
  listProductImages,
  updateProductDescription,
  updateProductFaq,
  updateProductImage,
  updateSortOrder,
  type ProductDescriptionRow,
  type ProductFaqDetailRow,
  type ProductImageDetailRow,
} from "@/lib/admin-api";

/** Swap sort_order with the neighbour, then reload. */
async function swapOrder(
  table: "productImage" | "productDescription" | "productFaq",
  rows: { id: number | string; sort_order?: number }[],
  index: number,
  dir: "up" | "down"
) {
  const target = index + (dir === "up" ? -1 : 1);
  if (target < 0 || target >= rows.length) return false;
  await updateSortOrder(table, [
    { id: rows[index].id, sort_order: rows[target].sort_order ?? target },
    { id: rows[target].id, sort_order: rows[index].sort_order ?? index },
  ]);
  return true;
}

function MoveButtons({
  index,
  count,
  onMove,
}: {
  index: number;
  count: number;
  onMove: (dir: "up" | "down") => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => onMove("up")}
        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-25"
      >
        <ChevronDown className="size-3.5 rotate-180" />
      </button>
      <button
        type="button"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => onMove("down")}
        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-25"
      >
        <ChevronDown className="size-3.5" />
      </button>
    </>
  );
}

export function ProductExtras({ productId }: { productId: number | string }) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <GallerySection productId={productId} />
      <DescriptionsSection productId={productId} />
      <FaqsSection productId={productId} />
    </div>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

function GallerySection({ productId }: { productId: number | string }) {
  const [rows, setRows] = React.useState<ProductImageDetailRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProductImageDetailRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [key, setKey] = React.useState(0);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const reload = () => setKey((k) => k + 1);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProductImages(productId)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(e, "Couldn't load images."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId, key]);

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await uploadImages(files, "products");
      if (!urls.length) throw new Error("Upload returned no URLs.");
      const base = rows.length;
      toast.success(
        await createProductImagesBulk(
          productId,
          urls.map((image_url, i) => ({
            image_url,
            is_primary: base === 0 && i === 0,
            sort_order: base + i + 1,
          }))
        )
      );
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't add the images."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const makePrimary = async (row: ProductImageDetailRow) => {
    try {
      // Only one image can be primary, so clear the current one first.
      const current = rows.find((r) => r.is_primary && r.id !== row.id);
      if (current) await updateProductImage(current.id, { is_primary: false });
      toast.success(await updateProductImage(row.id, { is_primary: true }));
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't set the primary image."));
    }
  };

  const move = async (index: number, dir: "up" | "down") => {
    try {
      if (await swapOrder("productImage", rows, index, dir)) reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't reorder the images."));
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      toast.success(await deleteRecord("productImage", deleteTarget.id));
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't delete the image."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <ImagePlus className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Gallery</CardTitle>
          <span className="text-xs text-muted-foreground">
            {rows.length} image{rows.length === 1 ? "" : "s"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add images
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
          />
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No images yet — add a few so the product looks right on the storefront.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {rows.map((row, i) => (
                <div
                  key={String(row.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-border",
                    row.is_primary && "ring-2 ring-[#005bd3]",
                    row.is_active === false && "opacity-60"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl(row.image_url)}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  {row.is_primary && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-[#005bd3] px-2 py-0.5 text-[11px] font-medium text-white">
                      Primary
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-background/90 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <MoveButtons
                      index={i}
                      count={rows.length}
                      onMove={(d) => move(i, d)}
                    />
                    {!row.is_primary && (
                      <button
                        type="button"
                        aria-label="Make primary"
                        title="Make primary"
                        onClick={() => makePrimary(row)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Star className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Delete image"
                      onClick={() => setDeleteTarget(row)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(n) => !n && setDeleteTarget(null)}
        loading={deleting}
        onConfirm={remove}
        title="Delete this image?"
        description="It will be removed from the product gallery."
      />
    </>
  );
}

// ─── Description blocks ───────────────────────────────────────────────────────

function DescriptionsSection({ productId }: { productId: number | string }) {
  const [rows, setRows] = React.useState<ProductDescriptionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<ProductDescriptionRow | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProductDescriptionRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [key, setKey] = React.useState(0);

  const reload = () => setKey((k) => k + 1);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProductDescriptions(productId)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(e, "Couldn't load description blocks."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId, key]);

  const move = async (index: number, dir: "up" | "down") => {
    try {
      if (await swapOrder("productDescription", rows, index, dir)) reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't reorder the blocks."));
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      toast.success(await deleteRecord("productDescription", deleteTarget.id));
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't delete the block."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <Text className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Description blocks</CardTitle>
          <span className="text-xs text-muted-foreground">
            {rows.length} block{rows.length === 1 ? "" : "s"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add block
          </Button>
        </CardHeader>

        <CardContent className="space-y-2">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No blocks — add sections like Material, Care instructions or Sizing.
            </p>
          ) : (
            rows.map((row, i) => (
              <div
                key={String(row.id)}
                className={cn(
                  "group flex items-start gap-2 rounded-xl border border-border p-3",
                  row.is_active === false && "opacity-60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.heading}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {row.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <MoveButtons index={i} count={rows.length} onMove={(d) => move(i, d)} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(row);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <button
                    type="button"
                    aria-label="Delete block"
                    onClick={() => setDeleteTarget(row)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <DescriptionDialog
        productId={productId}
        editing={editing}
        nextOrder={rows.length + 1}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={reload}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(n) => !n && setDeleteTarget(null)}
        loading={deleting}
        onConfirm={remove}
        title={`Delete "${deleteTarget?.heading ?? ""}"?`}
        description="This can't be undone."
      />
    </>
  );
}

function DescriptionDialog({
  productId,
  editing,
  nextOrder,
  open,
  onOpenChange,
  onSaved,
}: {
  productId: number | string;
  editing: ProductDescriptionRow | null;
  nextOrder: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [heading, setHeading] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setHeading(editing?.heading ?? "");
    setDescription(editing?.description ?? "");
  }, [open, editing]);

  const invalid = !heading.trim() || !description.trim();

  const submit = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      const body = {
        product_id: productId,
        heading: heading.trim(),
        description: description.trim(),
        sort_order: editing?.sort_order ?? nextOrder,
        is_active: true,
      };
      toast.success(
        editing
          ? await updateProductDescription(editing.id, body)
          : await createProductDescription(body)
      );
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't save the block."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit block" : "Add description block"}</DialogTitle>
          <DialogDescription>
            Shown as its own section on the product page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="desc-heading">Heading</Label>
            <Input
              id="desc-heading"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="Material & Fabric"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc-body">Description</Label>
            <Textarea
              id="desc-body"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Made from 100% premium organic cotton…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving || invalid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Add block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── FAQs ─────────────────────────────────────────────────────────────────────

function FaqsSection({ productId }: { productId: number | string }) {
  const [rows, setRows] = React.useState<ProductFaqDetailRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<ProductFaqDetailRow | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProductFaqDetailRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [key, setKey] = React.useState(0);

  const reload = () => setKey((k) => k + 1);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProductFaqs(productId)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(e, "Couldn't load FAQs."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId, key]);

  const move = async (index: number, dir: "up" | "down") => {
    try {
      if (await swapOrder("productFaq", rows, index, dir)) reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't reorder the FAQs."));
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      toast.success(await deleteRecord("productFaq", deleteTarget.id));
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't delete the FAQ."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center gap-2 pb-3">
          <HelpCircle className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">FAQs</CardTitle>
          <span className="text-xs text-muted-foreground">
            {rows.length} question{rows.length === 1 ? "" : "s"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add FAQ
          </Button>
        </CardHeader>

        <CardContent className="space-y-2">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No FAQs — answer the questions customers keep asking about this product.
            </p>
          ) : (
            rows.map((row, i) => (
              <div
                key={String(row.id)}
                className={cn(
                  "flex items-start gap-2 rounded-xl border border-border p-3",
                  row.is_active === false && "opacity-60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.question}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {row.answer}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <MoveButtons index={i} count={rows.length} onMove={(d) => move(i, d)} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(row);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <button
                    type="button"
                    aria-label="Delete FAQ"
                    onClick={() => setDeleteTarget(row)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <FaqDialog
        productId={productId}
        editing={editing}
        nextOrder={rows.length + 1}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={reload}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(n) => !n && setDeleteTarget(null)}
        loading={deleting}
        onConfirm={remove}
        title="Delete this FAQ?"
        description="This can't be undone."
      />
    </>
  );
}

function FaqDialog({
  productId,
  editing,
  nextOrder,
  open,
  onOpenChange,
  onSaved,
}: {
  productId: number | string;
  editing: ProductFaqDetailRow | null;
  nextOrder: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setQuestion(editing?.question ?? "");
    setAnswer(editing?.answer ?? "");
  }, [open, editing]);

  const invalid = question.trim().length < 3 || !answer.trim();

  const submit = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      const body = {
        product_id: productId,
        question: question.trim(),
        answer: answer.trim(),
        sort_order: editing?.sort_order ?? nextOrder,
        is_active: true,
      };
      toast.success(
        editing
          ? await updateProductFaq(editing.id, body)
          : await createProductFaq(body)
      );
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't save the FAQ."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="faq-q">Question</Label>
            <Input
              id="faq-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Is this shirt true to size?"
              maxLength={500}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="faq-a">Answer</Label>
            <Textarea
              id="faq-a"
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Yes — please refer to our size chart for accurate fitting."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving || invalid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Add FAQ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
