"use client";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card shadow-sm", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            {Icon && (
              <div className="grid place-items-center rounded-lg bg-teal/10 size-8 text-teal">
                <Icon className="size-4" />
              </div>
            )}
            <div>
              {title && <h3 className="font-semibold text-sm">{title}</h3>}
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
