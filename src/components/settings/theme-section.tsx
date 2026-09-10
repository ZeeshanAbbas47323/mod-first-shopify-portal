"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ImageOff,
  X,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { MediaUpload } from "@/components/media-upload";
import {
  ThemePreview,
  storefrontUrl,
} from "@/components/settings/theme-preview";
import { Thumb } from "@/components/thumb";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { persistOrder } from "@/lib/sort-order";
import { DragHandle } from "@/components/drag-handle";
import { useDragReorder, moveItem as moveArrayItem } from "@/hooks/use-drag-reorder";
import { cn } from "@/lib/utils";
import {
  createHomeSection,
  deleteRecord,
  fetchAllHomeSections,
  manageHomeSectionItems,
  updateHomeSection,
  updateRecordStatus,
  type HomeSectionItemAction,
  type HomeSectionItemRow,
  type HomeSectionRow,
} from "@/lib/admin-api";

/**
 * A titled group of fields. The section form carries a dozen inputs; grouping
 * them by what they do keeps the dialog scannable instead of a flat wall.
 */
function FormGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Required() {
  return <span className="text-destructive"> *</span>;
}

const LAYOUT_HINTS = [
  "hero", "hero_full", "banner", "grid", "carousel", "slider", "features", "cta",
];

/** Select values cannot be empty strings, so "not set" needs its own token. */
const NO_LAYOUT = "__none__";

const LAYOUT_ITEMS = {
  [NO_LAYOUT]: "Not set",
  ...Object.fromEntries(LAYOUT_HINTS.map((l) => [l, l])),
};

const slugKey = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s_]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_");

