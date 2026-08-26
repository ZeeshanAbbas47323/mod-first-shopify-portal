"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Loader2, MapPin, Plus, Trash2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/auth-api";
import { listBranches, type BranchRow } from "@/lib/admin-api";
import {
  createTerminalLocation,
  deleteReader,
  listReaders,
  listTerminalLocations,
  registerReader,
  type TerminalLocationRow,
  type TerminalReaderRow,
} from "@/lib/pos-api";

const PAGE_SIZE = 15;

export default function TerminalsPage() {
  const [tab, setTab] = React.useState<"readers" | "locations">("readers");
  const [branches, setBranches] = React.useState<BranchRow[]>([]);

  React.useEffect(() => {
    listBranches({ page: 1, limit: 100 })
      .then((res) => setBranches(res.rows))
      .catch(() => setBranches([]));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Card terminals</h1>
          <p className="text-sm text-muted-foreground">
            Stripe Terminal readers and the locations they belong to.
          </p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "readers" | "locations")}>
          <TabsList>
            <TabsTrigger value="readers">Readers</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "readers" ? (
        <ReadersTab branches={branches} />
      ) : (
        <LocationsTab branches={branches} />
      )}
    </div>
  );
}

// ─── Readers ──────────────────────────────────────────────────────────────────

function ReadersTab({ branches }: { branches: BranchRow[] }) {
  const [rows, setRows] = React.useState<TerminalReaderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<TerminalReaderRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    setPage(0);
  }, [status]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listReaders({
      page: page + 1,
      limit: PAGE_SIZE,
      filters: { status: status === "all" ? undefined : status },
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
        toast.error(apiErrorMessage(error, "Couldn't load readers."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, status, refreshKey]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      toast.success(await deleteReader(deleteTarget.id));
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't remove the reader."));
    } finally {
      setDeleting(false);
    }
  };

  const columns = React.useMemo<ColumnDef<TerminalReaderRow>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Reader",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.label}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.stripe_reader_id ?? row.original.serial_number ?? `#${row.original.id}`}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Connection",
        cell: ({ row }) => {
          const online = String(row.original.status ?? "").toLowerCase() === "online";
          return (
            <span className="flex items-center gap-1.5">
              {online ? (
                <Wifi className="size-3.5 text-[#29845a]" />
              ) : (
                <WifiOff className="size-3.5 text-muted-foreground" />
              )}
              <StatusBadge
                status={online ? "Online" : "Offline"}
                tone={online ? "success" : "neutral"}
              />
            </span>
          );
        },
      },
      {
        accessorKey: "device_type",
        header: "Model",
        cell: ({ row }) => row.original.device_type ?? "—",
      },
      {
        accessorKey: "branch_id",
        header: "Branch",
        cell: ({ row }) =>
          row.original.branch?.name ??
          branches.find((b) => String(b.id) === String(row.original.branch_id))?.name ??
          "—",
      },
      {
        accessorKey: "last_seen_at",
        header: "Last seen",
        cell: ({ row }) => {
          const d = row.original.last_seen_at ?? row.original.created_at;
          if (!d) return "—";
          const date = new Date(d);
          return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy · h:mm a");
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row.original);
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [branches]
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={{ all: "All readers", online: "Online", offline: "Offline" }}
          value={status}
          onValueChange={(v) => setStatus(v as string)}
        >
          <SelectTrigger className="min-w-36 bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All readers</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Register reader
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />

      <RegisterReaderDialog
        branches={branches}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        loading={deleting}
        onConfirm={handleDelete}
        title={`Remove "${deleteTarget?.label ?? ""}"?`}
        confirmLabel="Remove reader"
        description="The reader will be unregistered from Stripe and can be paired again later."
      />
    </>
  );
}

