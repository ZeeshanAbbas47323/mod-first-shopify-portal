"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * "fulfillmentStatus" → "Fulfillment status", "order_number" → "Order number".
 * Column ids come from `accessorKey`, which is a raw API field name — some
 * camelCase, some snake_case — so both need splitting or the picker showed
 * "Order_number" verbatim.
 */
function humanizeColumnId(id: string) {
  const spaced = id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

interface ServerPagination {
  pageIndex: number;
  pageCount: number;
  total: number;
  onPageChange: (pageIndex: number) => void;
  /** Rows per page. Pass with onPageSizeChange to show the length selector. */
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
}

/**
 * Server-side sorting. Without this the table can only reorder the rows of the
 * page it happens to be holding, which reads as a broken sort on any list with
 * more than one page.
 */
interface ServerSort {
  /** Current backend sort key, or undefined while the list is unsorted. */
  sortBy?: string;
  order?: "asc" | "desc";
  /**
   * Column id → backend sort key. Columns absent from this map can't sort.
   * Some endpoints (products) take an enum that already encodes the direction
   * — those columns map to a `{ asc, desc }` pair instead of one key.
   */
  columnMap: Record<string, string | { asc: string; desc: string }>;
  onSortChange: (sortBy: string | undefined, order: "asc" | "desc") => void;
}

function sortKeyFor(
  entry: string | { asc: string; desc: string } | undefined,
  order: "asc" | "desc"
): string | undefined {
  if (!entry) return undefined;
  return typeof entry === "string" ? entry : entry[order];
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  onRowClick?: (row: TData) => void;
  toolbar?: React.ReactNode;
  /** Pass when rows are fetched from an API page by page. */
  serverPagination?: ServerPagination;
  /** Pass to sort on the server instead of within the loaded page. */
  serverSort?: ServerSort;
  /** Receives the currently selected rows, for bulk actions in the toolbar. */
  onSelectionChange?: (rows: TData[]) => void;
  /** Bump this to clear the selection after a bulk action completes. */
  clearSelectionKey?: number;
  loading?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search…",
  onRowClick,
  toolbar,
  serverPagination,
  serverSort,
  loading = false,
  onSelectionChange,
  clearSelectionKey,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // Client-side page size, used only when the caller isn't paging on the server.
  const [clientPageSize, setClientPageSize] = React.useState<number>(10);

  // With server sorting the backend has already ordered the rows, so re-sorting
  // them here would only shuffle the current page.
  const sortingState: SortingState = serverSort
    ? serverSort.sortBy
      ? [
          {
            id:
              Object.keys(serverSort.columnMap).find(
                (col) =>
                  sortKeyFor(serverSort.columnMap[col], "asc") ===
                    serverSort.sortBy ||
                  sortKeyFor(serverSort.columnMap[col], "desc") ===
                    serverSort.sortBy
              ) ?? serverSort.sortBy,
            desc: serverSort.order === "desc",
          },
        ]
      : []
    : sorting;

  const handleSortingChange: typeof setSorting = (updater) => {
    if (!serverSort) {
      setSorting(updater);
      return;
    }
    const next =
      typeof updater === "function" ? updater(sortingState) : updater;
    const first = next[0];
    if (!first) {
      serverSort.onSortChange(undefined, "asc");
      return;
    }
    const order = first.desc ? "desc" : "asc";
    const key = sortKeyFor(serverSort.columnMap[first.id], order);
    if (!key) return; // Column isn't sortable on the server — ignore the click.
    serverSort.onSortChange(key, order);
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(serverSort ? {} : { getSortedRowModel: getSortedRowModel() }),
    getFilteredRowModel: getFilteredRowModel(),
    ...(serverPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    manualSorting: !!serverSort,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    initialState: { pagination: { pageSize: 10 } },
    state: { sorting: sortingState, columnFilters, columnVisibility, rowSelection },
  });

  // Keep the client-side table in step with the length selector.
  React.useEffect(() => {
    if (!serverPagination) table.setPageSize(clientPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientPageSize]);

  const pageSize = serverPagination?.pageSize ?? clientPageSize;
  const onPageSizeChange = serverPagination
    ? serverPagination.onPageSizeChange
    : setClientPageSize;

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Hand the selected originals up so the page can act on them.
  React.useEffect(() => {
    onSelectionChange?.(selectedRows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  React.useEffect(() => {
    if (clearSelectionKey !== undefined) setRowSelection({});
  }, [clearSelectionKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {searchKey && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
              onChange={(e) =>
                table.getColumn(searchKey)?.setFilterValue(e.target.value)
              }
              className="bg-card pl-8"
            />
          </div>
        )}
        {toolbar}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="ml-auto">
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Columns</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-52 p-1">
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="py-1.5 pl-2"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {humanizeColumnId(column.id)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-lg bg-card ring-1 ring-black/8">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const sortKey = serverSort?.columnMap[header.column.id];
                    const sortable = serverSort
                      ? !!sortKey
                      : header.column.getCanSort();
                    const dir = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className="h-10 bg-[#f7f7f7] text-xs font-medium text-muted-foreground first:rounded-tl-lg last:rounded-tr-lg lg:sticky lg:z-10"
                        aria-sort={
                          dir === "asc"
                            ? "ascending"
                            : dir === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {dir === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : dir === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading && data.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j} className="py-3">
                        <div className="h-4 w-full max-w-32 animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => onRowClick?.(row.original)}
                    className={onRowClick ? "cursor-pointer" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <svg
                        width="64"
                        height="64"
                        viewBox="0 0 64 64"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <rect x="8" y="16" width="48" height="36" rx="4" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
                        <rect x="8" y="16" width="48" height="10" rx="4" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
                        <line x1="16" y1="35" x2="32" y2="35" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
                        <line x1="16" y1="42" x2="26" y2="42" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="46" cy="44" r="10" fill="var(--background, white)" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
                        <line x1="43" y1="44" x2="49" y2="44" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">No results found</p>
                        <p className="mt-0.5 text-xs">Try adjusting your filters or search query.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} of ${table.getFilteredRowModel().rows.length} selected`
              : `${serverPagination?.total ?? table.getFilteredRowModel().rows.length} result${(serverPagination?.total ?? table.getFilteredRowModel().rows.length) === 1 ? "" : "s"}`}
          </p>
          {onPageSizeChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Show</span>
              <Select
                items={Object.fromEntries(
                  PAGE_SIZE_OPTIONS.map((n) => [String(n), String(n)])
                )}
                value={String(pageSize)}
                onValueChange={(v) => onPageSizeChange(Number(v))}
              >
                <SelectTrigger className="h-8 w-18 bg-card text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">per page</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              serverPagination
                ? serverPagination.onPageChange(serverPagination.pageIndex - 1)
                : table.previousPage()
            }
            disabled={
              serverPagination
                ? serverPagination.pageIndex <= 0 || loading
                : !table.getCanPreviousPage()
            }
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-xs text-muted-foreground">
            Page {(serverPagination?.pageIndex ?? table.getState().pagination.pageIndex) + 1} of{" "}
            {Math.max(serverPagination?.pageCount ?? table.getPageCount(), 1)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              serverPagination
                ? serverPagination.onPageChange(serverPagination.pageIndex + 1)
                : table.nextPage()
            }
            disabled={
              serverPagination
                ? serverPagination.pageIndex >= serverPagination.pageCount - 1 || loading
                : !table.getCanNextPage()
            }
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
