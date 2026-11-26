"use client";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
      {Icon && (
        <div className="grid place-items-center rounded-full bg-muted size-12">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground max-w-xs">{description}</p>}
      </div>
      {action}
    </div>
  );
}
