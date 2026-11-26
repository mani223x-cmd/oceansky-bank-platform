"use client";

// ============================================================================
// OceanSky Bank — Profile (customer)
// ----------------------------------------------------------------------------
// Personal information, address, account tier and preferences, all editable
// via the mock `services.user.*` layer. Sits behind the customer shell and
// reads the active user from the auth store.
// ============================================================================

import { useEffect, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  Building2,
  Crown,
  Globe2,
  Home,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";

import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  formatDate,
  initials,
  maskEmail,
  maskPhone,
} from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type { Address, User } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// ----------------------------------------------------------------------------
// Tier metadata — benefits lists + upgrade ladder
// ----------------------------------------------------------------------------
type Tier = User["tier"];

const TIER_LABELS: Record<Tier, string> = {
  standard: "Standard",
  premium: "Premium",
  private: "Private",
};

const TIER_BADGE_CLASS: Record<Tier, string> = {
  standard: "bg-muted text-muted-foreground border-transparent",
  premium: "bg-teal/15 text-teal border-teal/30",
  private: "bg-gradient-to-r from-teal to-turquoise text-white border-transparent",
};

const TIER_BENEFITS: Record<Tier, string[]> = {
  standard: [
    "$10,000 daily transfer limit",
    "4% interest on savings",
    "Standard customer support",
  ],
  premium: [
    "$50,000 daily transfer limit",
    "0% transfer fees",
    "Priority customer support",
  ],
  private: [
    "$200,000 daily transfer limit",
    "Dedicated relationship manager",
    "Exclusive events & invitations",
  ],
};

// Minimum balance required to qualify for each upgrade tier.
const TIER_MIN_BALANCE: Record<Exclude<Tier, "standard">, string> = {
  premium: "$10,000",
  private: "$100,000",
};

const TIER_ORDER: Tier[] = ["standard", "premium", "private"];

function nextTierOf(t: Tier): Tier | null {
  const idx = TIER_ORDER.indexOf(t);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

// ----------------------------------------------------------------------------
// Empty address helper
// ----------------------------------------------------------------------------
const EMPTY_ADDRESS: Address = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
};

