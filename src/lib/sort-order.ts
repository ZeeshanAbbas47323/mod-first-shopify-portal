import { updateSortOrder, type SortOrderTable } from "@/lib/admin-api";

interface Sortable {
  id: number | string;
  sort_order?: number | null;
}

export function bySortOrder<T extends Sortable>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        (a.row.sort_order ?? 0) - (b.row.sort_order ?? 0) || a.index - b.index
    )
    .map(({ row }) => row);
}

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
