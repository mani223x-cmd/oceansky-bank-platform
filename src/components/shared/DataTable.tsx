"use client";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Records will appear here when available.",
  emptyIcon,
  onRowClick,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted/60 animate-pulse" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;
  }
  return (
    <div className={cn("overflow-x-auto scrollbar-thin", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            {columns.map((c) => (
              <th key={c.key} className={cn("py-3 px-3 font-medium", c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "border-b transition-colors hover:bg-muted/40",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("py-3 px-3 align-middle", c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MoneyCell({ amount, currency = "USD", className }: { amount: number; currency?: string; className?: string }) {
  const positive = amount >= 0;
  return (
    <span className={cn("font-medium tabular-nums", positive ? "text-emerald-600" : "text-foreground", className)}>
      {positive ? "+" : ""}{formatMoney(Math.abs(amount), currency)}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-700",
    active: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    reviewing: "bg-amber-100 text-amber-700",
    failed: "bg-destructive/10 text-destructive",
    reversed: "bg-destructive/10 text-destructive",
    locked: "bg-amber-100 text-amber-700",
    frozen: "bg-amber-100 text-amber-700",
    blocked: "bg-destructive/10 text-destructive",
    open: "bg-blue-100 text-blue-700",
    escalated: "bg-destructive/10 text-destructive",
    resolved: "bg-emerald-100 text-emerald-700",
    closed: "bg-muted text-muted-foreground",
    draft: "bg-muted text-muted-foreground",
    scheduled: "bg-blue-100 text-blue-700",
    paused: "bg-amber-100 text-amber-700",
    ended: "bg-muted text-muted-foreground",
    high: "bg-destructive/10 text-destructive",
    critical: "bg-destructive/10 text-destructive",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", map[status.toLowerCase()] || "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}
