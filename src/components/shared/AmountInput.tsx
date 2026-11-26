"use client";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

export function AmountInput({
  value,
  onChange,
  currency = "USD",
  min = 0,
  max,
  step = 10,
  quickAmounts,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  currency?: string;
  min?: number;
  max?: number;
  step?: number;
  quickAmounts?: number[];
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const clamp = (n: number) => {
    const safe = Number.isFinite(n) ? n : 0;
    if (safe < min) return min;
    if (max && safe > max) return max;
    return safe;
  };
  const display = focused ? String(value || "") : value ? new Intl.NumberFormat("en-NG").format(value) : "";
  return (
    <div className="space-y-3">
      <div className={cn("relative rounded-xl border-2 bg-background transition-all", focused ? "border-teal ring-2 ring-teal/20" : "border-input", className)}>
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">{currency}</div>
        <Input
          type="text"
          inputMode="decimal"
          value={display}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.]/g, "");
            const num = parseFloat(raw);
            onChange(clamp(num || 0));
          }}
          className="pl-14 pr-24 py-6 text-xl font-bold border-0 focus-visible:ring-0 focus-visible:ring-offset-0 tabular-nums"
          placeholder="0.00"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onChange(clamp(Math.max(min, value - step)))}
          >
            <Minus className="size-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onChange(clamp(value + step))}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>
      {quickAmounts && quickAmounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((amt) => (
            <Button
              key={amt}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => onChange(clamp(amt))}
            >
              {formatMoney(amt, currency, { maximumFractionDigits: 0 })}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
