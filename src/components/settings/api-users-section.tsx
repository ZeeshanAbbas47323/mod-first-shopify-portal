"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import {
  createApiUser,
  fetchAllWebsiteSettings,
  listApiUsers,
  listBranches,
  regenerateApiCredentials,
  updateApiUser,
  type ApiCredentials,
  type ApiUserRow,
  type BranchRow,
  type WebsiteSettingRow,
} from "@/lib/admin-api";

const PAGE_SIZE = 10;

const STATUS_ITEMS: Record<string, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Disabled",
};

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
};

export function ApiUsersSection() {
  const [rows, setRows] = React.useState<ApiUserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [stores, setStores] = React.useState<WebsiteSettingRow[]>([]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ApiUserRow | null>(null);
  const [regenTarget, setRegenTarget] = React.useState<ApiUserRow | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);
  const [credentials, setCredentials] = React.useState<{
    name: string;
    creds: ApiCredentials;
  } | null>(null);

  React.useEffect(() => {
    listBranches({ page: 1, limit: 100 })
      .then((res) => setBranches(res.rows))
      .catch(() => setBranches([]));
    fetchAllWebsiteSettings()
      .then(setStores)
      .catch(() => setStores([]));
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(0);
  }, [debounced, status]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listApiUsers({
      page: page + 1,
      limit: PAGE_SIZE,
      filters: {
        name: debounced || undefined,
        is_active: status === "all" ? undefined : status === "active",
      },
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((error) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(error, "Couldn't load API users."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, debounced, status, refreshKey]);

  const branchName = React.useCallback(
    (row: ApiUserRow) =>
      row.branch?.name ??
      branches.find((b) => String(b.id) === String(row.branch_id))?.name ??
      "—",
    [branches]
  );

  const storeName = React.useCallback(
    (row: ApiUserRow) =>
      row.websiteSetting?.site_name ??
      stores.find((s) => String(s.id) === String(row.website_setting_id))?.site_name ??
      "—",
    [stores]
  );

  const handleRegenerate = async () => {
    if (!regenTarget) return;
    setRegenerating(true);
    try {
      const { message, credentials: creds } = await regenerateApiCredentials(
        regenTarget.id
      );
      toast.success(message);
      if (creds) setCredentials({ name: regenTarget.name, creds });
      setRegenTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't regenerate the credentials."));
    } finally {
      setRegenerating(false);
    }
  };

  const columns = React.useMemo<ColumnDef<ApiUserRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Credential",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.api_key ?? "—"}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "website_setting_id",
        header: "Store",
        cell: ({ row }) => storeName(row.original),
      },
      {
        accessorKey: "branch_id",
        header: "Branch",
        cell: ({ row }) => branchName(row.original),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.is_active === false ? "Disabled" : "Active"}
            tone={row.original.is_active === false ? "neutral" : "success"}
          />
        ),
      },
      {
        accessorKey: "last_used_at",
        header: "Last used",
        cell: ({ row }) => fmtDate(row.original.last_used_at),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => fmtDate(row.original.created_at),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="text-right" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Credential actions"
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(row.original);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setRegenTarget(row.original)}
                >
                  <RefreshCw className="size-4" /> Regenerate credentials
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [branchName, storeName]
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        API keys your storefront and integrations use to talk to this store. The
        password is shown once when it&apos;s generated.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="bg-card pl-8"
          />
        </div>
        <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="min-w-32 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_ITEMS).map(([v, label]) => (
              <SelectItem key={v} value={v}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="ml-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add API user
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        onRowClick={(row) => {
          setEditing(row);
          setDialogOpen(true);
        }}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />

      <ApiUserDialog
        editing={editing}
        branches={branches}
        stores={stores}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
        onCredentials={(name, creds) => setCredentials({ name, creds })}
      />

      <ConfirmDeleteDialog
        open={!!regenTarget}
        onOpenChange={(next) => !next && setRegenTarget(null)}
        loading={regenerating}
        onConfirm={handleRegenerate}
        title={`Regenerate credentials for "${regenTarget?.name ?? ""}"?`}
        confirmLabel="Regenerate"
        description="The current key and password stop working immediately. Anything using them will break until you update it."
      />

      <CredentialsDialog
        data={credentials}
        onClose={() => setCredentials(null)}
      />
    </div>
  );
}

// ─── Create / edit ────────────────────────────────────────────────────────────

function ApiUserDialog({
  editing,
  branches,
  stores,
  open,
  onOpenChange,
  onSaved,
  onCredentials,
}: {
  editing: ApiUserRow | null;
  branches: BranchRow[];
  stores: WebsiteSettingRow[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  onCredentials: (name: string, creds: ApiCredentials) => void;
}) {
  const [name, setName] = React.useState("");
  const [storeId, setStoreId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setStoreId(
      editing?.website_setting_id != null
        ? String(editing.website_setting_id)
        : stores[0]
          ? String(stores[0].id)
          : ""
    );
    setBranchId(editing?.branch_id != null ? String(editing.branch_id) : "");
    setActive(editing?.is_active !== false);
  }, [open, editing, stores]);

  const problem = !name.trim()
    ? "Enter a name."
    : !storeId
      ? "Select a store."
      : !branchId
        ? "Select a branch."
        : null;

  const submit = async () => {
    if (problem) return;
    setSaving(true);
    try {
      if (editing) {
        toast.success(
          await updateApiUser(editing.id, {
            name: name.trim(),
            website_setting_id: Number(storeId),
            branch_id: Number(branchId),
            is_active: active,
          })
        );
      } else {
        const { message, credentials } = await createApiUser({
          name: name.trim(),
          website_setting_id: Number(storeId),
          branch_id: Number(branchId),
          is_active: active,
        });
        toast.success(message);
        if (credentials) onCredentials(name.trim(), credentials);
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, `Couldn't ${editing ? "update" : "create"} the API user.`)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit API user" : "Add API user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Update "${editing.name}".`
              : "A key and password are generated and shown once after saving."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api-name">Name</Label>
            <Input
              id="api-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Store A Web Frontend"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Store</Label>
            <Select
              items={Object.fromEntries(
                stores.map((s) => [String(s.id), s.site_name ?? `Store #${s.id}`])
              )}
              value={storeId}
              onValueChange={(v) => setStoreId(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={String(s.id)} value={String(s.id)}>
                    {s.site_name ?? `Store #${s.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select
              items={Object.fromEntries(branches.map((b) => [String(b.id), b.name]))}
              value={branchId}
              onValueChange={(v) => setBranchId(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                    {b.city ? ` · ${b.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The branch must belong to the store selected above.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
            <span className="text-xs text-muted-foreground">
              — turning this off disables the credential immediately
            </span>
          </label>

          {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !!problem}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Create API user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── One-time credentials ─────────────────────────────────────────────────────

function CopyRow({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the text and copy manually.");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input readOnly value={value ?? ""} className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={copy} disabled={!value}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function CredentialsDialog({
  data,
  onClose,
}: {
  data: { name: string; creds: ApiCredentials } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!data} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            API credentials
          </DialogTitle>
          <DialogDescription>{data?.name}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Copy the password now — it is stored hashed and can never be shown again.
            Losing it means regenerating the credentials.
          </p>
        </div>

        <div className="space-y-3">
          <CopyRow label="API key" value={data?.creds.api_key} />
          <CopyRow label="API password" value={data?.creds.api_password} />
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            I&apos;ve saved these
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
