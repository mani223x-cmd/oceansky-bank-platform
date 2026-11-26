"use client";

// ============================================================================
// OceanSky Bank — Offers & Campaigns
// ----------------------------------------------------------------------------
// Renders active/scheduled campaigns as banner cards (featured first, then a
// responsive grid), plus a dedicated "Refer a friend" card with the user's
// referral code and mock invite stats.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Megaphone,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import { toast } from "@/hooks/use-toast";
import type { Campaign } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { CampaignBanner } from "@/components/shared/CampaignBanner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ----------------------------------------------------------------------------
// Campaigns
// ----------------------------------------------------------------------------
export function Campaigns() {
  const user = useAuthStore((s) => s.user);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await services.campaign.listForUser(user.tier);
        if (cancelled) return;
        if (res.ok && res.data) setCampaigns(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Featured = first active campaign; rest go to grid.
  const { featured, rest } = useMemo(() => {
    if (campaigns.length === 0) return { featured: null, rest: [] };
    const active = campaigns.find((c) => c.status === "active");
    const featured = active ?? campaigns[0];
    const rest = campaigns.filter((c) => c.id !== featured.id);
    return { featured, rest };
  }, [campaigns]);

  // Referral code
  const referralCode = useMemo(() => {
    if (!user) return "OSK-XXXX";
    const first = (user.firstName || "X").slice(0, 4).toUpperCase().replace(/\s/g, "");
    const last4 = (user.id || "0000").slice(-4).toUpperCase();
    return `OSK-${first}${last4}`;
  }, [user]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast({ title: "Referral code copied", description: referralCode });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Copy failed", description: "Please copy the code manually." });
    }
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Offers & Campaigns"
          description="Promotions, rewards and exclusive benefits."
        />
        <EmptyState
          icon={Megaphone}
          title="Sign in to view offers"
          description="Log in to see promotions and campaigns tailored to your tier."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers & Campaigns"
        description="Promotions, rewards and exclusive benefits."
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No active campaigns"
          description="Check back soon — new offers and rewards are added regularly."
        />
      ) : (
        <div className="space-y-5">
          {/* Featured banner */}
          {featured && (
            <CampaignBanner campaign={featured} variant="full" />
          )}

          {/* Grid of remaining campaigns */}
          {rest.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {rest.map((c) => (
                <CampaignBanner key={c.id} campaign={c} variant="compact" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refer a friend */}
      <SectionCard
        title="Refer a friend"
        description="Share your code and earn rewards when they join."
        icon={UserPlus}
      >
        <div className="grid gap-5 md:grid-cols-2">
          {/* Code + copy */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-dashed border-teal/40 bg-teal/[0.04] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your referral code
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold tracking-tight text-teal">
                  {referralCode}
                </span>
                <Button
                  size="sm"
                  variant={copied ? "default" : "outline"}
                  onClick={handleCopyCode}
                >
                  <Copy className="size-3.5" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Earn $25 for every friend who joins and completes their first
                transaction.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-teal" />
              <span>Share via your favourite messenger or email.</span>
            </div>
          </div>

          {/* Referral stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Invited"
              value={5}
              icon={Users}
              accent="teal"
            />
            <StatCard
              label="Joined"
              value={2}
              icon={UserPlus}
              accent="ocean"
            />
            <StatCard
              label="Earned"
              value="$50"
              icon={TrendingUp}
              accent="turquoise"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
