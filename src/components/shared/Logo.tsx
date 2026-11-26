"use client";
import { Waves } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "default" | "light";
  className?: string;
}

export function Logo({ size = "md", showText = true, variant = "default", className }: LogoProps) {
  const sizeMap = {
    sm: { icon: 22, text: "text-base" },
    md: { icon: 30, text: "text-xl" },
    lg: { icon: 40, text: "text-2xl" },
  };
  const s = sizeMap[size];
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <div
        className={cn(
          "grid place-items-center rounded-xl shadow-sm",
          variant === "light"
            ? "bg-white/10 ring-1 ring-white/20"
            : "bg-gradient-to-br from-teal to-ocean"
        )}
        style={{ width: s.icon + 12, height: s.icon + 12 }}
      >
        <Waves className={variant === "light" ? "text-white" : "text-white"} size={s.icon} strokeWidth={2.2} />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn("font-bold tracking-tight", s.text, variant === "light" ? "text-white" : "text-foreground")}>
            OceanSky
          </span>
          <span className={cn("text-[10px] uppercase tracking-[0.18em] font-medium", variant === "light" ? "text-white/70" : "text-muted-foreground")}>
            Bank
          </span>
        </div>
      )}
    </div>
  );
}
