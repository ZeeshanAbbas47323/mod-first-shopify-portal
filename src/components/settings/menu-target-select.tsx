"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  listContentPages,
  listProductCategories,
  listProducts,
} from "@/lib/admin-api";
import { cn } from "@/lib/utils";

type TargetKind = "category" | "product" | "page";

interface Option {
  value: string;
  label: string;
  hint?: string;
}

const LABELS: Record<TargetKind, { placeholder: string; search: string; empty: string }> = {
  category: {
    placeholder: "Select a category",
    search: "Search categories…",
    empty: "No categories found.",
  },
  product: {
    placeholder: "Select a product",
    search: "Search products…",
    empty: "No products found.",
  },
  page: {
    placeholder: "Select a page",
    search: "Search pages…",
    empty: "No pages found.",
  },
};

async function loadOptions(kind: TargetKind, search: string): Promise<Option[]> {
  const params = { page: 1, limit: 50, ...(search ? { search } : {}) };

  if (kind === "category") {
    const { rows } = await listProductCategories(params);
    return rows.map((row) => ({
      value: String(row.id),
      label: row.name ?? `#${row.id}`,
      hint: row.slug,
    }));
  }

  if (kind === "product") {
    const { rows } = await listProducts(params);
    return rows.map((row) => ({
      value: String(row.id),
      label: row.title ?? `#${row.id}`,
      hint: row.slug as string | undefined,
    }));
  }

  const { rows } = await listContentPages(params);
  return rows.map((row) => ({
    value: String(row.id),
    label: (row.title as string) ?? `#${row.id}`,
    hint: row.slug as string | undefined,
  }));
}

/**
 * Picks the record a menu points at. Searches server-side rather than loading
 * everything, because the product list in particular is far too long to hold
 * in a dropdown.
 */
export function MenuTargetSelect({
  kind,
  value,
  onChange,
}: {
  kind: TargetKind;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<Option[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Keeps the label readable when the selected record is not in the current
  // page of results (e.g. an old menu pointing at product #12).
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      loadOptions(kind, search.trim())
        .then((rows) => !cancelled && setOptions(rows))
        .catch(() => !cancelled && setOptions([]))
        .finally(() => !cancelled && setLoading(false));
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, search]);

  React.useEffect(() => {
    const match = options.find((o) => o.value === value);
    if (match) setSelectedLabel(match.label);
  }, [options, value]);

  const label = value
    ? selectedLabel ?? `#${value}`
    : LABELS[kind].placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        )}
      >
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>
          {label}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={LABELS[kind].search}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : (
              <>
                <CommandEmpty>{LABELS[kind].empty}</CommandEmpty>
                <CommandGroup>
                  {value && (
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        onChange("");
                        setSelectedLabel(null);
                        setOpen(false);
                      }}
                      className="text-muted-foreground"
                    >
                      Clear selection
                    </CommandItem>
                  )}
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => {
                        onChange(option.value);
                        setSelectedLabel(option.label);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4 shrink-0",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.hint && (
                        <span className="ml-2 shrink-0 truncate font-mono text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
