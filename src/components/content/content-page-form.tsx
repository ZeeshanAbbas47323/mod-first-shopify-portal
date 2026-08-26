"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MediaUpload } from "@/components/media-upload";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  createContentPage,
  deleteRecord,
  updateContentPage,
  type ContentPageRow,
  type ContentType,
} from "@/lib/admin-api";

const LIST_HREF = "/content/pages";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z
    .string()
    .refine(
      (v) => v.replace(/<[^>]*>/g, "").trim().length > 0,
      "Content is required"
    ),
  content_type: z.enum(CONTENT_TYPES),
  meta_title: z.string().optional(),
  meta_desc: z.string().optional(),
  meta_keywords: z.string().optional(),
  canonical_url: z
    .string()
    .trim()
    .refine((v) => !v || /^https?:\/\/\S+$/.test(v), "Enter a full URL starting with http(s)://")
    .optional(),
  featured_image: z.string().nullable().optional(),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const TYPE_ITEMS = CONTENT_TYPE_LABELS as Record<string, string>;

/** Rough word/character read-out so editors can see how long a page is. */
function contentStats(html: string) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  return { words, chars: text.length };
}

export function ContentPageForm({ page }: { page?: ContentPageRow }) {
  const router = useRouter();
  const isEdit = !!page;

  const [saving, setSaving] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: page?.title ?? "",
      content: page?.content ?? "",
      content_type: page?.content_type ?? "page",
      meta_title: page?.meta_title ?? "",
      meta_desc: page?.meta_desc ?? "",
      meta_keywords: page?.meta_keywords ?? "",
      canonical_url: page?.canonical_url ?? "",
      featured_image: page?.featured_image ?? null,
      is_active: page?.is_active ?? true,
    },
  });

  const title = watch("title");
  const content = watch("content");
  const metaTitle = watch("meta_title");
  const metaDesc = watch("meta_desc");
  const canonical = watch("canonical_url");
  const stats = React.useMemo(() => contentStats(content ?? ""), [content]);

  // Warn before losing unsaved edits.
  React.useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const body = {
        title: values.title,
        content: values.content,
        content_type: values.content_type as ContentType,
        meta_title: values.meta_title?.trim() || undefined,
        meta_desc: values.meta_desc?.trim() || undefined,
        meta_keywords: values.meta_keywords?.trim() || undefined,
        canonical_url: values.canonical_url?.trim() || undefined,
        featured_image: values.featured_image || undefined,
        is_active: values.is_active,
      };
      const message = isEdit
        ? await updateContentPage(page.id, body)
        : await createContentPage(body);
      toast.success(message);
      router.push(LIST_HREF);
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${isEdit ? "update" : "create"} the page.`)
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!page) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("contentPage", page.id);
      toast.success(message);
      router.push(LIST_HREF);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the page."));
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
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => router.push(LIST_HREF)}
                className="mb-1 flex items-center gap-1 text-sm text-[#005bd3] hover:underline"
              >
                ← Pages
              </button>
              <h1 className="truncate text-xl font-bold">
                {isEdit ? page.title : "New page"}
              </h1>
              {isEdit && (
                <p className="font-mono text-xs text-muted-foreground">
                  /{page.slug}
                  {page.updated_at
                    ? ` · updated ${format(new Date(page.updated_at), "MMM d, yyyy")}`
                    : ""}
                </p>
              )}
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
                {isEdit ? "Save changes" : "Save page"}
              </Button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            {/* ── Left column ─────────────────────────────────────── */}
            <div className="flex flex-col gap-5">
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Page content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-title">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="cp-title"
                      placeholder="e.g. DTF Artwork Guidelines"
                      aria-invalid={!!errors.title}
                      {...register("title")}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive">{errors.title.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>
                        Content <span className="text-destructive">*</span>
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {stats.words.toLocaleString()} words ·{" "}
                        {stats.chars.toLocaleString()} characters
                      </span>
                    </div>
                    <Controller
                      control={control}
                      name="content"
                      render={({ field }) => (
                        <RichTextEditor
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Write the page content…"
                          minHeight="26rem"
                          maxHeight="42rem"
                          uploadFolder="pages"
                        />
                      )}
                    />
                    {errors.content && (
                      <p className="text-sm text-destructive">{errors.content.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Pages with custom markup (classes, icons, embeds) are safest to edit
                      in the <span className="font-medium">HTML</span> tab — the visual
                      editor keeps only standard formatting.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* SEO */}
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Search engine listing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Google-style preview */}
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="truncate text-xs text-[#0b6b12]">
                      {canonical || "https://modfirstapparel.com/pages/…"}
                    </p>
                    <p className="truncate text-base text-[#1a0dab]">
                      {metaTitle || title || "Page title"}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {metaDesc ||
                        "Add a meta description to control how this page reads in search results."}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cp-meta-title">Meta title</Label>
                      <span className="text-xs text-muted-foreground">
                        {(metaTitle ?? "").length}/60
                      </span>
                    </div>
                    <Input
                      id="cp-meta-title"
                      placeholder="Defaults to the page title"
                      {...register("meta_title")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cp-meta-desc">Meta description</Label>
                      <span className="text-xs text-muted-foreground">
                        {(metaDesc ?? "").length}/160
                      </span>
                    </div>
                    <Textarea
                      id="cp-meta-desc"
                      rows={3}
                      placeholder="Shown under the title in search results…"
                      {...register("meta_desc")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cp-meta-keywords">Meta keywords</Label>
                    <Textarea
                      id="cp-meta-keywords"
                      rows={2}
                      placeholder="dtf artwork guidelines, dtf file requirements, …"
                      {...register("meta_keywords")}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cp-canonical">Canonical URL</Label>
                    <Input
                      id="cp-canonical"
                      placeholder="https://modfirstapparel.com/pages/dtf-artwork-guidelines"
                      aria-invalid={!!errors.canonical_url}
                      {...register("canonical_url")}
                    />
                    {errors.canonical_url && (
                      <p className="text-sm text-destructive">
                        {errors.canonical_url.message}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Right column ────────────────────────────────────── */}
            <div className="flex flex-col gap-5">
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Visibility</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Controller
                    control={control}
                    name="is_active"
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(!!v)}
                        />
                        <span className="text-sm">
                          Published
                          <span className="block text-xs text-muted-foreground">
                            Visible on the storefront.
                          </span>
                        </span>
                      </label>
                    )}
                  />

                  <div className="space-y-1.5">
                    <Label>Content type</Label>
                    <Controller
                      control={control}
                      name="content_type"
                      render={({ field }) => (
                        <Select
                          items={TYPE_ITEMS}
                          value={field.value}
                          onValueChange={(v) => field.onChange(v as ContentType)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONTENT_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {CONTENT_TYPE_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {isEdit && (
                    <div className="space-y-1.5">
                      <Label>Slug</Label>
                      <Input value={page.slug} readOnly className="font-mono" />
                      <p className="text-xs text-muted-foreground">
                        Set when the page was created — renaming the title
                        doesn&apos;t change it, so existing links keep working.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Featured image</CardTitle>
                </CardHeader>
                <CardContent>
                  <Controller
                    control={control}
                    name="featured_image"
                    render={({ field }) => (
                      <MediaUpload
                        value={field.value}
                        onChange={field.onChange}
                        folder="pages"
                      />
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </form>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this page?"
        description={
          page ? (
            <>
              <span className="font-medium">{page.title}</span> will be removed from
              the storefront. This can&apos;t be undone.
            </>
          ) : undefined
        }
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
