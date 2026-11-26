"use client";

import { X, ArrowRight } from "lucide-react";
import { useRouterStore } from "@/lib/router";
import { useUIStore } from "@/lib/store/ui.store";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/types";

const ACCENT_CLASSES: Record<string, string> = {
  teal: "from-teal to-ocean",
  ocean: "from-ocean to-teal-dark",
  graphite: "from-slate-700 to-slate-900",
  sand: "from-amber-500 to-amber-700",
};

interface CampaignBannerProps {
  campaign: Campaign;
  variant?: "full" | "compact" | "inline";
  className?: string;
}

/**
 * Reusable promotional banner. Renders an OceanSky campaign as a gradient
 * card. The `compact` and `inline` variants are dismissible — dismissal
 * is persisted via the UI store so a customer won't see the same ad twice.
 */
export function CampaignBanner({ campaign, variant = "full", className }: CampaignBannerProps) {
  const go = useRouterStore((s) => s.go);
  const dismiss = useUIStore((s) => s.dismissCampaign);
  const isDismissed = useUIStore((s) => s.isCampaignDismissed(campaign.id));

  if (isDismissed) return null;
  if (campaign.status !== "active") return null;

  const accent = ACCENT_CLASSES[campaign.accentColor] || ACCENT_CLASSES.teal;

  const handleClick = () => {
    const url = campaign.ctaUrl.replace(/^#/, "");
    go(url);
  };

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-xl bg-gradient-to-r p-3 text-white",
          accent,
          className
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{campaign.title}</p>
          <p className="text-xs text-white/80 truncate">{campaign.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {campaign.ctaLabel}
        </button>
        <button
          type="button"
          onClick={() => dismiss(campaign.id)}
          aria-label="Dismiss"
          className="text-white/70 hover:text-white"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "relative rounded-xl bg-gradient-to-br p-4 text-white overflow-hidden",
          accent,
          className
        )}
      >
        <button
          type="button"
          onClick={() => dismiss(campaign.id)}
          aria-label="Dismiss"
          className="absolute top-2 right-2 text-white/70 hover:text-white"
        >
          <X className="size-4" />
        </button>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-white/70">{campaign.subtitle}</p>
          <h4 className="font-bold text-base">{campaign.title}</h4>
          <p className="text-xs text-white/85 line-clamp-2">{campaign.description}</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors"
        >
          {campaign.ctaLabel} <ArrowRight className="size-3" />
        </button>
      </div>
    );
  }

  // full variant
  return (
    <div
      className={cn(
        "relative rounded-2xl bg-gradient-to-br p-6 text-white overflow-hidden shadow-lg",
        accent,
        className
      )}
    >
      <button
        type="button"
        onClick={() => dismiss(campaign.id)}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-white/70 hover:text-white"
      >
        <X className="size-4" />
      </button>
      <div className="absolute -right-12 -bottom-12 size-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="relative space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/70">{campaign.subtitle}</p>
          <h3 className="text-xl sm:text-2xl font-bold mt-1">{campaign.title}</h3>
        </div>
        <p className="text-sm text-white/90 max-w-md">{campaign.description}</p>
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-white/90 transition-colors"
        >
          {campaign.ctaLabel} <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
