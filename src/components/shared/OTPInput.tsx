"use client";
import { OTPInput as OTPInputPrimitive, OTPInputContext } from "input-otp";
import { Dot } from "lucide-react";
import { useContext } from "react";
import { cn } from "@/lib/utils";

// Re-export the OTPInput with shadcn-style slot rendering. Mirrors shadcn/ui
// input-otp composition. Kept inside shared/ for cross-portal reuse.
export function OTPInput({ className, containerClassName, ...props }: React.ComponentProps<typeof OTPInputPrimitive> & { containerClassName?: string }) {
  return (
    <OTPInputPrimitive
      data-slot="input-otp"
      containerClassName={cn("flex items-center gap-2 has-disabled:opacity-50", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

export function OTPSlot({ index, className }: { index: number; className?: string }) {
  const { slots } = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = slots[index] || { char: "", hasFakeCaret: false, isActive: false };
  return (
    <div
      className={cn(
        "relative flex size-12 sm:size-14 items-center justify-center rounded-xl border-2 border-input bg-background text-lg font-semibold shadow-sm transition-all",
        isActive && "border-teal ring-2 ring-teal/30",
        char && "border-teal/60 bg-teal/5",
        className
      )}
    >
      {char}
      {hasFakeCaret && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="h-4 w-px bg-teal animate-pulse" />
        </div>
      )}
    </div>
  );
}

export { Dot };
