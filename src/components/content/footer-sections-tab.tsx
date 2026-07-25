"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ChevronDown, ChevronUp, GripVertical, Loader2,
  Plus, Save, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MediaUpload } from "@/components/media-upload";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  listFooterSections,
  createFooterSection,
  updateFooterSection,
  manageFooterLinks,
  type FooterSectionRow,
  type FooterLinkRow,
} from "@/lib/admin-api";

const LINK_TYPES = ["url", "route", "email", "phone"] as const;
const LINK_TARGETS = ["_self", "_blank"] as const;

// ─── Link Row Editor ──────────────────────────────────────────────────────────

function LinkEditor({
  link,
  onChange,
  onRemove,
}: {
  link: FooterLinkRow & { _localId: string; _isNew?: boolean };
  onChange: (updated: Partial<FooterLinkRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3">
      <GripVertical className="mt-2 size-4 shrink-0 text-muted-foreground" />
      <div className="grid flex-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={link.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="About Us"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">URL</Label>
          <Input
            value={link.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="/about"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={link.type ?? "url"} onValueChange={(v) => onChange({ type: v ?? "url" })}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINK_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Target</Label>
          <Select value={link.target ?? "_self"} onValueChange={(v) => onChange({ target: v ?? "_self" })}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINK_TARGETS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

type LocalLink = FooterLinkRow & { _localId: string; _isNew?: boolean; _deleted?: boolean };

function SectionCard({ section, onSaved }: { section: FooterSectionRow; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Section fields
  const [title, setTitle] = React.useState(section.title ?? "");
  const [description, setDescription] = React.useState(section.description ?? "");
  const [imageUrl, setImageUrl] = React.useState<string | null>(section.image_url ?? null);
  const [isActive, setIsActive] = React.useState(section.is_active ?? true);
  const [sortOrder, setSortOrder] = React.useState(String(section.sort_order ?? 0));

  // Links local state
  const [links, setLinks] = React.useState<LocalLink[]>(() =>
    (section.links ?? []).map((l) => ({ ...l, _localId: String(l.id ?? Math.random()) }))
  );

  const addLink = () => {
    setLinks((prev) => [
      ...prev,
      { _localId: String(Math.random()), _isNew: true, name: "", url: "", type: "url", target: "_self", sort_order: prev.length },
    ]);
  };

  const updateLink = (localId: string, patch: Partial<FooterLinkRow>) => {
    setLinks((prev) => prev.map((l) => l._localId === localId ? { ...l, ...patch } : l));
  };

  const removeLink = (localId: string) => {
    setLinks((prev) => prev.map((l) =>
      l._localId === localId
        ? l._isNew ? null! : { ...l, _deleted: true }
        : l
    ).filter(Boolean));
  };

  const save = async () => {
    setSaving(true);
    try {
      // 1. Update section metadata
      await updateFooterSection(section.id, {
        title: title || undefined,
        description: description || undefined,
        image_url: imageUrl || undefined,
        is_active: isActive,
        sort_order: parseInt(sortOrder) || 0,
      });

      // 2. Manage links
      const actions: ({ _action: "add" | "update" | "delete"; [k: string]: unknown })[] = [];

      links.forEach((l) => {
        if (l._deleted && l.id) {
          actions.push({ _action: "delete", id: l.id });
        } else if (l._isNew && !l._deleted) {
          actions.push({ _action: "add", name: l.name, url: l.url, type: l.type ?? "url", target: l.target ?? "_self", sort_order: l.sort_order ?? 0 });
        } else if (!l._isNew && !l._deleted && l.id) {
          actions.push({ _action: "update", id: l.id, name: l.name, url: l.url, type: l.type, target: l.target });
        }
      });

      if (actions.length > 0) {
        await manageFooterLinks(section.id, actions);
      }

      toast.success("Footer section saved.");
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't save footer section."));
    } finally {
      setSaving(false);
    }
  };

  const visibleLinks = links.filter((l) => !l._deleted);

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center justify-between gap-3 py-1 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{section.title || section.section_key || `Section #${section.id}`}</span>
            {section.section_key && (
              <Badge variant="outline" className="font-mono text-xs">{section.section_key}</Badge>
            )}
            <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
              {isActive ? "Active" : "Inactive"}
            </Badge>
            <span className="text-xs text-muted-foreground">{visibleLinks.length} link{visibleLinks.length !== 1 ? "s" : ""}</span>
          </div>
          {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>
      </CardHeader>

      {open && (
        <>
          <Separator className="mt-3" />
          <CardContent className="space-y-5 pt-4">
            {/* Section metadata */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`title-${section.id}`}>Title</Label>
                <Input id={`title-${section.id}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Company" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`sort-${section.id}`}>Sort order</Label>
                <Input id={`sort-${section.id}`} type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`desc-${section.id}`}>Description</Label>
                <Textarea id={`desc-${section.id}`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description shown in footer…" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Image</Label>
                <MediaUpload value={imageUrl} onChange={setImageUrl} folder="footer" />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    <div className="h-5 w-9 rounded-full bg-muted transition-colors peer-checked:bg-[#29845a]" />
                    <div className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>
            </div>

            {/* Links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Links</p>
                <Button type="button" variant="outline" size="sm" onClick={addLink}>
                  <Plus className="size-3.5" /> Add link
                </Button>
              </div>

              {visibleLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No links yet. Add the first one.</p>
              ) : (
                <div className="space-y-2">
                  {visibleLinks.map((link) => (
                    <LinkEditor
                      key={link._localId}
                      link={link}
                      onChange={(patch) => updateLink(link._localId, patch)}
                      onRemove={() => removeLink(link._localId)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Saving…" : "Save section"}
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

// ─── Add Section Dialog ───────────────────────────────────────────────────────

function AddSectionDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [sectionKey, setSectionKey] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [sortOrder, setSortOrder] = React.useState("0");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSectionKey(""); setTitle(""); setDescription("");
      setImageUrl(null); setSortOrder("0");
    }
  }, [open]);

  const create = async () => {
    const key = sectionKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!key) {
      toast.error("Section key is required.");
      return;
    }
    setSaving(true);
    try {
      const msg = await createFooterSection({
        section_key: key,
        title: title || undefined,
        description: description || undefined,
        image_url: imageUrl || undefined,
        sort_order: parseInt(sortOrder) || 0,
        is_active: true,
      });
      toast.success(msg);
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't create footer section."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add footer section</DialogTitle>
          <DialogDescription>Create a new section for the storefront footer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fs-key">Section key *</Label>
            <Input id="fs-key" value={sectionKey} onChange={(e) => setSectionKey(e.target.value)}
              placeholder="main_footer" className="font-mono" />
            <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fs-title">Title</Label>
            <Input id="fs-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Company" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fs-desc">Description</Label>
            <Textarea id="fs-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown in footer…" />
          </div>
          <div className="space-y-1.5">
            <Label>Image</Label>
            <MediaUpload value={imageUrl} onChange={setImageUrl} folder="footer" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fs-sort">Sort order</Label>
            <Input id="fs-sort" type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={create} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export function FooterSectionsTab() {
  const [sections, setSections] = React.useState<FooterSectionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    listFooterSections()
      .then(setSections)
      .catch(() => toast.error("Couldn't load footer sections."))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Add section
        </Button>
      </div>

      <AddSectionDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted" />)}
        </div>
      ) : !sections.length ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No footer sections found.
        </div>
      ) : (
        sections
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => (
            <SectionCard key={s.id} section={s} onSaved={load} />
          ))
      )}
    </div>
  );
}
