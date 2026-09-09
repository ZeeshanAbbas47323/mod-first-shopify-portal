import { updateSortOrder, type SortOrderTable } from "@/lib/admin-api";

interface Sortable {
  id: number | string;
  sort_order?: number | null;
}

/** The list in the order the API returns it — sort_order first, stable otherwise. */
export function bySortOrder<T extends Sortable>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        (a.row.sort_order ?? 0) - (b.row.sort_order ?? 0) || a.index - b.index
    )
    .map(({ row }) => row);
}

/**
 * Move one row up or down and persist the new order.
 *
 * Every sortable column defaults to 0, so a list that has never been sorted has
 * every row sharing a sort_order. Swapping just the two neighbours' values then
 * writes 0 over 0 and the row visibly doesn't move — so the whole list is
 * renumbered instead. The endpoint applies the batch in one transaction.
 *
 * Returns the reordered rows for an optimistic update, or null at the ends.
 */
export async function moveRow<T extends Sortable>(
  table: SortOrderTable,
  rows: T[],
  index: number,
  direction: "up" | "down"
): Promise<T[] | null> {
  const target = index + (direction === "up" ? -1 : 1);
  if (target < 0 || target >= rows.length) return null;

  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];

  await updateSortOrder(
    table,
    next.map((row, i) => ({ id: row.id, sort_order: i }))
  );
  return next;
}
