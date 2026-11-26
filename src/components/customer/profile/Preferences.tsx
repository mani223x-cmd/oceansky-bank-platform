"use client";

// ============================================================================
// OceanSky Bank — Preferences (customer)
// ----------------------------------------------------------------------------
// Notification channels + categories, display preferences and privacy
// controls. Notification preferences are persisted via the mock
// `services.user.updateNotificationPrefs` API; the rest are local mock state.
// ============================================================================

import { useEffect, useState } from "react";
import {
  Bell,
  Eye,
  Globe2,
  Mail,
  Megaphone,
  MessageSquare,
  Palette,
  Share2,
  Smartphone,
  Sun,
  Wallet,
} from "lucide-react";

import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import { useCurrencyStore, type CurrencyCode } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type { NotificationPreferences } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

// ----------------------------------------------------------------------------
// Default preferences (fallback when the service has none)
// ----------------------------------------------------------------------------
const DEFAULT_PREFS: NotificationPreferences = {
  userId: "",
  channels: { push: true, email: true, sms: false },
  categories: {
    transaction: true,
    security: true,
    promo: true,
    system: true,
    support: true,
  },
};

// ============================================================================
// Component
// ============================================================================
export function Preferences() {
  const { user } = useAuthStore();

  // Display currency is driven by the shared currency store so changes
  // here cascade to every balance / amount across the app.
  const currency = useCurrencyStore((s) => s.currency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);

  // --- Notification prefs (persisted via service)
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // --- Display (local mock)
  const [display, setDisplay] = useState({
    theme: "light",
    language: "english",
  });

  // --- Privacy (local mock)
  const [privacy, setPrivacy] = useState({
    showBalance: true,
    shareInsights: true,
    marketing: false,
  });

  // ------------------------------------------------------------------------
  // Load notification preferences on mount
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingPrefs(true);
    services.user
      .getNotificationPrefs(user.id)
      .then((res) => {
        if (!active) return;
        if (res.ok && res.data) {
          setPrefs({ ...res.data });
        }
      })
      .finally(() => setLoadingPrefs(false));
    return () => {
      active = false;
    };
  }, [user?.id]);

  // ------------------------------------------------------------------------
  // Save handlers
  // ------------------------------------------------------------------------
  async function saveNotifications() {
    if (!user) return;
    setSavingPrefs(true);
    try {
      const res = await services.user.updateNotificationPrefs(user.id, prefs);
      if (res.ok && res.data) {
        setPrefs({ ...res.data });
        toast({ title: "Notification preferences saved" });
      } else {
        toast({ title: "Could not save", description: res.error, variant: "destructive" });
      }
    } finally {
      setSavingPrefs(false);
    }
  }

  function saveDisplay() {
    toast({ title: "Display preferences saved" });
  }

  function savePrivacy() {
    toast({ title: "Privacy preferences saved" });
  }

  function handleCurrencyChange(value: CurrencyCode) {
    setCurrency(value);
    toast({
      title: `Display currency updated to ${value}`,
    });
  }

  // ------------------------------------------------------------------------
  // Toggle helpers
  // ------------------------------------------------------------------------
  function setChannel<K extends keyof NotificationPreferences["channels"]>(
    key: K,
    v: boolean
  ) {
    setPrefs((s) => ({ ...s, channels: { ...s.channels, [key]: v } }));
  }

  function setCategory<
    K extends keyof NotificationPreferences["categories"]
  >(key: K, v: boolean) {
    setPrefs((s) => ({ ...s, categories: { ...s.categories, [key]: v } }));
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading preferences…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      <PageHeader
        title="Preferences"
        description="Customize your OceanSky experience."
      />

      {/* ---------------------------------------------------------------- */}
      {/* Notifications                                                    */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Notifications"
        description="Choose how and what OceanSky can contact you about."
        icon={Bell}
        action={
          <Button
            size="sm"
            onClick={saveNotifications}
            disabled={savingPrefs || loadingPrefs}
          >
            {savingPrefs ? "Saving…" : "Save changes"}
          </Button>
        }
      >
        {/* Channels */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Delivery channels
            </p>
            <div className="mt-3 divide-y divide-border/60">
              <ToggleRow
                icon={Smartphone}
                title="Push notifications"
                description="Real-time alerts on your devices."
                checked={prefs.channels.push}
                onChange={(v) => setChannel("push", v)}
                disabled={loadingPrefs}
              />
              <ToggleRow
                icon={Mail}
                title="Email"
                description="Digests and receipts sent to your inbox."
                checked={prefs.channels.email}
                onChange={(v) => setChannel("email", v)}
                disabled={loadingPrefs}
              />
              <ToggleRow
                icon={MessageSquare}
                title="SMS"
                description="Text alerts for critical activity."
                checked={prefs.channels.sms}
                onChange={(v) => setChannel("sms", v)}
                disabled={loadingPrefs}
              />
            </div>
          </div>

          {/* Categories */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Notification categories
            </p>
            <div className="mt-3 divide-y divide-border/60">
              <ToggleRow
                icon={Wallet}
                title="Transactions"
                description="Credits, debits and transfers."
                checked={prefs.categories.transaction}
                onChange={(v) => setCategory("transaction", v)}
                disabled={loadingPrefs}
              />
              <ToggleRow
                icon={Bell}
                title="Security"
                description="Sign-ins, password and 2FA changes."
                checked={prefs.categories.security}
                onChange={(v) => setCategory("security", v)}
                disabled={loadingPrefs}
              />
              <ToggleRow
                icon={Megaphone}
                title="Promotions"
                description="Offers, rewards and campaigns."
                checked={prefs.categories.promo}
                onChange={(v) => setCategory("promo", v)}
                disabled={loadingPrefs}
              />
              <ToggleRow
                icon={Globe2}
                title="System"
                description="Maintenance, downtime and policy updates."
                checked={prefs.categories.system}
                onChange={(v) => setCategory("system", v)}
                disabled={loadingPrefs}
              />
              <ToggleRow
                icon={MessageSquare}
                title="Support"
                description="Replies on your support tickets."
                checked={prefs.categories.support}
                onChange={(v) => setCategory("support", v)}
                disabled={loadingPrefs}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* Display                                                          */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Display"
        description="How OceanSky looks and reads on this device."
        icon={Palette}
        action={<Button size="sm" onClick={saveDisplay}>Save changes</Button>}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pref-theme">Theme</Label>
            <Select
              value={display.theme}
              onValueChange={(v) => setDisplay((s) => ({ ...s, theme: v }))}
            >
              <SelectTrigger id="pref-theme" className="w-full">
                <Sun className="size-4 text-teal" />
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Only Light is wired for now.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pref-lang">Language</Label>
            <Select
              value={display.language}
              onValueChange={(v) => setDisplay((s) => ({ ...s, language: v }))}
            >
              <SelectTrigger id="pref-lang" className="w-full">
                <Globe2 className="size-4 text-teal" />
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="german">German</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Language packs coming soon.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pref-currency">Display currency</Label>
            <Select
              value={currency}
              onValueChange={(v) => handleCurrencyChange(v as CurrencyCode)}
            >
              <SelectTrigger id="pref-currency" className="w-full">
                <Wallet className="size-4 text-teal" />
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Amounts are converted and displayed in this currency.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* Privacy                                                          */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Privacy"
        description="Control what OceanSky can show and share about you."
        icon={Eye}
        action={<Button size="sm" onClick={savePrivacy}>Save changes</Button>}
      >
        <div className="divide-y divide-border/60">
          <ToggleRow
            icon={Eye}
            title="Show balance on dashboard"
            description="Display your available balance on the home screen."
            checked={privacy.showBalance}
            onChange={(v) => setPrivacy((s) => ({ ...s, showBalance: v }))}
          />
          <ToggleRow
            icon={Share2}
            title="Share transaction insights"
            description="Let OceanSky analyse your spending to surface insights."
            checked={privacy.shareInsights}
            onChange={(v) => setPrivacy((s) => ({ ...s, shareInsights: v }))}
          />
          <ToggleRow
            icon={Megaphone}
            title="Receive marketing communications"
            description="Occasional product updates and partner offers."
            checked={privacy.marketing}
            onChange={(v) => setPrivacy((s) => ({ ...s, marketing: v }))}
          />
        </div>
      </SectionCard>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Toggle row
// ----------------------------------------------------------------------------
function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
