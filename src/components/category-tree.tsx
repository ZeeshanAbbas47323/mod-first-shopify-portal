"use client";

import * as React from "react";
import {
  ChevronDown, ChevronRight, LayoutGrid,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { StatusToggle } from "@/components/status-badge";
import { cn, imgUrl } from "@/lib/utils";
import type { ProductCategoryRow } from "@/lib/admin-api";

export interface CategoryTreeNode extends ProductCategoryRow {
  children: CategoryTreeNode[];
  depth: number;
  path: string[];
}

/** Flat rows (each carrying `parent_id`) → a real tree, root-first. Orphans
 * (a parent_id pointing at a category not in this set — soft-deleted or
 * outside the fetch limit) are surfaced as roots rather than silently
 * dropped, so nothing vanishes from the listing. */
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
    nodes.forEach((n) => {
      n.depth = depth;
      n.path = [...path, n.name];
      assignDepth(n.children, depth + 1, n.path);
    });
  };
  assignDepth(roots, 0, []);

  return roots;
}

/** Depth-first flatten, for CSV export or a "no tree" fallback. */
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

interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  /** Ids whose subtree should render expanded. Everything else stays collapsed. */
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleStatus: (row: ProductCategoryRow, next: boolean) => void;
  onRowClick: (row: ProductCategoryRow) => void;
  /** Ids to keep highlighted, e.g. search matches. */
  matchedIds?: Set<string>;
}

export function CategoryTree({
  nodes, expanded, onToggleExpand, selected, onToggleSelect,
  onToggleStatus, onRowClick, matchedIds,
}: CategoryTreeProps) {
  if (!nodes.length) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No categories found.
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-card ring-1 ring-black/8">
      <div className="flex items-center gap-3 border-b border-border bg-[#f7f7f7] px-3 py-2 text-xs font-medium text-muted-foreground">
        <span className="w-4" />
        <span className="w-4" />
        <span className="flex-1">Category</span>
        <span className="w-20 text-right">Products</span>
        <span className="w-20 text-right">Status</span>
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
          />
        ))}
      </div>
    </div>
  );
}

function CategoryTreeRow({
  node, expanded, onToggleExpand, selected, onToggleSelect,
  onToggleStatus, onRowClick, matchedIds,
}: {
  node: CategoryTreeNode;
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

  return (
    <>
      <div
        onClick={() => onRowClick(node)}
        className={cn(
          "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/60",
          dimmed && "opacity-40"
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
      </div>

      {hasChildren && isOpen &&
        node.children.map((child) => (
          <CategoryTreeRow
            key={child.id}
            node={child}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            selected={selected}
            onToggleSelect={onToggleSelect}
            onToggleStatus={onToggleStatus}
            onRowClick={onRowClick}
            matchedIds={matchedIds}
          />
        ))}
    </>
  );
}