function RegisterReaderDialog({
  branches,
  open,
  onOpenChange,
  onSaved,
}: {
  branches: BranchRow[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCode("");
      setLabel("");
      setBranchId(branches[0] ? String(branches[0].id) : "");
    }
  }, [open, branches]);

  const submit = async () => {
    if (!code.trim() || label.trim().length < 2 || !branchId) return;
    setSaving(true);
    try {
      toast.success(
        await registerReader({
          registration_code: code.trim(),
          label: label.trim(),
          branch_id: branchId,
        })
      );
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't register the reader."));
    } finally {
      setSaving(false);
    }
  };

  const branchItems = Object.fromEntries(branches.map((b) => [String(b.id), b.name]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register reader</DialogTitle>
          <DialogDescription>
            Enter the pairing code shown on the reader&apos;s screen. In Stripe test mode
            use <span className="font-mono">simulated-wpe</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reg-code">Registration code</Label>
            <Input
              id="reg-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="simulated-wpe"
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reader-label">Label</Label>
            <Input
              id="reader-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Counter 1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select
              items={branchItems}
              value={branchId}
              onValueChange={(v) => setBranchId(v as string)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The Stripe location is derived from the branch address.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !code.trim() || label.trim().length < 2 || !branchId}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Locations ────────────────────────────────────────────────────────────────

function LocationsTab({ branches }: { branches: BranchRow[] }) {
  const [rows, setRows] = React.useState<TerminalLocationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTerminalLocations({ page: page + 1, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
        setPageCount(res.totalPages);
      })
      .catch((error) => {
        if (cancelled) return;
        setRows([]);
        toast.error(apiErrorMessage(error, "Couldn't load locations."));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);

  const columns = React.useMemo<ColumnDef<TerminalLocationRow>[]>(
    () => [
      {
        accessorKey: "display_name",
        header: "Location",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.display_name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.stripe_location_id ?? `#${row.original.id}`}
            </p>
          </div>
        ),
      },
      {
        id: "address",
        header: "Address",
        cell: ({ row }) => {
          const l = row.original;
          return (
            <span className="block max-w-72 truncate text-sm">
              {[l.address_line1, l.address_line2, l.city, l.state, l.postal_code, l.country]
                .filter(Boolean)
                .join(", ")}
            </span>
          );
        },
      },
      {
        accessorKey: "branch_id",
        header: "Branch",
        cell: ({ row }) =>
          branches.find((b) => String(b.id) === String(row.original.branch_id))?.name ?? "—",
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.is_active === false ? "Inactive" : "Active"}
            tone={row.original.is_active === false ? "neutral" : "success"}
          />
        ),
      },
    ],
    [branches]
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <Button className="ml-auto" onClick={() => setDialogOpen(true)}>
          <MapPin className="size-4" />
          Add location
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        serverPagination={{ pageIndex: page, pageCount, total, onPageChange: setPage }}
      />

      <LocationDialog
        branches={branches}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}

function LocationDialog({
  branches,
  open,
  onOpenChange,
  onSaved,
}: {
  branches: BranchRow[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const empty = {
    display_name: "",
    branch_id: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
  };
  const [form, setForm] = React.useState(empty);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setForm({ ...empty, branch_id: branches[0] ? String(branches[0].id) : "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branches]);

  const set = (key: keyof typeof empty, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const invalid =
    !form.display_name.trim() ||
    !form.address_line1.trim() ||
    !form.city.trim() ||
    !form.postal_code.trim();

  const submit = async () => {
    if (invalid) return;
    setSaving(true);
    try {
      toast.success(
        await createTerminalLocation({
          display_name: form.display_name.trim(),
          branch_id: form.branch_id || undefined,
          address_line1: form.address_line1.trim(),
          address_line2: form.address_line2.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim() || undefined,
          postal_code: form.postal_code.trim(),
          country: form.country.trim() || "US",
        })
      );
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't create the location."));
    } finally {
      setSaving(false);
    }
  };

  const branchItems = Object.fromEntries(branches.map((b) => [String(b.id), b.name]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add terminal location</DialogTitle>
          <DialogDescription>
            Stripe requires a physical address for every group of readers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="loc-name">Display name</Label>
              <Input
                id="loc-name"
                value={form.display_name}
                onChange={(e) => set("display_name", e.target.value)}
                placeholder="Hyattsville Store"
                maxLength={150}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select
                items={branchItems}
                value={form.branch_id}
                onValueChange={(v) => set("branch_id", v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loc-addr1">Address line 1</Label>
            <Input
              id="loc-addr1"
              value={form.address_line1}
              onChange={(e) => set("address_line1", e.target.value)}
              placeholder="1234 Baltimore Ave"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loc-addr2">Address line 2</Label>
            <Input
              id="loc-addr2"
              value={form.address_line2}
              onChange={(e) => set("address_line2", e.target.value)}
              placeholder="Suite 200"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="loc-city">City</Label>
              <Input
                id="loc-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Hyattsville"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-state">State</Label>
              <Input
                id="loc-state"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                placeholder="MD"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-zip">Postal code</Label>
              <Input
                id="loc-zip"
                value={form.postal_code}
                onChange={(e) => set("postal_code", e.target.value)}
                placeholder="20782"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loc-country">Country</Label>
            <Input
              id="loc-country"
              value={form.country}
              onChange={(e) => set("country", e.target.value.toUpperCase())}
              placeholder="US"
              maxLength={2}
              className="w-24 font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || invalid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Add location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
