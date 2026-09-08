"use client";

import * as React from "react";
import { use } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/auth-api";
import { CategoryForm } from "@/components/products/category-form";
import type { ProductCategoryRow } from "@/lib/admin-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

async function fetchCategory(id: string): Promise<ProductCategoryRow> {
  const { data } = await api.get(`product-categories/get/${id}`);
  const p: Json = data?.payload ?? data?.data ?? data ?? {};
  return (p.category ?? p) as ProductCategoryRow;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="h-48 rounded-xl bg-muted" />
          <div className="h-64 rounded-xl bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="h-28 rounded-xl bg-muted" />
          <div className="h-28 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [category, setCategory] = React.useState<ProductCategoryRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCategory(id)
      .then(setCategory)
      .catch((e) => {
        const msg = apiErrorMessage(e, "Couldn't load category.");
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Skeleton />;
  if (error || !category) return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">{error ?? "Category not found."}</p>
    </div>
  );

  return <CategoryForm category={category} />;
}
