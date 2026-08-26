"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, StatusToggle } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";
import {
  createMenu,
  deleteRecord,
  fetchMenuTree,
  updateMenu,
  updateRecordStatus,
  updateSortOrder,
  MENU_LINK_TYPES,
  type MenuTreeNode,
} from "@/lib/admin-api";

const STATUS_ITEMS = { all: "All statuses", active: "Active", inactive: "Inactive" };
const MENU_TYPE_ITEMS: Record<string, string> = {
  dashboard: "Dashboard",
  frontend: "Frontend",
};
const LINK_TYPE_ITEMS: Record<string, string> = Object.fromEntries([
  ["all", "All link types"],
  ...MENU_LINK_TYPES.map((t) => [
    t,
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  ]),
]);

const humanize = (v?: string) =>
  v ? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

// ─── Tree helpers ─────────────────────────────────────────────────────────────

/** Every node in the tree, depth-first — used for counts and parent pickers. */
function flatten(nodes: MenuTreeNode[]): MenuTreeNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** Ids of a node and everything under it — invalid parent choices. */
function subtreeIds(node: MenuTreeNode): Set<string> {
  return new Set(flatten([node]).map((n) => String(n.id)));
}

/**
 * Keep nodes matching the predicate plus every ancestor that leads to a match,
 * so search results stay in their place in the hierarchy.
 */