// ============================================================================
// Component
// ============================================================================
export function Profile() {
  const { user, setUser } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Personal form state
  const [personal, setPersonal] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    nationality: "",
    occupation: "",
  });

  // --- Address form state
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);

  // --- Preferences state (local mock)
  const [prefs, setPrefs] = useState({
    language: "english",
    theme: "light",
    currency: "USD",
  });

  // --- Upgrade dialog
  const [upgradeTarget, setUpgradeTarget] = useState<Tier | null>(null);

  // ------------------------------------------------------------------------
  // Sync local state from the active user (on mount and whenever user.id
  // changes). Also re-fetch the canonical record from the mock service so
  // the UI reflects whatever the "backend" currently holds.
  // ------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    services.user
      .getById(user.id)
      .then((res) => {
        if (!active) return;
        if (res.ok && res.data) {
          setUser(res.data);
          hydrateFromUser(res.data);
        } else {
          hydrateFromUser(user);
        }
      })
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id]);

  function hydrateFromUser(u: User) {
    setPersonal({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      nationality: u.nationality,
      occupation: u.occupation ?? "",
    });
    setAddress(u.address ?? EMPTY_ADDRESS);
  }

  // ------------------------------------------------------------------------
  // Save handlers
  // ------------------------------------------------------------------------
  async function savePersonal() {
    if (!user) return;
    setSaving(true);
    try {
      const res = await services.user.update(user.id, {
        firstName: personal.firstName.trim(),
        lastName: personal.lastName.trim(),
        phone: personal.phone.trim(),
        nationality: personal.nationality.trim() || "United States",
        occupation: personal.occupation.trim() || undefined,
      });
      if (res.ok && res.data) {
        setUser(res.data);
        toast({ title: "Profile updated" });
      } else {
        toast({ title: "Could not save", description: res.error, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveAddress() {
    if (!user) return;
    if (!address.line1.trim() || !address.city.trim() || !address.country.trim()) {
      toast({
        title: "Incomplete address",
        description: "Street, city and country are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await services.user.update(user.id, { address });
      if (res.ok && res.data) {
        setUser(res.data);
        toast({ title: "Address updated" });
      } else {
        toast({ title: "Could not save", description: res.error, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  async function savePreferences() {
    // Mock — nothing persisted yet beyond UI feedback.
    toast({ title: "Preferences saved" });
  }

  async function confirmUpgrade() {
    if (!user || !upgradeTarget) return;
    const res = await services.user.update(user.id, { tier: upgradeTarget });
    if (res.ok && res.data) {
      setUser(res.data);
      toast({
        title: "Tier upgrade requested",
        description: `You are now on the ${TIER_LABELS[upgradeTarget]} tier.`,
      });
    } else {
      toast({ title: "Upgrade failed", description: res.error, variant: "destructive" });
    }
    setUpgradeTarget(null);
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  const nextTier = nextTierOf(user.tier);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      <PageHeader
        title="Profile"
        description="Manage your personal information and account tier."
      />

      {/* ---------------------------------------------------------------- */}
      {/* Hero card                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-teal/10 via-card to-turquoise/5 shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <Avatar className="size-16 sm:size-20 ring-2 ring-teal/30">
            <AvatarFallback className="bg-gradient-to-br from-teal to-turquoise text-lg font-bold text-white sm:text-xl">
              {initials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1">
              <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                {user.firstName} {user.lastName}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {maskEmail(user.email)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {maskPhone(user.phone)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className={TIER_BADGE_CLASS[user.tier]} variant="secondary">
                <Crown className="size-3" />
                {TIER_LABELS[user.tier]} tier
              </Badge>
              {user.kycVerified ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30" variant="secondary">
                  <ShieldCheck className="size-3" />
                  KYC Verified
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30" variant="secondary">
                  <BadgeCheck className="size-3" />
                  KYC Pending
                </Badge>
              )}
              <Badge variant="outline" className="font-normal">
                Member since {formatDate(user.createdAt, "MMM yyyy")}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Tabs                                                             */}
      {/* ---------------------------------------------------------------- */}
      <Tabs defaultValue="personal" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-full min-w-max sm:w-auto">
            <TabsTrigger value="personal">
              <UserIcon className="size-4" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="address">
              <Home className="size-4" />
              Address
            </TabsTrigger>
            <TabsTrigger value="tier">
              <Sparkles className="size-4" />
              Account Tier
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Globe2 className="size-4" />
              Preferences
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ----------------------------- Personal ---------------------- */}
        <TabsContent value="personal">
          <SectionCard
            title="Personal information"
            description="Update your name, contact and demographic details."
            icon={UserIcon}
            action={
              <Button onClick={savePersonal} disabled={saving || loading} size="sm">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="firstName">
                <Input
                  id="firstName"
                  value={personal.firstName}
                  onChange={(e) =>
                    setPersonal((s) => ({ ...s, firstName: e.target.value }))
                  }
                  placeholder="John"
                />
              </Field>
              <Field label="Last name" htmlFor="lastName">
                <Input
                  id="lastName"
                  value={personal.lastName}
                  onChange={(e) =>
                    setPersonal((s) => ({ ...s, lastName: e.target.value }))
                  }
                  placeholder="Smith"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email" htmlFor="email" hint="Contact support to change email">
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      value={personal.email}
                      readOnly
                      className="bg-muted/40 text-muted-foreground"
                      placeholder="you@example.com"
                    />
                    <AtSign className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                </Field>
              </div>
              <Field label="Phone" htmlFor="phone">
                <Input
                  id="phone"
                  value={personal.phone}
                  onChange={(e) =>
                    setPersonal((s) => ({ ...s, phone: e.target.value }))
                  }
                  placeholder="+1 555 123 4567"
                />
              </Field>
              <Field label="Nationality" htmlFor="nationality">
                <Select
                  value={personal.nationality}
                  onValueChange={(v) =>
                    setPersonal((s) => ({ ...s, nationality: v }))
                  }
                >
                  <SelectTrigger id="nationality" className="w-full">
                    <SelectValue placeholder="Select nationality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="Germany">Germany</SelectItem>
                    <SelectItem value="France">France</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Occupation" htmlFor="occupation">
                  <Input
                    id="occupation"
                    value={personal.occupation}
                    onChange={(e) =>
                      setPersonal((s) => ({ ...s, occupation: e.target.value }))
                    }
                    placeholder="Software engineer"
                  />
                </Field>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ----------------------------- Address ----------------------- */}
        <TabsContent value="address">
          <SectionCard
            title="Residential address"
            description="Used for statements, card delivery and KYC checks."
            icon={MapPin}
            action={
              <Button onClick={saveAddress} disabled={saving || loading} size="sm">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Address line 1" htmlFor="line1">
                  <Input
                    id="line1"
                    value={address.line1}
                    onChange={(e) =>
                      setAddress((s) => ({ ...s, line1: e.target.value }))
                    }
                    placeholder="123 Main Street"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Address line 2 (optional)" htmlFor="line2">
                  <Input
                    id="line2"
                    value={address.line2 ?? ""}
                    onChange={(e) =>
                      setAddress((s) => ({ ...s, line2: e.target.value }))
                    }
                    placeholder="Apartment 4B"
                  />
                </Field>
              </div>
              <Field label="City" htmlFor="city">
                <Input
                  id="city"
                  value={address.city}
                  onChange={(e) =>
                    setAddress((s) => ({ ...s, city: e.target.value }))
                  }
                  placeholder="New York"
                />
              </Field>
              <Field label="State / Province" htmlFor="state">
                <Input
                  id="state"
                  value={address.state ?? ""}
                  onChange={(e) =>
                    setAddress((s) => ({ ...s, state: e.target.value }))
                  }
                  placeholder="NY"
                />
              </Field>
              <Field label="Postal code" htmlFor="postalCode">
                <Input
                  id="postalCode"
                  value={address.postalCode ?? ""}
                  onChange={(e) =>
                    setAddress((s) => ({ ...s, postalCode: e.target.value }))
                  }
                  placeholder="10001"
                />
              </Field>
              <Field label="Country" htmlFor="country">
                <Input
                  id="country"
                  value={address.country}
                  onChange={(e) =>
                    setAddress((s) => ({ ...s, country: e.target.value }))
                  }
                  placeholder="United States"
                />
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ----------------------------- Account Tier ------------------ */}
        <TabsContent value="tier">
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard
              title="Current tier"
              description="Your OceanSky account tier"
              icon={Crown}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-teal/20 bg-teal/5 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Active tier
                    </p>
                    <p className="text-lg font-bold text-teal">
                      {TIER_LABELS[user.tier]}
                    </p>
                  </div>
                  <Crown className="size-7 text-teal" />
                </div>

                <ul className="space-y-2.5">
                  {TIER_BENEFITS[user.tier].map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </SectionCard>

            <SectionCard
              title="Upgrade your tier"
              description="Unlock higher limits and exclusive benefits."
              icon={Sparkles}
            >
              {nextTier ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-dashed border-teal/40 bg-teal/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          Next tier
                        </p>
                        <p className="text-lg font-bold text-teal">
                          {TIER_LABELS[nextTier]}
                        </p>
                      </div>
                      <Sparkles className="size-6 text-teal" />
                    </div>
                    <Separator className="my-3 bg-teal/20" />
                    <ul className="space-y-2">
                      {TIER_BENEFITS[nextTier].map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => setUpgradeTarget(nextTier)}
                  >
                    <Crown className="size-4" />
                    Upgrade to {TIER_LABELS[nextTier]}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Requires a {TIER_MIN_BALANCE[nextTier]} minimum balance.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                  <Crown className="size-10 text-teal" />
                  <p className="font-medium">You are on the highest tier</p>
                  <p className="text-sm text-muted-foreground">
                    Private clients enjoy the best of OceanSky.
                  </p>
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        {/* ----------------------------- Preferences ------------------- */}
        <TabsContent value="preferences">
          <SectionCard
            title="Preferences"
            description="Local display settings for this session."
            icon={Globe2}
            action={
              <Button onClick={savePreferences} size="sm">
                Save preferences
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Language" htmlFor="language">
                <Select
                  value={prefs.language}
                  onValueChange={(v) => setPrefs((s) => ({ ...s, language: v }))}
                >
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Theme" htmlFor="theme" hint="Only Light is wired for now">
                <Select
                  value={prefs.theme}
                  onValueChange={(v) => setPrefs((s) => ({ ...s, theme: v }))}
                >
                  <SelectTrigger id="theme" className="w-full">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Display currency" htmlFor="currency">
                <Select
                  value={prefs.currency}
                  onValueChange={(v) => setPrefs((s) => ({ ...s, currency: v }))}
                >
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD — Dollar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
              <Building2 className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Theme switching beyond Light, and full currency/language
                conversion will be available in a future release.
              </span>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* ---------------------------------------------------------------- */}
      {/* Upgrade confirm dialog                                           */}
      {/* ---------------------------------------------------------------- */}
      <ConfirmDialog
        open={upgradeTarget !== null}
        onClose={() => setUpgradeTarget(null)}
        onConfirm={confirmUpgrade}
        title={
          upgradeTarget
            ? `Upgrade to ${TIER_LABELS[upgradeTarget]}?`
            : "Upgrade tier?"
        }
        description="Your account tier determines transfer limits and benefits."
        confirmLabel="Confirm upgrade"
        variant="success"
      >
        {upgradeTarget && (
          <ul className="space-y-1.5">
            {TIER_BENEFITS[upgradeTarget].map((b) => (
              <li key={b} className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Local helpers
// ----------------------------------------------------------------------------
function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <KeyRound className="size-3" />
          {hint}
        </p>
      )}
    </div>
  );
}
