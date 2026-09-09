"use client";

import * as React from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SummaryTile {
  label: string;
  value: string;
  changePercent?: number | null;
  /** Optional per-tile sparkline, e.g. daily counts for the active date range. */
  sparkline?: number[];
}

/**
 * The Shopify-style stat strip above a list — a row of KPI tiles, each with
 * its current value, the vs-previous-period delta, and an optional
 * sparkline. Shared by any list page that gets a summary endpoint (orders
 * today; drafts/shipping-labels/abandoned-checkouts can reuse this as those
 * get their own summary data).
 */
export function SummaryStatStrip({
  tiles,
  loading,
}: {
  tiles: SummaryTile[];
  loading?: boolean;
}) {
  return (
    <Card className="py-0 shadow-none">
      <CardContent className="grid grid-cols-2 p-0 lg:grid-cols-4 lg:divide-x divide-y lg:divide-y-0">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-muted-foreground">{tile.label}</span>
            {loading ? (
              <>
                <div className="mt-1 h-6 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
              </>
            ) : (
              <>
                <div className="flex items-end justify-between gap-2">
                  <span className="text-lg font-semibold tracking-tight">{tile.value}</span>
                  {tile.sparkline && tile.sparkline.length > 1 && (
                    <div className="h-8 w-16">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tile.sparkline.map((v, i) => ({ i, v }))}>
                          <defs>
                            <linearGradient id={`spark-${tile.label}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#005bd3" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#005bd3" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="v"
                            stroke="#005bd3"
                            strokeWidth={1.5}
                            fill={`url(#spark-${tile.label})`}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                {tile.changePercent != null && (
                  <span
                    className={cn(
                      "flex items-center text-xs font-medium",
                      tile.changePercent >= 0 ? "text-[#29845a]" : "text-[#e51c00]"
                    )}
                  >
                    {tile.changePercent >= 0 ? (
                      <ArrowUpRight className="size-3.5" />
                    ) : (
                      <ArrowDownRight className="size-3.5" />
                    )}
                    {tile.changePercent > 0 ? "+" : ""}
                    {tile.changePercent.toFixed(1)}%
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
