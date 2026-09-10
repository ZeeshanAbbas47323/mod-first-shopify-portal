"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsDownUp, ChevronsUpDown, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CategoryTree, buildCategoryTree, flattenCategoryTree, type CategoryTreeNode,
  type CategoryDragState,
} from "@/components/category-tree";
import { ExportMenu } from "@/components/export-menu";
import { moveRow, persistOrder } from "@/lib/sort-order";
import { apiErrorMessage } from "@/lib/auth-api";
import { usePermissions } from "@/stores/menu-store";
import {
  fetchAllProductCategories,
  updateRecordStatus,
  type ProductCategoryRow,
} from "@/lib/admin-api";

const STATUS_OPTIONS = ["active", "inactive"] as const;

const exportColumns = [
  { key: "path", label: "Category path", value: (r: CategoryTreeNode) => r.path.join(" › ") },
  { key: "slug", label: "Slug", value: (r: CategoryTreeNode) => r.slug },
  {
    key: "parent",
    label: "Parent",
    value: (r: CategoryTreeNode) => (r.path.length > 1 ? r.path[r.path.length - 2] : ""),
  },
  { key: "products_count", label: "Products", value: (r: CategoryTreeNode) => r.products_count ?? 0 },
  { key: "status", label: "Status", value: (r: CategoryTreeNode) => (r.is_active !== false ? "Active" : "Inactive") },
  { key: "created_at", label: "Created", value: (r: CategoryTreeNode) => r.created_at ?? "" },
];

function ancestorChainIds(
  node: CategoryTreeNode,
  byId: Map<string, CategoryTreeNode>
): string[] {
  const ids: string[] = [];
  let currentId: string | undefined = String(node.id);
  while (currentId) {
    ids.push(currentId);
    const current: CategoryTreeNode | undefined = byId.get(currentId);
    currentId = current?.parent_id != null ? String(current.parent_id) : undefined;
  }
  return ids;
}

export default function ProductCategoriesPage() {
  const permissions = usePermissions("/products/categories");
  const router = useRouter();

  const [rows, setRows] = React.useState<ProductCategoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllProductCategories()
      .then((r) => {
        if (cancelled) return;
        setRows(r);
        setExpanded(new Set(r.map((c) => String(c.id))));
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(err, "Couldn't load categories."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const tree = React.useMemo(() => buildCategoryTree(rows), [rows]);
  const flat = React.useMemo(() => flattenCategoryTree(tree), [tree]);
  const byId = React.useMemo(
    () => new Map(flat.map((n) => [String(n.id), n])),
    [flat]
  );

  const term = search.trim().toLowerCase();

  const matchedIds = React.useMemo(() => {
    if (!term && !statuses.length) return undefined;
    const set = new Set<string>();
    flat.forEach((n) => {
      const textMatch =
        !term || n.name.toLowerCase().includes(term) || n.slug.toLowerCase().includes(term);
      const isActive = n.is_active !== false;
      const statusOk = !statuses.length || statuses.includes(isActive ? "active" : "inactive");
      if (textMatch && statusOk) {
        ancestorChainIds(n, byId).forEach((id) => set.add(id));
      }
    });
    return set;
  }, [flat, byId, term, statuses]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [drag, setDrag] = React.useState<CategoryDragState>(null);

  const handleReorder = async (
    siblings: CategoryTreeNode[],
    from: number,
    to: number
  ) => {
    const next = [...siblings];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    try {
      await persistOrder("productCategory", next);
      toast.success("Order updated.");
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't reorder the categories."));
    } finally {
      // Refetch either way, so a failed save snaps back to the stored order.
      setRefreshKey((k) => k + 1);
    }
  };

  const handleMove = async (
    node: CategoryTreeNode,
    siblings: CategoryTreeNode[],
    direction: "up" | "down"
  ) => {
    const index = siblings.findIndex((s) => String(s.id) === String(node.id));
    if (index < 0) return;
    try {
      if (await moveRow("productCategory", siblings, index, direction)) {
        setRefreshKey((k) => k + 1);
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't reorder the categories."));
    }
  };

  const handleToggleStatus = async (row: ProductCategoryRow, next: boolean) => {
    try {
      await updateRecordStatus("productCategory", row.id, next);
      toast.success(next ? "Category activated." : "Category deactivated.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't update status."));
    }
  };

  const fetchAllForExport = async () => flat;

  const allIds = React.useMemo(() => flat.map((n) => String(n.id)), [flat]);
  const allExpanded = expanded.size >= allIds.length && allIds.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Product Categories</h1>
          <p className="text-sm text-muted-foreground">
            The full tree, parent to child — {flat.length} categor{flat.length === 1 ? "y" : "ies"}.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu
            filename="categories"
            columns={exportColumns}
            fetchAll={fetchAllForExport}
            total={flat.length}
            noun="category"
            nounPlural="categories"
          />
          {permissions.can_create && (
            <Button onClick={() => router.push("/products/categories/new")}>
              <Plus className="size-4" />
              Add category
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories"
            className="bg-card pl-8"
          />
        </div>
        <MultiSelectFilter label="Status" options={STATUS_OPTIONS} value={statuses} onChange={setStatuses} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(allIds))}
        >
          {allExpanded ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
        {selected.size > 0 && (
          <span className="text-xs text-muted-foreground">
            {selected.size} selected
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-2 underline underline-offset-2 hover:text-foreground"
            >
              clear
            </button>
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 rounded-lg bg-card p-4 ring-1 ring-black/8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <CategoryTree
          nodes={tree}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          selected={selected}
          onToggleSelect={toggleSelect}
          onToggleStatus={handleToggleStatus}
          onRowClick={(row) => router.push(`/products/categories/${row.id}`)}
          matchedIds={matchedIds}
          onMove={permissions.can_edit ? handleMove : undefined}
          onReorder={permissions.can_edit ? handleReorder : undefined}
          drag={drag}
          setDrag={setDrag}
        />
      )}
    </div>
  );
}
