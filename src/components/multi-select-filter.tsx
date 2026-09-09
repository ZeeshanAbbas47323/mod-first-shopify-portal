"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[] | readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

const humanize = (s: string) =>
  s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function toOptions(options: MultiSelectFilterProps["options"]): MultiSelectOption[] {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: humanize(o) } : o
  );
}

export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  className,
}: MultiSelectFilterProps) {
  const opts = React.useMemo(() => toOptions(options), [options]);

  const toggle = (v: string) => {
    onChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v]
    );
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm hover:bg-muted/50",
              value.length > 0 && "border-foreground/30 bg-muted/40",
              className
            )}
          >
            <span>{label}</span>
            {value.length > 0 && (
              <span className="rounded bg-foreground/10 px-1.5 text-xs font-medium">
                {value.length}
              </span>
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-56 p-0">
        <div className="max-h-72 overflow-y-auto p-1.5">
          {opts.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={value.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              <span className="capitalize">{opt.label}</span>
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <>
            <Separator />
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
            >
              Clear {label.toLowerCase()}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
