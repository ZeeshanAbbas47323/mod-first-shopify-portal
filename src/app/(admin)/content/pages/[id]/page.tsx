"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ContentPageForm } from "@/components/content/content-page-form";
import { apiErrorMessage } from "@/lib/auth-api";
import { getContentPage, type ContentPageRow } from "@/lib/admin-api";

export default function EditContentPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = React.useState<ContentPageRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getContentPage(id)
      .then((p) => {
        if (!cancelled) setPage(p);
      })
      .catch((err) => {
        if (cancelled) return;
        const message = apiErrorMessage(err, "Couldn't load the page.");
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

  if (error || !page) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground">
        <p className="text-sm font-medium text-foreground">Page not found</p>
        <p className="text-xs">
          {error?.startsWith("<!") ? "This page could not be loaded." : (error ?? "Page not found.")}
        </p>
      </div>
    );
  }

  return <ContentPageForm page={page} />;
}
