"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DraftOrderForm } from "@/components/orders/draft-order-form";
import { apiErrorMessage } from "@/lib/auth-api";
import { getDraftOrder, type DraftOrderRow } from "@/lib/admin-api";

export default function DraftOrderPage() {
  const { id } = useParams<{ id: string }>();
  const [draft, setDraft] = React.useState<DraftOrderRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getDraftOrder(id)
      .then((d) => {
        if (!cancelled) setDraft(d);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = apiErrorMessage(err, "Couldn't load the draft order.");
        setError(message);
        toast.error(message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
        <p className="text-sm font-medium text-foreground">Draft order not found</p>
        <p className="text-xs">{error ?? "This draft could not be loaded."}</p>
      </div>
    );
  }

  return <DraftOrderForm draft={draft} />;
}
