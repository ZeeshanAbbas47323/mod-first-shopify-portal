"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog as InlineDialog,
  DialogContent as InlineDialogContent,
  DialogHeader as InlineDialogHeader,
  DialogTitle as InlineDialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createColorAndReturn,
  createSizeAndReturn,
  type ColorRow,
  type SizeRow,
} from "@/lib/admin-api";

export function ColorCombobox({
  value,
  onChange,
  colors,
  onCreated,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  colors: ColorRow[];
  onCreated: (c: ColorRow) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newHex, setNewHex] = React.useState("#000000");
  const [saving, setSaving] = React.useState(false);

  const filtered = colors.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const selected = colors.find((c) => String(c.id) === value);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await createColorAndReturn({ name: newName.trim(), hex_code: newHex });
      onCreated(created);
      onChange(String(created.id));
      setCreating(false);
      setOpen(false);
      setNewName("");
      setNewHex("#000000");
    } catch {
      toast.error("Failed to create color.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex h-8 w-full min-w-[100px] items-center justify-between rounded-md border bg-card px-2 text-sm",
            "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring",
            hasError ? "border-destructive" : "border-input"
          )}
        >
          {selected ? (
            <span className="flex items-center gap-1.5 truncate">
              <span
                className="inline-block size-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: selected.hex_code }}
              />
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Color</span>
          )}
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search colors…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={String(c.id)}
                    onSelect={() => { onChange(String(c.id)); setOpen(false); setSearch(""); }}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="inline-block size-3 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: c.hex_code }}
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    {value === String(c.id) && <Check className="size-3 text-primary" />}
                  </CommandItem>
                ))}
                {filtered.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">No colors found</p>
                )}
              </CommandGroup>
            </CommandList>
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => { setCreating(true); setOpen(false); setNewName(search); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-medium text-primary hover:bg-accent"
              >
                <Plus className="size-3" /> Add new color
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <InlineDialog open={creating} onOpenChange={setCreating}>
        <InlineDialogContent className="sm:max-w-xs">
          <InlineDialogHeader>
            <InlineDialogTitle>New color</InlineDialogTitle>
          </InlineDialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                autoFocus
                placeholder="e.g. Royal Blue"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hex color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  className="size-9 cursor-pointer rounded-md border border-border p-0.5"
                />
                <Input
                  value={newHex}
                  onChange={(e) => setNewHex(e.target.value)}
                  placeholder="#000000"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={!newName.trim() || saving} onClick={handleCreate}>
                {saving && <Loader2 className="size-3 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </InlineDialogContent>
      </InlineDialog>
    </>
  );
}

// ─── Size Combobox with inline create ────────────────────────────────────────

export function SizeCombobox({
  value,
  onChange,
  sizes,
  onCreated,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  sizes: SizeRow[];
  onCreated: (s: SizeRow) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newDisplay, setNewDisplay] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const filtered = sizes.filter((s) =>
    (s.display_name ?? s.name).toLowerCase().includes(search.toLowerCase())
  );
  const selected = sizes.find((s) => String(s.id) === value);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await createSizeAndReturn({
        name: newName.trim(),
        display_name: newDisplay.trim() || newName.trim(),
      });
      onCreated(created);
      onChange(String(created.id));
      setCreating(false);
      setOpen(false);
      setNewName("");
      setNewDisplay("");
    } catch {
      toast.error("Failed to create size.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex h-8 w-full min-w-[90px] items-center justify-between rounded-md border bg-card px-2 text-sm",
            "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring",
            hasError ? "border-destructive" : "border-input"
          )}
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? (selected.display_name ?? selected.name) : "Size"}
          </span>
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-44 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search sizes…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-48">
              <CommandGroup>
                {filtered.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={String(s.id)}
                    onSelect={() => { onChange(String(s.id)); setOpen(false); setSearch(""); }}
                    className="flex items-center gap-2"
                  >
                    <span className="flex-1 truncate">{s.display_name ?? s.name}</span>
                    {value === String(s.id) && <Check className="size-3 text-primary" />}
                  </CommandItem>
                ))}
                {filtered.length === 0 && (
                  <p className="py-2 text-center text-xs text-muted-foreground">No sizes found</p>
                )}
              </CommandGroup>
            </CommandList>
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={() => { setCreating(true); setOpen(false); setNewName(search); setNewDisplay(search); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-medium text-primary hover:bg-accent"
              >
                <Plus className="size-3" /> Add new size
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <InlineDialog open={creating} onOpenChange={setCreating}>
        <InlineDialogContent className="sm:max-w-xs">
          <InlineDialogHeader>
            <InlineDialogTitle>New size</InlineDialogTitle>
          </InlineDialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Code <span className="text-muted-foreground">(e.g. XL)</span></label>
              <Input
                autoFocus
                placeholder="XL"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display name <span className="text-muted-foreground">(e.g. Extra Large)</span></label>
              <Input
                placeholder="Extra Large"
                value={newDisplay}
                onChange={(e) => setNewDisplay(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={!newName.trim() || saving} onClick={handleCreate}>
                {saving && <Loader2 className="size-3 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </InlineDialogContent>
      </InlineDialog>
    </>
  );
}
