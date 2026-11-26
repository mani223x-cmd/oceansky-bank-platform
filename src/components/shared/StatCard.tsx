"use client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  trend?: { value: string; direction: "up" | "down"; positive?: boolean };
  className?: string;
  accent?: "teal" | "ocean" | "turquoise" | "muted";
  footer?: ReactNode;
}

export function StatCard({ label, value, icon: Icon, trend, className, accent = "teal", footer }: StatCardProps) {
  const accentMap = {
    teal: "from-teal/15 to-teal/5 text-teal",
    ocean: "from-ocean/15 to-ocean/5 text-ocean",
    turquoise: "from-turquoise/20 to-turquoise/5 text-[oklch(0.45_0.13_180)]",
    muted: "from-muted to-muted/40 text-muted-foreground",
  };
  return (
    <Card className={cn("relative overflow-hidden border-border/60 shadow-sm", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <p className={cn("text-xs font-medium", trend.positive === false ? "text-destructive" : "text-emerald-600")}>
                {trend.direction === "up" ? "↑" : "↓"} {trend.value}
              </p>
            )}
            {footer && <div className="pt-1 text-xs text-muted-foreground">{footer}</div>}
          </div>
          {Icon && (
            <div className={cn("grid place-items-center rounded-xl bg-gradient-to-br size-11", accentMap[accent])}>
              <Icon className="size-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
