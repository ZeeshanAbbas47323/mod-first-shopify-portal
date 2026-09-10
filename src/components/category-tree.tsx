"use client";

import * as React from "react";
import {
  ChevronDown, ChevronRight, LayoutGrid,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { DragHandle } from "@/components/drag-handle";
import { EmptyState } from "@/components/empty-state";
import { StatusToggle } from "@/components/status-badge";
import { cn, imgUrl } from "@/lib/utils";
import type { ProductCategoryRow } from "@/lib/admin-api";

export interface CategoryTreeNode extends ProductCategoryRow {
  children: CategoryTreeNode[];
  depth: number;
  path: string[];
}

export function buildCategoryTree(rows: ProductCategoryRow[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>();
  rows.forEach((r) => {
    byId.set(String(r.id), { ...r, children: [], depth: 0, path: [] });
  });

  const roots: CategoryTreeNode[] = [];
  byId.forEach((node) => {
    const parentId = node.parent_id != null ? String(node.parent_id) : null;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const assignDepth = (nodes: CategoryTreeNode[], depth: number, path: string[]) => {
    nodes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    nodes.forEach((n) => {
      n.depth = depth;
      n.path = [...path, n.name];
      assignDepth(n.children, depth + 1, n.path);
    });
  };
  assignDepth(roots, 0, []);

  return roots;
}

export function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const out: CategoryTreeNode[] = [];
  const walk = (n: CategoryTreeNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

const imgSrc = (row: ProductCategoryRow) =>
  imgUrl(row.image_url ?? row.image ?? row.banner ?? row.icon ?? null) || null;

/** The row being dragged, the level it belongs to, and the row it is over. */
export type CategoryDragState =
  | { id: string; parentKey: string; overId: string | null }
  | null;

interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleStatus: (row: ProductCategoryRow, next: boolean) => void;
  onRowClick: (row: ProductCategoryRow) => void;
  matchedIds?: Set<string>;
  onMove?: (
    node: CategoryTreeNode,
    siblings: CategoryTreeNode[],
    direction: "up" | "down"
  ) => void;
  onReorder?: (
    siblings: CategoryTreeNode[],
    from: number,
    to: number
  ) => void;
  drag?: CategoryDragState;
  setDrag?: (next: CategoryDragState) => void;
}

export function CategoryTree({
  nodes, expanded, onToggleExpand, selected, onToggleSelect,
  onToggleStatus, onRowClick, matchedIds, onMove, onReorder, drag, setDrag,
}: CategoryTreeProps) {
  if (!nodes.length) {
    return (
      <EmptyState
        title="No categories found"
        hint="Adjust your search, or create a category to start organising products."
      />
    );
  }
  return (
    <div className="rounded-lg bg-card ring-1 ring-black/8">
      <div className="flex items-center gap-3 border-b border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">
        <span className="w-4" />
        <span className="w-4" />
        <span className="flex-1">Category</span>
        <span className="w-20 text-right">Products</span>
        <span className="w-20 text-right">Status</span>
        {onMove && <span className="w-12" />}
      </div>
      <div className="divide-y divide-border">
        {nodes.map((node) => (
          <CategoryTreeRow
            key={node.id}
            node={node}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onToggleStatus={onToggleStatus}
            onRowClick={onRowClick}
            matchedIds={matchedIds}
            onMove={onMove}
            onReorder={onReorder}
            drag={drag}
            setDrag={setDrag}
            parentKey="root"
            siblings={nodes}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryTreeRow({
  node, expanded, onToggleExpand, selected, onToggleSelect,
  onToggleStatus, onRowClick, matchedIds, onMove, onReorder, drag, setDrag,
  parentKey, siblings,
}: {
  node: CategoryTreeNode;
  siblings: CategoryTreeNode[];
  /** Identifies the sibling group, so a row only accepts drops from its own level. */
  parentKey: string;
  onMove?: (
    node: CategoryTreeNode,
    siblings: CategoryTreeNode[],
    direction: "up" | "down"
  ) => void;
  onReorder?: (
    siblings: CategoryTreeNode[],
    from: number,
    to: number
  ) => void;
  drag?: CategoryDragState;
  setDrag?: (next: CategoryDragState) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleStatus: (row: ProductCategoryRow, next: boolean) => void;
  onRowClick: (row: ProductCategoryRow) => void;
  matchedIds?: Set<string>;
}) {
  const id = String(node.id);
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(id);
  const src = imgSrc(node);
  const dimmed = matchedIds && matchedIds.size > 0 && !matchedIds.has(id);
  const index = siblings.findIndex((s) => String(s.id) === id);

  return (
    <>
      <div
        onClick={() => onRowClick(node)}
        onDragOver={(e) => {
          if (!drag || !setDrag || drag.parentKey !== parentKey) return;
          e.preventDefault();
          if (drag.overId !== id) setDrag({ ...drag, overId: id });
        }}
        onDrop={(e) => {
          if (!drag || !setDrag || !onReorder || drag.parentKey !== parentKey) return;
          e.preventDefault();
          const from = siblings.findIndex((s) => String(s.id) === drag.id);
          if (from >= 0 && index >= 0 && from !== index) {
            onReorder(siblings, from, index);
          }
          setDrag(null);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60",
          dimmed && "opacity-40",
          drag?.id === id && "opacity-40",
          drag &&
            drag.parentKey === parentKey &&
            drag.overId === id &&
            drag.id !== id &&
            "bg-primary/5 ring-1 ring-inset ring-ring"
        )}
        style={{ paddingLeft: `${12 + node.depth * 24}px` }}
      >
        <Checkbox
          checked={selected.has(id)}
          onCheckedChange={() => onToggleSelect(id)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select category"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(id);
          }}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center text-muted-foreground",
            !hasChildren && "invisible"
          )}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={node.name}
              className="size-8 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
              <LayoutGrid className="size-3.5 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{node.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">/{node.slug}</p>
          </div>
        </div>

        <span className="w-20 shrink-0 text-right text-sm tabular-nums">
          {node.products_count ?? "—"}
        </span>
        <span className="w-20 shrink-0 text-right" onClick={(e) => e.stopPropagation()}>
          <StatusToggle
            isActive={node.is_active !== false}
            onToggle={(next) => onToggleStatus(node, next)}
          />
        </span>
        {onMove && (
          <span
            className="flex w-12 shrink-0 items-center justify-end gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <DragHandle
              label={node.name}
              draggable
              onDragStart={(e) => {
                if (!setDrag) return;
                setDrag({ id, parentKey, overId: null });
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", id);
              }}
              onDragEnd={() => setDrag?.(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  onMove(node, siblings, "up");
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  onMove(node, siblings, "down");
                }
              }}
            />
          </span>
        )}
      </div>

      {hasChildren && isOpen &&
        node.children.map((child) => (
          <CategoryTreeRow
            key={child.id}
            parentKey={id}
            onReorder={onReorder}
            drag={drag}
            setDrag={setDrag}
            node={child}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onToggleStatus={onToggleStatus}
            onRowClick={onRowClick}
            matchedIds={matchedIds}
            onMove={onMove}
            siblings={node.children}
          />
        ))}
    </>
  );
}
