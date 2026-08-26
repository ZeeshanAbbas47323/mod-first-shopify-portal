"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { MediaUpload } from "@/components/media-upload";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn, imgUrl } from "@/lib/utils";
import {
  createHomeSection,
  deleteRecord,
  fetchAllHomeSections,
  manageHomeSectionItems,
  updateHomeSection,
  updateRecordStatus,
  updateSortOrder,
  type HomeSectionItemAction,
  type HomeSectionItemRow,
  type HomeSectionRow,
} from "@/lib/admin-api";

const LAYOUT_HINTS = [
  "hero", "hero_full", "banner", "grid", "carousel", "slider", "features", "cta",
];

const slugKey = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s_]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_");

export function ThemeSection() {
  const [sections, setSections] = React.useState<HomeSectionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = React.useState(0);

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

  // Reordering swaps sort_order with the neighbouring section.
  const move = async (index: number, dir: "up" | "down") => {
    const target = index + (dir === "up" ? -1 : 1);
    if (target < 0 || target >= sections.length) return;
    const a = sections[index];
    const b = sections[target];
    try {
      await updateSortOrder("homeSection", [
        { id: a.id, sort_order: b.sort_order ?? target },
        { id: b.id, sort_order: a.sort_order ?? index },
      ]);
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't reorder sections."));
    }
  };

  const moveItem = async (
    section: HomeSectionRow,
    items: HomeSectionItemRow[],
    index: number,
    dir: "up" | "down"
  ) => {
    const target = index + (dir === "up" ? -1 : 1);
    if (target < 0 || target >= items.length) return;
    try {
      await updateSortOrder("homeSectionItem", [
        { id: items[index].id, sort_order: items[target].sort_order ?? target },
        { id: items[target].id, sort_order: items[index].sort_order ?? index },
      ]);
      reload();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't reorder items."));
    }
  };

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Blocks that make up the storefront home page, in the order they appear.
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add section
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Layers className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">No home sections yet</p>
            <p className="text-xs text-muted-foreground">
              Add a hero, banner or product grid to build the home page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sections.map((section, index) => {
            const id = String(section.id);
            const isOpen = expanded.has(id);
            const items = [...(section.items ?? [])].sort(
              (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
            );
            return (
              <Card
                key={id}
                className={cn(
                  "overflow-hidden py-0 shadow-none",
                  section.is_active === false && "opacity-70"
                )}
              >
                {/* Section header */}
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

                  {section.background_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgUrl(section.background_image)}
                      alt=""
                      className="size-9 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <span
                      className="flex size-9 items-center justify-center rounded-lg border border-border"
                      style={{ background: section.background_color ?? undefined }}
                    >
                      <Layers className="size-4 text-muted-foreground" />
                    </span>
                  )}

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
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, "up")}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-25"
                    >
                      <ChevronDown className="size-3.5 rotate-180" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === sections.length - 1}
                      onClick={() => move(index, "down")}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-25"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
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

                {/* Items */}
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
                      <div className="space-y-1.5">
                        {items.map((item, i) => (
                          <div
                            key={String(item.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border border-border bg-card p-2",
                              item.is_active === false && "opacity-60"
                            )}
                          >
                            <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />
                            {item.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgUrl(item.image_url)}
                                alt=""
                                className="size-8 rounded border border-border object-cover"
                              />
                            ) : (
                              <span className="size-8 rounded border border-border bg-muted" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-sm font-medium">{item.title}</p>
                                {item.badge && (
                                  <StatusBadge status={item.badge} tone="attention" />
                                )}
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {item.subtitle || "—"}
                                {item.button_url ? ` · ${item.button_url}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                aria-label="Move item up"
                                disabled={i === 0}
                                onClick={() => moveItem(section, items, i, "up")}
                                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-25"
                              >
                                <ChevronDown className="size-3.5 rotate-180" />
                              </button>
                              <button
                                type="button"
                                aria-label="Move item down"
                                disabled={i === items.length - 1}
                                onClick={() => moveItem(section, items, i, "down")}
                                className="rounded p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-25"
                              >
                                <ChevronDown className="size-3.5" />
                              </button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setItemTarget({ section, item })}
                              >
                                Edit
                              </Button>
                              <button
                                type="button"
                                aria-label="Delete item"
                                onClick={() => setItemDelete({ section, item })}
                                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
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

// ─── Section dialog ───────────────────────────────────────────────────────────

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
    setSettings(
      editing?.section_settings
        ? JSON.stringify(editing.section_settings, null, 2)
        : ""
    );
    setSettingsError(null);
  }, [open, editing, nextSortOrder]);

  const set = (key: keyof typeof empty, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Derive the key from the name while creating, until it's edited by hand.
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit section" : "Add home section"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update "${editing.section_name || editing.section_key}".`
              : "A block on the storefront home page — hero, banner, grid and so on."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hs-name">Section name</Label>
              <Input
                id="hs-name"
                value={form.section_name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Hero Banner Section"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hs-key">Section key</Label>
              <Input
                id="hs-key"
                value={form.section_key}
                onChange={(e) => {
                  keyDirty.current = true;
                  set("section_key", slugKey(e.target.value));
                }}
                placeholder="home_hero"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase and underscores — the storefront looks the section up by this.
              </p>
            </div>
          </div>

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

          <div className="space-y-1.5">
            <Label>Background image</Label>
            <MediaUpload value={background} onChange={setBackground} folder="home-sections" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="hs-bg">Background colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(form.background_color) ? form.background_color : "#ffffff"}
                  onChange={(e) => set("background_color", e.target.value)}
                  className="size-9 cursor-pointer rounded border border-input bg-transparent"
                  aria-label="Pick background colour"
                />
                <Input
                  id="hs-bg"
                  value={form.background_color}
                  onChange={(e) => set("background_color", e.target.value)}
                  placeholder="#030303"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hs-layout">Layout type</Label>
              <Input
                id="hs-layout"
                value={form.layout_type}
                onChange={(e) => set("layout_type", e.target.value)}
                placeholder="hero"
                list="layout-hints"
              />
              <datalist id="layout-hints">
                {LAYOUT_HINTS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hs-order">Sort order</Label>
              <Input
                id="hs-order"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hs-settings">Section settings (JSON)</Label>
            <Textarea
              id="hs-settings"
              rows={4}
              value={settings}
              onChange={(e) => {
                setSettings(e.target.value);
                setSettingsError(null);
              }}
              placeholder={'{\n  "autoplay": true,\n  "interval": 5000\n}'}
              className="font-mono text-xs"
              spellCheck={false}
            />
            {settingsError && <p className="text-sm text-destructive">{settingsError}</p>}
            <p className="text-xs text-muted-foreground">
              Extra config the storefront reads — autoplay, interval, mobile layout, etc.
            </p>
          </div>
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

// ─── Item dialog ──────────────────────────────────────────────────────────────

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
        is_active: true,
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
          <DialogDescription>
            {target
              ? `In "${target.section.section_name || target.section.section_key}".`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hi-title">Title</Label>
              <Input
                id="hi-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Shop T-Shirts"
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
            </div>
          </div>
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
