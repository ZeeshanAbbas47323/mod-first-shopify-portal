"use client";

import * as React from "react";
import { Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  USER_ROLES,
  getMenuRightMatrix,
  saveMenuRightMatrix,
  type MenuPermissionRow,
} from "@/lib/admin-api";
import { apiErrorMessage } from "@/lib/auth-api";
import { cn } from "@/lib/utils";

const PERMISSIONS = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Update" },
  { key: "can_delete", label: "Delete" },
] as const;

type PermissionKey = (typeof PERMISSIONS)[number]["key"];

/** super_admin bypasses rights entirely, and customers never see the admin. */
const ASSIGNABLE_ROLES = USER_ROLES.filter(
  (role) => role !== "super_admin" && role !== "customer"
);

const ROLE_ITEMS = Object.fromEntries(
  ASSIGNABLE_ROLES.map((role) => [role, humanizeRole(role)])
);

function humanizeRole(role: string) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type Grants = Record<PermissionKey, boolean>;

/** menu id -> the four flags, which is what the table edits and submits. */
type GrantMap = Record<number, Grants>;

function toGrantMap(items: MenuPermissionRow[]): GrantMap {
  const map: GrantMap = {};
  for (const item of items) {
    map[item.id] = {
      can_view: !!item.can_view,
      can_create: !!item.can_create,
      can_edit: !!item.can_edit,
      can_delete: !!item.can_delete,
    };
  }
  return map;
}

/**
 * Flattens the menu list into parent-then-children order so the table reads as
 * a tree. Children of a parent that isn't in the set are kept at the root
 * rather than dropped, so nothing becomes invisible and un-grantable.
 */
