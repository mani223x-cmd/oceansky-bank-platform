"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/store/ui.store";
import { formatMoneyDisplay } from "@/lib/format";
import type { CurrencyCode } from "@/lib/store/currency.store";

interface BalanceDisplayProps {
  amount: number;
  sourceCurrency?: CurrencyCode;
  className?: string;
  /** Show the eye toggle button. Default true. */
  toggleable?: boolean;
  /** Text to show when balance is hidden. */
  hiddenText?: string;
  /** Font size variant. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Apply muted color treatment for "available" sub-labels. */
  muted?: boolean;
}

const sizeClass = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  xl: "text-3xl sm:text-4xl",
};

export function BalanceDisplay({
  amount,
  sourceCurrency = "USD",
  className,
  toggleable = true,
  hiddenText = "••••••",
  size = "md",
  muted = false,
}: BalanceDisplayProps) {
  const visible = useUIStore((s) => s.balanceVisible);
  const toggle = useUIStore((s) => s.toggleBalanceVisible);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          sizeClass[size],
          "font-semibold tabular-nums",
          muted && "text-muted-foreground"
        )}
      >
        {visible ? formatMoneyDisplay(amount, sourceCurrency) : hiddenText}
      </span>
      {toggleable && (
        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? "Hide balance" : "Show balance"}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
      )}
    </div>
  );
}

/**
 * Masked value helper for any sensitive numeric display that should respect
 * the global balance visibility toggle but doesn't need the toggle button
 * (e.g. a small "Available: $1,234" caption).
 */
export function useBalanceMask(): (value: string) => string {
  const visible = useUIStore((s) => s.balanceVisible);
  return (value: string) => (visible ? value : "••••••");
}