export function ThemeSection() {
  const [sections, setSections] = React.useState<HomeSectionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [showHidden, setShowHidden] = React.useState(true);
  const [showPreview, setShowPreview] = React.useState(true);

  // Without a storefront URL there is nothing to frame, so the toggle and the
  // panel both stay out of the way.
  const hasStorefront = !!storefrontUrl();

  const activeCount = React.useMemo(
    () => sections.filter((s) => s.is_active !== false).length,
    [sections]
  );

  const itemCount = React.useMemo(
    () => sections.reduce((sum, s) => sum + (s.items?.length ?? 0), 0),
    [sections]
  );

  /** The editor list respects the search box and the active-only filter; the
   *  preview always reflects the whole set, since it stands in for the page. */
  const isFiltered = React.useMemo(
    () => !!search.trim() || !showHidden,
    [search, showHidden]
  );

  const visibleSections = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return sections.filter((s) => {
      if (!showHidden && s.is_active === false) return false;
      if (!term) return true;
      return [s.section_name, s.title, s.section_key, s.layout_type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [sections, search, showHidden]);

  const [editing, setEditing] = React.useState<HomeSectionRow | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<HomeSectionRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [itemTarget, setItemTarget] = React.useState<{
    section: HomeSectionRow;
    item: HomeSectionItemRow | null;
  } | null>(null);
  const [itemDelete, setItemDelete] = React.useState<{
    section: HomeSectionRow;
    item: HomeSectionItemRow;
  } | null>(null);
  const [deletingItem, setDeletingItem] = React.useState(false);

  const reload = React.useCallback(() => setRefreshKey((k) => k + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllHomeSections()
      .then((rows) => !cancelled && setSections(rows))
      .catch((error) => {
        if (cancelled) return;
        setSections([]);
        toast.error(apiErrorMessage(error, "Couldn't load home sections."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleActive = async (section: HomeSectionRow, next: boolean) => {
    try {
      await updateRecordStatus("homeSection", section.id, next);
      toast.success(next ? "Section shown." : "Section hidden.");
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the section."));
    }
  };

  const dnd = useDragReorder({
    errorMessage: "Couldn't reorder sections.",
    onReorder: async (from, to) => {
      await persistOrder("homeSection", moveArrayItem(sections, from, to));
      reload();
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      toast.success(await deleteRecord("homeSection", deleteTarget.id));
      setDeleteTarget(null);
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the section."));
    } finally {
      setDeleting(false);
    }
  };

  const handleItemDelete = async () => {
    if (!itemDelete) return;
    setDeletingItem(true);
    try {
      toast.success(
        await manageHomeSectionItems(itemDelete.section.id, [
          { _action: "delete", id: itemDelete.item.id },
        ])
      );
      setItemDelete(null);
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the item."));
    } finally {
      setDeletingItem(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Blocks that make up the storefront home page, in the order they appear.
          Drag a row to reorder it.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-44 flex-1 sm:max-w-64 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections…"
              aria-label="Search sections"
              className="pl-8"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setShowHidden((v) => !v)}
            aria-pressed={showHidden}
            title={showHidden ? "Hiding nothing" : "Showing active only"}
          >
            {showHidden ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )}
            <span className="hidden sm:inline">
              {showHidden ? "All" : "Active only"}
            </span>
          </Button>

          {hasStorefront && (
            <Button
              variant="outline"
              onClick={() => setShowPreview((v) => !v)}
              aria-pressed={showPreview}
            >
              <Layers className="size-4" />
              <span className="hidden sm:inline">
                {showPreview ? "Hide preview" : "Show preview"}
              </span>
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>

          <Button
            className="ml-auto"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add section
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">{sections.length}</strong>{" "}
            section{sections.length === 1 ? "" : "s"}
          </span>
          <span>
            <strong className="font-medium text-foreground">{activeCount}</strong>{" "}
            active
          </span>
          <span>
            <strong className="font-medium text-foreground">{itemCount}</strong>{" "}
            item{itemCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : visibleSections.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Layers className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">
              {sections.length ? "No matching sections" : "No home sections yet"}
            </p>
            <p className="text-xs text-muted-foreground">
              {sections.length
                ? "Try a different search, or show hidden sections."
                : "Add a hero, banner or product grid to build the home page."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {isFiltered && (
            <p className="rounded-md bg-info-subtle px-2.5 py-1.5 text-xs text-info-subtle-foreground">
              Showing {visibleSections.length} of {sections.length}. Clear the
              filter to drag sections into a new order.
            </p>
          )}
          {visibleSections.map((section) => {
            const id = String(section.id);
            const isOpen = expanded.has(id);
            // Drag works against the full list, so a filtered row still knows
            // where it really sits.
            const index = sections.findIndex((s) => String(s.id) === id);
            const items = [...(section.items ?? [])].sort(
              (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
            );
            return (
              <Card
                key={id}
                {...(isFiltered ? {} : dnd.dropProps(index))}
                className={cn(
                  "overflow-hidden py-0 shadow-none transition",
                  section.is_active === false && "opacity-70",
                  dnd.isDragging(index) && "opacity-40",
                  dnd.isOver(index) && "ring-2 ring-ring"
                )}
              >
                {}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    onClick={() => toggleExpand(id)}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>

                  <Thumb
                    src={section.background_image}
                    background={section.background_color}
                    className="size-9"
                    fallback={<Layers className="size-4" />}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-medium">
                        {section.section_name || section.title || section.section_key}
                      </p>
                      {section.layout_type && (
                        <StatusBadge status={section.layout_type} tone="info" />
                      )}
                      {items.length > 0 && (
                        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                          {items.length} item{items.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {section.section_key}
                    </p>
                  </div>

                  <StatusToggle
                    isActive={section.is_active !== false}
                    onToggle={(next) => toggleActive(section, next)}
                  />

                  <div className="flex items-center gap-0.5">
                    <span className="w-6 text-right text-xs text-muted-foreground">
                      {section.sort_order ?? "—"}
                    </span>
                    <DragHandle
                      label={section.title ?? "section"}
                      disabled={dnd.saving || isFiltered}
                      {...dnd.handleProps(index, sections.length)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(section);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <button
                      type="button"
                      aria-label="Delete section"
                      onClick={() => setDeleteTarget(section)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {}
                {isOpen && (
                  <div className="border-t border-border bg-muted/20 px-3 py-2.5">
                    {section.title && (
                      <p className="mb-2 text-sm">
                        <span className="font-medium">{section.title}</span>
                        {section.subtitle ? (
                          <span className="text-muted-foreground"> — {section.subtitle}</span>
                        ) : null}
                      </p>
                    )}

                    {items.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">
                        No items in this section.
                      </p>
                    ) : (
                      <SectionItemList
                        sectionId={section.id}
                        items={items}
                        onReload={reload}
                        onEdit={(item) => setItemTarget({ section, item })}
                        onDelete={(item) => setItemDelete({ section, item })}
                      />
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => setItemTarget({ section, item: null })}
                    >
                      <Plus className="size-3.5" />
                      Add item
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showPreview && hasStorefront && <ThemePreview reloadKey={refreshKey} />}

      <SectionDialog
        editing={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={reload}
        nextSortOrder={sections.length + 1}
      />

      <ItemDialog target={itemTarget} onClose={() => setItemTarget(null)} onSaved={reload} />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        loading={deleting}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.section_name ?? deleteTarget?.section_key ?? ""}"?`}
        description="The section and its items will be removed from the home page."
      />

      <ConfirmDeleteDialog
        open={!!itemDelete}
        onOpenChange={(next) => !next && setItemDelete(null)}
        loading={deletingItem}
        onConfirm={handleItemDelete}
        title={`Delete "${itemDelete?.item.title ?? ""}"?`}
        description="This can't be undone."
      />
    </div>
  );
}


function SectionDialog({
  editing,
  open,
  onOpenChange,
  onSaved,
  nextSortOrder,
}: {
  editing: HomeSectionRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  nextSortOrder: number;
}) {
  const empty = {
    section_key: "",
    section_name: "",
    title: "",
    subtitle: "",
    description: "",
    background_color: "",
    layout_type: "",
    sort_order: String(nextSortOrder),
  };
  const [form, setForm] = React.useState(empty);
  const [background, setBackground] = React.useState<string | null>(null);
  const [isActive, setIsActive] = React.useState(true);
  const [settings, setSettings] = React.useState("");
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const keyDirty = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    keyDirty.current = !!editing;
    setForm({
      section_key: editing?.section_key ?? "",
      section_name: editing?.section_name ?? "",
      title: editing?.title ?? "",
      subtitle: editing?.subtitle ?? "",
      description: editing?.description ?? "",
      background_color: editing?.background_color ?? "",
      layout_type: editing?.layout_type ?? "",
      sort_order: String(editing?.sort_order ?? nextSortOrder),
    });
    setBackground(editing?.background_image ?? null);
    setIsActive(editing ? editing.is_active !== false : true);
    setSettings(
      editing?.section_settings
        ? JSON.stringify(editing.section_settings, null, 2)
        : ""
    );
    setSettingsError(null);
  }, [open, editing, nextSortOrder]);

  const set = (key: keyof typeof empty, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onNameChange = (value: string) => {
    setForm((f) => ({
      ...f,
      section_name: value,
      section_key: keyDirty.current ? f.section_key : slugKey(value),
    }));
  };

  const submit = async () => {
    if (!form.section_key.trim()) return;

    let parsedSettings: Record<string, unknown> | null = null;
    if (settings.trim()) {
      try {
        parsedSettings = JSON.parse(settings);
      } catch {
        setSettingsError("Not valid JSON.");
        return;
      }
    }

    setSaving(true);
    try {
      const body = {
        section_key: form.section_key.trim(),
        section_name: form.section_name.trim() || undefined,
        title: form.title.trim() || undefined,
        subtitle: form.subtitle.trim() || undefined,
        description: form.description.trim() || undefined,
        background_image: background || undefined,
        background_color: form.background_color.trim() || undefined,
        layout_type: form.layout_type.trim() || undefined,
        sort_order: Number(form.sort_order) || 0,
        section_settings: parsedSettings,
        is_active: isActive,
      };
      const message = editing
        ? await updateHomeSection(editing.id, body)
        : await createHomeSection(body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the section.`)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit section" : "Add home section"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update "${editing.section_name || editing.section_key}".`
              : "A block on the storefront home page — hero, banner, grid and so on."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <FormGroup
            title="Basics"
            description="How this block is identified in the admin and on the storefront."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hs-name">Section name</Label>
                <Input
                  id="hs-name"
                  value={form.section_name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Hero Banner Section"
                />
                <p className="text-xs text-muted-foreground">
                  Shown in this list only.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hs-key">
                  Section key
                  <Required />
                </Label>
                <Input
                  id="hs-key"
                  value={form.section_key}
                  onChange={(e) => {
                    keyDirty.current = true;
                    set("section_key", slugKey(e.target.value));
                  }}
                  placeholder="home_hero"
                  className="font-mono"
                  aria-invalid={!form.section_key.trim()}
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase and underscores — the storefront looks the section up
                  by this.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <Label className="text-sm">Visible on the storefront</Label>
                <p className="text-xs text-muted-foreground">
                  Hidden sections stay saved but are not rendered.
                </p>
              </div>
              <StatusToggle isActive={isActive} onToggle={setIsActive} />
            </div>
          </FormGroup>

          <Separator />

          <FormGroup
            title="Content"
            description="The wording customers read at the top of the block."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hs-title">Title</Label>
                <Input
                  id="hs-title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Premium Custom Apparel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hs-subtitle">Subtitle</Label>
                <Input
                  id="hs-subtitle"
                  value={form.subtitle}
                  onChange={(e) => set("subtitle", e.target.value)}
                  placeholder="Made for You, Delivered Fast"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hs-desc">Description</Label>
              <Textarea
                id="hs-desc"
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="High-quality custom printing with DTF, embroidery & more."
              />
            </div>
          </FormGroup>

          <Separator />

          <FormGroup
            title="Appearance"
            description="How the block is laid out and what sits behind it."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hs-layout">Layout type</Label>
                <Select
                  items={LAYOUT_ITEMS}
                  value={form.layout_type || NO_LAYOUT}
                  onValueChange={(v) =>
                    set("layout_type", v === NO_LAYOUT ? "" : String(v))
                  }
                >
                  <SelectTrigger id="hs-layout" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LAYOUT}>Not set</SelectItem>
                    {LAYOUT_HINTS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Tells the storefront which component to render.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hs-bg">Background colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(form.background_color)
                        ? form.background_color
                        : "#ffffff"
                    }
                    onChange={(e) => set("background_color", e.target.value)}
                    className="size-9 shrink-0 cursor-pointer rounded border border-input bg-transparent"
                    aria-label="Pick background colour"
                  />
                  <Input
                    id="hs-bg"
                    value={form.background_color}
                    onChange={(e) => set("background_color", e.target.value)}
                    placeholder="#030303"
                    className="font-mono"
                  />
                  {form.background_color && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Clear background colour"
                      onClick={() => set("background_color", "")}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Background image</Label>
              <MediaUpload
                value={background}
                onChange={setBackground}
                folder="home-sections"
              />
              <p className="text-xs text-muted-foreground">
                Sits behind the block. Leave empty to use the colour above.
              </p>
            </div>
          </FormGroup>

          <Separator />

          <FormGroup title="Advanced">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="hs-order">Sort order</Label>
                <Input
                  id="hs-order"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Or just drag the row in the list.
                </p>
              </div>
            </div>

            <details className="rounded-lg border border-border px-3 py-2.5">
              <summary className="cursor-pointer text-sm font-medium">
                Section settings (JSON)
              </summary>
              <div className="mt-3 space-y-1.5">
                <Textarea
                  id="hs-settings"
                  rows={5}
                  value={settings}
                  onChange={(e) => {
                    setSettings(e.target.value);
                    setSettingsError(null);
                  }}
                  placeholder={'{\n  "autoplay": true,\n  "interval": 5000\n}'}
                  className="font-mono text-xs"
                  spellCheck={false}
                  aria-invalid={!!settingsError}
                />
                {settingsError && (
                  <p className="text-sm text-destructive">{settingsError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Extra config the storefront reads — autoplay, interval, mobile
                  layout, etc.
                </p>
              </div>
            </details>
          </FormGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.section_key.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Add section"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ItemDialog({
  target,
  onClose,
  onSaved,
}: {
  target: { section: HomeSectionRow; item: HomeSectionItemRow | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const empty = {
    title: "",
    subtitle: "",
    description: "",
    button_text: "",
    button_url: "",
    badge: "",
    sort_order: "0",
  };

  const [form, setForm] = React.useState(empty);
  const [isActive, setIsActive] = React.useState(true);
  const [image, setImage] = React.useState<string | null>(null);
  const [mobileImage, setMobileImage] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const item = target?.item ?? null;

  React.useEffect(() => {
    if (!target) return;
    setForm({
      title: item?.title ?? "",
      subtitle: item?.subtitle ?? "",
      description: item?.description ?? "",
      button_text: item?.button_text ?? "",
      button_url: item?.button_url ?? "",
      badge: item?.badge ?? "",
      sort_order: String(item?.sort_order ?? (target.section.items?.length ?? 0) + 1),
    });
    setIsActive(item ? item.is_active !== false : true);
    setImage(item?.image_url ?? null);
    setMobileImage(item?.mobile_image_url ?? null);
  }, [target, item]);

  const set = (key: keyof typeof empty, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!target || !form.title.trim()) return;
    setSaving(true);
    try {
      const fields = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || undefined,
        description: form.description.trim() || undefined,
        image_url: image || undefined,
        mobile_image_url: mobileImage || undefined,
        button_text: form.button_text.trim() || undefined,
        button_url: form.button_url.trim() || undefined,
        badge: form.badge.trim() || undefined,
        sort_order: Number(form.sort_order) || 0,
        is_active: isActive,
      };
      const action: HomeSectionItemAction = item
        ? { _action: "update", id: item.id, ...fields }
        : { _action: "add", ...fields };

      toast.success(await manageHomeSectionItems(target.section.id, [action]));
      onClose();
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't save the item."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>
            {target
              ? `In "${target.section.section_name || target.section.section_key}".`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <FormGroup title="Content" description="What this card says.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hi-title">
                Title
                <Required />
              </Label>
              <Input
                id="hi-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Shop T-Shirts"
                aria-invalid={!form.title.trim()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hi-subtitle">Subtitle</Label>
              <Input
                id="hi-subtitle"
                value={form.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="Starting at $19.99"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hi-desc">Description</Label>
            <Textarea
              id="hi-desc"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Premium cotton tees with custom printing"
            />
          </div>
          </FormGroup>

          <Separator />

          <FormGroup
            title="Media"
            description="A separate mobile image is used on narrow screens when set."
          >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Image</Label>
              <MediaUpload value={image} onChange={setImage} folder="home-sections" />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile image</Label>
              <MediaUpload
                value={mobileImage}
                onChange={setMobileImage}
                folder="home-sections"
              />
            </div>
          </div>
          </FormGroup>

          <Separator />

          <FormGroup
            title="Call to action"
            description="Where this card sends the customer."
          >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hi-btn-text">Button text</Label>
              <Input
                id="hi-btn-text"
                value={form.button_text}
                onChange={(e) => set("button_text", e.target.value)}
                placeholder="Shop Now"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hi-btn-url">Button URL</Label>
              <Input
                id="hi-btn-url"
                value={form.button_url}
                onChange={(e) => set("button_url", e.target.value)}
                placeholder="/shop/t-shirts"
                className="font-mono"
              />
            </div>
          </div>
          </FormGroup>

          <Separator />

          <FormGroup title="Display">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hi-badge">Badge</Label>
              <Input
                id="hi-badge"
                value={form.badge}
                onChange={(e) => set("badge", e.target.value)}
                placeholder="New"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hi-order">Sort order</Label>
              <Input
                id="hi-order"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Or just drag the row in the list.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <Label className="text-sm">Visible on the storefront</Label>
              <p className="text-xs text-muted-foreground">
                Hidden items stay saved but are not rendered.
              </p>
            </div>
            <StatusToggle isActive={isActive} onToggle={setIsActive} />
          </div>
          </FormGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !form.title.trim()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {item ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Items belong to one section, so each list owns its own drag scope - a row
 * can only be dropped among its siblings, never into another section.
 */
function SectionItemList({
  sectionId,
  items,
  onReload,
  onEdit,
  onDelete,
}: {
  sectionId: number | string;
  items: HomeSectionItemRow[];
  onReload: () => void;
  onEdit: (item: HomeSectionItemRow) => void;
  onDelete: (item: HomeSectionItemRow) => void;
}) {
  const dnd = useDragReorder({
    errorMessage: "Couldn't reorder items.",
    onReorder: async (from, to) => {
      await persistOrder("homeSectionItem", moveArrayItem(items, from, to));
      onReload();
    },
  });

  const toggleItem = async (item: HomeSectionItemRow, next: boolean) => {
    try {
      await manageHomeSectionItems(sectionId, [
        { _action: "update", id: item.id, title: item.title, is_active: next },
      ]);
      toast.success(next ? "Item shown." : "Item hidden.");
      onReload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't update the item."));
    }
  };

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div
          key={String(item.id)}
          {...dnd.dropProps(i)}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-card p-2 transition",
            item.is_active === false && "opacity-60",
            dnd.isDragging(i) && "opacity-40",
            dnd.isOver(i) && "ring-2 ring-ring"
          )}
        >
          <DragHandle
            label={item.title ?? "item"}
            disabled={dnd.saving}
            {...dnd.handleProps(i, items.length)}
          />
          <Thumb
            src={item.image_url}
            className="size-8 rounded"
            fallback={<ImageOff className="size-3.5" />}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium">{item.title}</p>
              {item.badge && <StatusBadge status={item.badge} tone="attention" />}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {item.subtitle || "\u2014"}
              {item.button_url ? ` \u00b7 ${item.button_url}` : ""}
            </p>
          </div>
          <StatusToggle
            isActive={item.is_active !== false}
            onToggle={(next) => toggleItem(item, next)}
          />

          <div className="flex items-center gap-0.5">
            <Button size="sm" variant="outline" onClick={() => onEdit(item)}>
              Edit
            </Button>
            <button
              type="button"
              aria-label="Delete item"
              onClick={() => onDelete(item)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
