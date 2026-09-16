"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Package } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { imgUrl } from "@/lib/utils";
import { listProducts, type ProductRow } from "@/lib/admin-api";

export function CategoryProductsPreviewPopover({
  categoryId,
  count,
}: {
  categoryId: number | string;
  count?: number;
}) {
  const router = useRouter();
  const [products, setProducts] = React.useState<ProductRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = () => {
    if (products !== null) return;
    setLoading(true);
    listProducts({ page: 1, limit: 8, filters: { category_id: categoryId } })
      .then((res) => setProducts(res.rows))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  if (!count) {
    return <span className="w-20 shrink-0 text-right text-sm tabular-nums">—</span>;
  }

  return (
    <Popover onOpenChange={(open) => open && load()}>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="w-20 shrink-0 text-right text-sm tabular-nums hover:text-link hover:underline"
          >
            {count}
          </button>
        }
      />
      <PopoverContent align="end" className="w-72" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {count} product{count === 1 ? "" : "s"}
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : !products?.length ? (
          <p className="py-2 text-sm text-muted-foreground">No products found.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/products/${p.id}`);
                }}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-muted"
              >
                <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {p.featured_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl(p.featured_image)} alt={p.title} className="size-full object-cover" />
                  ) : (
                    <Package className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className="truncate text-sm">{p.title}</span>
              </button>
            ))}
            {count > products.length && (
              <p className="px-1.5 pt-1 text-xs text-muted-foreground">
                +{count - products.length} more
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