function filterTree(
  nodes: MenuTreeNode[],
  matches: (n: MenuTreeNode) => boolean
): MenuTreeNode[] {
  return nodes
    .map((n) => ({ ...n, children: filterTree(n.children, matches) }))
    .filter((n) => matches(n) || n.children.length > 0);
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function MenuNodeRow({
  node,
  siblings,
  expanded,
  onToggleExpand,
  onEdit,
  onAddChild,
  onToggleStatus,
  onMove,
  onDelete,
}: {
  node: MenuTreeNode;
  siblings: MenuTreeNode[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (node: MenuTreeNode) => void;
  onAddChild: (parent: MenuTreeNode) => void;
  onToggleStatus: (node: MenuTreeNode, next: boolean) => Promise<void>;
  onMove: (node: MenuTreeNode, siblings: MenuTreeNode[], dir: "up" | "down") => void;
  onDelete: (node: MenuTreeNode) => void;
}) {
  const id = String(node.id);
  const isOpen = expanded.has(id);
  const hasChildren = node.children.length > 0;
  const index = siblings.findIndex((s) => String(s.id) === id);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onEdit(node)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit(node);
          }
        }}
        className={cn(
          "group flex cursor-pointer items-center gap-2 border-b border-border px-2 py-2 text-sm transition-colors last:border-b-0 hover:bg-muted/50",
          node.is_active === false && "opacity-60"
        )}
        style={{ paddingLeft: `${node.depth * 22 + 8}px` }}
      >
        {/* Expander */}
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(id);
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {isOpen ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground/40">
            {node.depth > 0 ? <CornerDownRight className="size-3.5" /> : null}
          </span>
        )}

        {/* Name + slug */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "truncate",
                node.depth === 0 ? "font-semibold" : "font-medium"
              )}
            >
              {node.name}
            </p>
            {hasChildren && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                {node.children.length}
              </span>
            )}
            {node.open_in_new_tab && (
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            /{node.slug}
            {node.link_type === "external_url" && node.external_url
              ? ` → ${node.external_url}`
              : ""}
          </p>
        </div>

        {/* Link type */}
        <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">
          {humanize(node.link_type)}
        </span>

        {/* Visibility */}
        <span className="hidden w-20 shrink-0 md:block">
          {node.visibility === false ? (
            <StatusBadge status="Hidden" tone="neutral" />
          ) : (
            <StatusBadge status="Visible" tone="info" />
          )}
        </span>

        {/* Status */}
        <span className="w-20 shrink-0">
          <StatusToggle
            isActive={node.is_active !== false}
            onToggle={(next) => onToggleStatus(node, next)}
          />
        </span>

        {/* Reorder + actions */}
        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="w-6 text-right text-xs text-muted-foreground">
            {node.sort_order ?? "—"}
          </span>
          <button
            type="button"
            aria-label="Move up"
            disabled={index <= 0}
            onClick={() => onMove(node, siblings, "up")}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronUpIcon />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={index < 0 || index >= siblings.length - 1}
            onClick={() => onMove(node, siblings, "down")}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronDownIcon />
          </button>
          <button
            type="button"
            aria-label="Add sub-menu"
            title="Add sub-menu"
            onClick={() => onAddChild(node)}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete menu"
            title="Delete"
            onClick={() => onDelete(node)}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren &&
        isOpen &&
        node.children.map((child) => (
          <MenuNodeRow
            key={child.id}
            node={child}
            siblings={node.children}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onAddChild={onAddChild}
            onToggleStatus={onToggleStatus}
            onMove={onMove}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

// Small inline chevrons so the reorder controls read as up/down, not navigation.
const ChevronUpIcon = () => <ChevronDown className="size-3.5 rotate-180" />;
const ChevronDownIcon = () => <ChevronDown className="size-3.5" />;

// ─── Section ──────────────────────────────────────────────────────────────────

export function MenusSection() {
  const [tree, setTree] = React.useState<MenuTreeNode[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState("");
  const [menuType, setMenuType] = React.useState("dashboard");
  const [linkType, setLinkType] = React.useState("all");
  const [status, setStatus] = React.useState("all");

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MenuTreeNode | null>(null);
  const [presetParentId, setPresetParentId] = React.useState<string>("none");
  const [deleteTarget, setDeleteTarget] = React.useState<MenuTreeNode | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // The tree is fetched per menu_type; the rest is filtered client-side so the
  // hierarchy (and each match's ancestors) stays intact.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMenuTree({ menu_type: menuType })
      .then((nodes) => {
        if (cancelled) return;
        setTree(nodes);
        // Open the top two levels by default — deep menus stay tidy.
        setExpanded(
          new Set(
            flatten(nodes)
              .filter((n) => n.depth < 1 && n.children.length > 0)
              .map((n) => String(n.id))
          )
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setTree([]);
        toast.error(apiErrorMessage(error, "Couldn't load menus."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [menuType, refreshKey]);

  const visibleTree = React.useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const noFilters = !term && linkType === "all" && status === "all";
    if (noFilters) return tree;
    return filterTree(tree, (n) => {
      if (term && !`${n.name} ${n.slug}`.toLowerCase().includes(term)) return false;
      if (linkType !== "all" && n.link_type !== linkType) return false;
      if (status !== "all" && (n.is_active !== false) !== (status === "active"))
        return false;
      return true;
    });
  }, [tree, debouncedSearch, linkType, status]);

  // While filtering, show every remaining branch open.
  const filtering = !!debouncedSearch.trim() || linkType !== "all" || status !== "all";
  const effectiveExpanded = React.useMemo(
    () =>
      filtering
        ? new Set(flatten(visibleTree).map((n) => String(n.id)))
        : expanded,
    [filtering, visibleTree, expanded]
  );

  const allNodes = React.useMemo(() => flatten(tree), [tree]);
  const parentCount = tree.length;

  const toggleExpand = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () =>
    setExpanded(new Set(allNodes.filter((n) => n.children.length).map((n) => String(n.id))));
  const collapseAll = () => setExpanded(new Set());

  const handleToggleStatus = React.useCallback(
    async (node: MenuTreeNode, next: boolean) => {
      try {
        await updateRecordStatus("menu", node.id, next);
        toast.success(next ? "Menu activated." : "Menu deactivated.");
        setRefreshKey((k) => k + 1);
      } catch (error) {
        toast.error(apiErrorMessage(error, "Couldn't update status."));
      }
    },
    []
  );

  // Reordering swaps sort_order with the adjacent sibling — never across branches.
  const handleMove = React.useCallback(
    async (node: MenuTreeNode, siblings: MenuTreeNode[], dir: "up" | "down") => {
      const index = siblings.findIndex((s) => String(s.id) === String(node.id));
      const adjacentIndex = dir === "up" ? index - 1 : index + 1;
      if (index < 0 || adjacentIndex < 0 || adjacentIndex >= siblings.length) return;
      const adjacent = siblings[adjacentIndex];
      try {
        await updateSortOrder("menu", [
          { id: node.id, sort_order: adjacent.sort_order ?? adjacentIndex },
          { id: adjacent.id, sort_order: node.sort_order ?? index },
        ]);
        setRefreshKey((k) => k + 1);
      } catch (error) {
        toast.error(apiErrorMessage(error, "Couldn't reorder menus."));
      }
    },
    []
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const message = await deleteRecord("menu", deleteTarget.id);
      toast.success(message);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't delete the menu."));
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = (parentId: string) => {
    setEditing(null);
    setPresetParentId(parentId);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug"
            className="bg-card pl-8"
          />
        </div>
        <Select
          items={MENU_TYPE_ITEMS}
          value={menuType}
          onValueChange={(v) => setMenuType(v as string)}
        >
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dashboard">Dashboard</SelectItem>
            <SelectItem value="frontend">Frontend</SelectItem>
          </SelectContent>
        </Select>
        <Select
          items={LINK_TYPE_ITEMS}
          value={linkType}
          onValueChange={(v) => setLinkType(v as string)}
        >
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All link types</SelectItem>
            {MENU_LINK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {humanize(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => openCreate("none")}>
          <Plus className="size-4" />
          Add menu
        </Button>
      </div>

      {/* Tree toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {parentCount} top-level {parentCount === 1 ? "menu" : "menus"} ·{" "}
          {allNodes.length} total
          {filtering && ` · ${flatten(visibleTree).length} matching`}
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={expandAll} disabled={filtering}>
            Expand all
          </Button>
          <Button size="sm" variant="outline" onClick={collapseAll} disabled={filtering}>
            Collapse all
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Column header */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-2 text-xs font-medium text-muted-foreground">
          <span className="size-5 shrink-0" />
          <span className="flex-1">Menu</span>
          <span className="hidden w-28 shrink-0 sm:block">Link type</span>
          <span className="hidden w-20 shrink-0 md:block">Visibility</span>
          <span className="w-20 shrink-0">Status</span>
          <span className="w-[104px] shrink-0 text-right">Order</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : visibleTree.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-14 text-center">
            <p className="text-sm font-medium">No menus found</p>
            <p className="text-xs text-muted-foreground">
              {filtering
                ? "Try clearing the filters."
                : `No ${MENU_TYPE_ITEMS[menuType].toLowerCase()} menus yet.`}
            </p>
          </div>
        ) : (
          visibleTree.map((node) => (
            <MenuNodeRow
              key={node.id}
              node={node}
              siblings={visibleTree}
              expanded={effectiveExpanded}
              onToggleExpand={toggleExpand}
              onEdit={(n) => {
                setEditing(n);
                setPresetParentId("none");
                setDialogOpen(true);
              }}
              onAddChild={(parent) => openCreate(String(parent.id))}
              onToggleStatus={handleToggleStatus}
              onMove={handleMove}
              onDelete={setDeleteTarget}
            />
          ))
        )}
      </div>

      <MenuDialog
        editing={editing}
        presetParentId={presetParentId}
        allNodes={allNodes}
        menuType={menuType as "dashboard" | "frontend"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        loading={deleting}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.name ?? ""}"?`}
        description={
          deleteTarget?.children.length
            ? `This menu has ${deleteTarget.children.length} sub-menu${
                deleteTarget.children.length === 1 ? "" : "s"
              }. Deleting it may leave them without a parent.`
            : "This can't be undone."
        }
      />
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

const STATUS_FORM_ITEMS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
};
const MENU_TYPE_FORM_ITEMS: Record<string, string> = {
  dashboard: "Dashboard",
  frontend: "Frontend",
};
const LINK_TYPE_FORM_ITEMS: Record<string, string> = Object.fromEntries(
  MENU_LINK_TYPES.map((t) => [
    t,
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  ])
);

const menuSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/, "Lowercase letters, numbers, / and -"),
  menu_type: z.enum(["frontend", "dashboard"]),
  parent_id: z.string(),
  link_type: z.string().min(1, "Link type is required"),
  sort_order: z.number({ error: "Must be a number" }).int().min(0).optional(),
  icon: z.string().optional(),
  external_url: z.string().optional(),
  open_in_new_tab: z.boolean().optional(),
  visibility: z.enum(["visible", "hidden"]),
  status: z.enum(["active", "inactive"]),
});
type MenuValues = z.infer<typeof menuSchema>;

function MenuDialog({
  editing,
  presetParentId,
  allNodes,
  menuType,
  open,
  onOpenChange,
  onSaved,
}: {
  editing: MenuTreeNode | null;
  presetParentId: string;
  allNodes: MenuTreeNode[];
  menuType: "dashboard" | "frontend";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MenuValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: "",
      slug: "",
      menu_type: menuType,
      parent_id: "none",
      link_type: "custom",
      sort_order: undefined,
      icon: "",
      external_url: "",
      open_in_new_tab: false,
      visibility: "visible",
      status: "active",
    },
  });

  const watchedName = useWatch({ control, name: "name" });
  const slugDirty = React.useRef(false);

  React.useEffect(() => {
    if (open) {
      slugDirty.current = !!editing;
      reset({
        name: editing?.name ?? "",
        slug: editing?.slug ?? "",
        menu_type: editing?.menu_type ?? menuType,
        parent_id: editing
          ? editing.parent_id != null
            ? String(editing.parent_id)
            : "none"
          : presetParentId,
        link_type: editing?.link_type ?? "custom",
        sort_order: editing?.sort_order,
        icon: editing?.icon ?? "",
        external_url: editing?.external_url ?? "",
        open_in_new_tab: editing?.open_in_new_tab ?? false,
        visibility: editing?.visibility === false ? "hidden" : "visible",
        status: editing?.is_active === false ? "inactive" : "active",
      });
    }
  }, [open, editing, presetParentId, menuType, reset]);

  // Auto-slug from name while creating
  React.useEffect(() => {
    if (!editing && !slugDirty.current) {
      setValue(
        "slug",
        watchedName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9/\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  }, [watchedName, editing, setValue]);

  const linkType = watch("link_type");

  // A menu can't be its own parent, nor sit under one of its descendants.
  const parentOptions = React.useMemo(() => {
    const blocked = editing ? subtreeIds(editing) : new Set<string>();
    return allNodes.filter((n) => !blocked.has(String(n.id)));
  }, [allNodes, editing]);

  const parentItems = React.useMemo<Record<string, string>>(
    () => ({
      none: "None (top level)",
      ...Object.fromEntries(
        parentOptions.map((n) => [
          String(n.id),
          `${"— ".repeat(n.depth)}${n.name}`,
        ])
      ),
    }),
    [parentOptions]
  );

  const onSubmit = async (values: MenuValues) => {
    const body = {
      name: values.name,
      slug: values.slug,
      menu_type: values.menu_type,
      parent_id: values.parent_id === "none" ? null : Number(values.parent_id),
      link_type: values.link_type,
      sort_order: values.sort_order ?? undefined,
      icon: values.icon || undefined,
      external_url:
        values.link_type === "external_url" ? values.external_url : undefined,
      open_in_new_tab: values.open_in_new_tab,
      visibility: values.visibility === "visible",
      is_active: values.status === "active",
    };
    try {
      const message = editing
        ? await updateMenu(editing.id, body)
        : await createMenu(body);
      toast.success(message);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the menu.`)
      );
    }
  };

  const parentName =
    presetParentId !== "none"
      ? allNodes.find((n) => String(n.id) === presetParentId)?.name
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit menu" : "Add menu"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update "${editing.name}".`
              : parentName
                ? `New sub-menu under "${parentName}".`
                : "Create a new navigation menu item."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="menu-name">Name</Label>
              <Input
                id="menu-name"
                placeholder="Users Management"
                aria-invalid={!!errors.name}
                {...register("name")}
                onChange={(e) => {
                  slugDirty.current = false;
                  register("name").onChange(e);
                }}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-slug">Slug</Label>
              <Input
                id="menu-slug"
                placeholder="users"
                className="font-mono"
                aria-invalid={!!errors.slug}
                {...register("slug", {
                  onChange: () => {
                    slugDirty.current = true;
                  },
                })}
              />
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Parent menu</Label>
            <Controller
              control={control}
              name="parent_id"
              render={({ field }) => (
                <Select
                  items={parentItems}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">None (top level)</SelectItem>
                    {parentOptions.map((n) => (
                      <SelectItem key={n.id} value={String(n.id)}>
                        {"— ".repeat(n.depth)}
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              Pick a parent to nest this item as a sub-menu.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Menu type</Label>
              <Controller
                control={control}
                name="menu_type"
                render={({ field }) => (
                  <Select
                    items={MENU_TYPE_FORM_ITEMS}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dashboard">Dashboard</SelectItem>
                      <SelectItem value="frontend">Frontend</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Link type</Label>
              <Controller
                control={control}
                name="link_type"
                render={({ field }) => (
                  <Select
                    items={LINK_TYPE_FORM_ITEMS}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_LINK_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {humanize(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {linkType === "external_url" && (
            <div className="space-y-1.5">
              <Label htmlFor="menu-url">External URL</Label>
              <Input
                id="menu-url"
                placeholder="https://example.com"
                {...register("external_url")}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="menu-icon">Icon class</Label>
              <Input id="menu-icon" placeholder="fa-shopping-bag" {...register("icon")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="menu-order">Sort order</Label>
              <Input
                id="menu-order"
                type="number"
                min={0}
                placeholder="1"
                {...register("sort_order", { valueAsNumber: true })}
              />
              {errors.sort_order && (
                <p className="text-sm text-destructive">{errors.sort_order.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Controller
                control={control}
                name="visibility"
                render={({ field }) => (
                  <Select
                    items={{ visible: "Visible", hidden: "Hidden" }}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visible">Visible</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    items={STATUS_FORM_ITEMS}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col justify-end space-y-1.5">
              <Label className="invisible">Open in new tab</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
                <input type="checkbox" className="accent-primary" {...register("open_in_new_tab")} />
                New tab
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Save menu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