function flattenTree(items: MenuPermissionRow[]) {
  const byParent = new Map<number | null, MenuPermissionRow[]>();
  const ids = new Set(items.map((item) => item.id));

  for (const item of items) {
    const parent =
      item.parent_id != null && ids.has(item.parent_id) ? item.parent_id : null;
    const bucket = byParent.get(parent);
    if (bucket) bucket.push(item);
    else byParent.set(parent, [item]);
  }

  const out: { row: MenuPermissionRow; depth: number }[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const row of byParent.get(parent) ?? []) {
      out.push({ row, depth });
      walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function MenuRightsSection() {
  const [role, setRole] = React.useState<string>(ASSIGNABLE_ROLES[0]);
  const [rows, setRows] = React.useState<MenuPermissionRow[]>([]);
  const [grants, setGrants] = React.useState<GrantMap>({});
  const [baseline, setBaseline] = React.useState<GrantMap>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(
    async (nextRole: string) => {
      setLoading(true);
      try {
        const matrix = await getMenuRightMatrix(nextRole);
        const map = toGrantMap(matrix.items);
        setRows(matrix.items);
        setGrants(map);
        setBaseline(map);
      } catch (error) {
        setRows([]);
        setGrants({});
        setBaseline({});
        toast.error(apiErrorMessage(error, "Couldn't load permissions."));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    void load(role);
  }, [role, load]);

  const tree = React.useMemo(() => flattenTree(rows), [rows]);

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tree;
    return tree.filter(
      ({ row }) =>
        row.name.toLowerCase().includes(term) ||
        row.slug.toLowerCase().includes(term)
    );
  }, [tree, search]);

  const dirty = React.useMemo(
    () =>
      rows.some((row) =>
        PERMISSIONS.some(
          ({ key }) => !!grants[row.id]?.[key] !== !!baseline[row.id]?.[key]
        )
      ),
    [rows, grants, baseline]
  );

  const grantedCount = React.useMemo(
    () =>
      rows.filter((row) =>
        PERMISSIONS.some(({ key }) => grants[row.id]?.[key])
      ).length,
    [rows, grants]
  );

  const setGrant = (menuId: number, key: PermissionKey, value: boolean) => {
    setGrants((prev) => {
      const current = prev[menuId] ?? {
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
      const next: Grants = { ...current, [key]: value };

      // Create/Update/Delete are meaningless without View, and clearing View
      // should not leave orphaned write access behind.
      if (key === "can_view" && !value) {
        next.can_create = false;
        next.can_edit = false;
        next.can_delete = false;
      } else if (key !== "can_view" && value) {
        next.can_view = true;
      }

      return { ...prev, [menuId]: next };
    });
  };

  /** Toggles a whole menu row: all four flags on, or all off. */
  const setRowAll = (menuId: number, value: boolean) => {
    setGrants((prev) => ({
      ...prev,
      [menuId]: {
        can_view: value,
        can_create: value,
        can_edit: value,
        can_delete: value,
      },
    }));
  };

  /** Toggles one permission column across every row currently visible. */
  const setColumnAll = (key: PermissionKey, value: boolean) => {
    setGrants((prev) => {
      const next = { ...prev };
      for (const { row } of visible) {
        const current = next[row.id] ?? {
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
        };
        const updated: Grants = { ...current, [key]: value };
        if (key === "can_view" && !value) {
          updated.can_create = false;
          updated.can_edit = false;
          updated.can_delete = false;
        } else if (key !== "can_view" && value) {
          updated.can_view = true;
        }
        next[row.id] = updated;
      }
      return next;
    });
  };

  const columnState = (key: PermissionKey) => {
    if (!visible.length) return { checked: false, indeterminate: false };
    const on = visible.filter(({ row }) => grants[row.id]?.[key]).length;
    return {
      checked: on === visible.length,
      indeterminate: on > 0 && on < visible.length,
    };
  };

  const save = async () => {
    setSaving(true);
    try {
      const message = await saveMenuRightMatrix(
        role,
        rows.map((row) => ({
          menu_id: row.id,
          can_view: !!grants[row.id]?.can_view,
          can_create: !!grants[row.id]?.can_create,
          can_edit: !!grants[row.id]?.can_edit,
          can_delete: !!grants[row.id]?.can_delete,
        }))
      );
      setBaseline(grants);
      toast.success(message);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't save permissions."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="permission-role">Role</Label>
            <Select
              items={ROLE_ITEMS}
              value={role}
              onValueChange={(v) => setRole(v as string)}
            >
              <SelectTrigger id="permission-role" className="w-full md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {humanizeRole(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Permissions apply to every user with this role. Super admins always
              have full access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 md:w-56 md:flex-none">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menus…"
                aria-label="Search menus"
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load(role)}
              disabled={loading || saving}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Menu permissions</h2>
            {!loading && (
              <Badge variant="secondary">
                {grantedCount} of {rows.length} granted
              </Badge>
            )}
          </div>
          {dirty && !loading && (
            <span className="text-xs text-muted-foreground">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="bg-secondary text-xs font-semibold text-muted-foreground">
                <th className="w-10 px-4 py-2.5 text-left" />
                <th className="px-2 py-2.5 text-left font-semibold">
                  Menu name
                </th>
                <th className="px-2 py-2.5 text-left font-semibold">Type</th>
                {PERMISSIONS.map(({ key, label }) => {
                  const state = columnState(key);
                  return (
                    <th key={key} className="w-24 px-2 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span>{label}</span>
                        <Checkbox
                          checked={state.checked}
                          indeterminate={state.indeterminate}
                          disabled={loading || saving || !visible.length}
                          onCheckedChange={(v) => setColumnAll(key, !!v)}
                          aria-label={`Toggle ${label} for all visible menus`}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Skeleton className="size-4 rounded" />
                    </td>
                    <td className="px-2 py-3">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    <td className="px-2 py-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    {PERMISSIONS.map(({ key }) => (
                      <td key={key} className="px-2 py-3">
                        <Skeleton className="mx-auto size-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !visible.length ? (
                <tr>
                  <td colSpan={3 + PERMISSIONS.length} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <p className="text-sm font-medium">No menus found</p>
                      <p className="text-xs text-muted-foreground">
                        {search
                          ? "Try a different search term."
                          : "Add dashboard menus first, then assign permissions here."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map(({ row, depth }) => {
                  const rowGrants = grants[row.id];
                  const any = PERMISSIONS.some(({ key }) => rowGrants?.[key]);
                  const all = PERMISSIONS.every(({ key }) => rowGrants?.[key]);

                  return (
                    <tr
                      key={row.id}
                      className="border-b transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={all}
                          indeterminate={any && !all}
                          disabled={saving}
                          onCheckedChange={(v) => setRowAll(row.id, !!v)}
                          aria-label={`Toggle all permissions for ${row.name}`}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <div
                          className="flex min-w-0 items-center gap-1.5"
                          style={{ paddingLeft: `${depth * 1.25}rem` }}
                        >
                          {depth > 0 && (
                            <span
                              aria-hidden="true"
                              className="text-muted-foreground"
                            >
                              ↳
                            </span>
                          )}
                          <span className="truncate font-medium">
                            {row.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <Badge variant="secondary" className="font-normal">
                          {row.slug}
                        </Badge>
                      </td>
                      {PERMISSIONS.map(({ key, label }) => (
                        <td key={key} className="px-2 py-2.5 text-center">
                          <Checkbox
                            checked={!!rowGrants?.[key]}
                            disabled={saving}
                            onCheckedChange={(v) => setGrant(row.id, key, !!v)}
                            aria-label={`${label} ${row.name}`}
                            className="mx-auto"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="sticky bottom-0 flex-row flex-wrap items-center justify-end gap-2 py-3">
        <Button
          variant="outline"
          onClick={() => setGrants(baseline)}
          disabled={!dirty || saving || loading}
        >
          Discard
        </Button>
        <Button onClick={save} disabled={!dirty || saving || loading}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Saving…" : "Save permissions"}
        </Button>
      </Card>
    </div>
  );
}
