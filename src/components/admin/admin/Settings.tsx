"use client";
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Building2,
  Coins,
  ShieldCheck,
  Wrench,
  Save,
  AlertTriangle,
  Loader2,
  Globe,
  Mail,
  Phone,
  Hash,
  Banknote,
  Percent,
  Wallet,
  KeyRound,
  Clock3,
  Lock,
  Network,
  Power,
} from "lucide-react";
import { services } from "@/lib/services";
import type { BankSettings } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS = ["USD", "EUR"];

// Mock-only fields (not part of BankSettings type)
interface MockSecurityFields {
  twoFactorEnforced: boolean;
  sessionTimeoutMinutes: number;
  ipWhitelist: string;
}

interface MockMaintenanceFields {
  maintenanceMessage: string;
  scheduledWindow: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminSettings() {
  const [settings, setSettings] = useState<BankSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("general");
  const [savingTab, setSavingTab] = useState<string | null>(null);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);

  // mock-only fields
  const [mockSecurity, setMockSecurity] = useState<MockSecurityFields>({
    twoFactorEnforced: true,
    sessionTimeoutMinutes: 30,
    ipWhitelist: "10.20.30.0/24\n192.168.1.0/24",
  });
  const [mockMaintenance, setMockMaintenance] = useState<MockMaintenanceFields>({
    maintenanceMessage:
      "We're performing scheduled maintenance. Some services may be temporarily unavailable.",
    scheduledWindow: "",
  });

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.getBankSettings();
      if (!active) return;
      if (res.ok && res.data) setSettings(res.data);
      if (!res.ok) toast.error(res.error || "Failed to load bank settings.");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Field patching
  // -------------------------------------------------------------------------

  function patch<K extends keyof BankSettings>(key: K, value: BankSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  function patchMockSecurity<K extends keyof MockSecurityFields>(
    key: K,
    value: MockSecurityFields[K]
  ) {
    setMockSecurity((prev) => ({ ...prev, [key]: value }));
  }

  function patchMockMaintenance<K extends keyof MockMaintenanceFields>(
    key: K,
    value: MockMaintenanceFields[K]
  ) {
    setMockMaintenance((prev) => ({ ...prev, [key]: value }));
  }

  // -------------------------------------------------------------------------
  // Save handlers
  // -------------------------------------------------------------------------

  async function saveGeneral() {
    if (!settings) return;
    setSavingTab("general");
    const res = await services.admin.updateBankSettings({
      bankName: settings.bankName,
      bankCode: settings.bankCode,
      swiftCode: settings.swiftCode,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      baseCurrency: settings.baseCurrency,
    });
    if (res.ok && res.data) {
      setSettings(res.data);
      toast.success("General settings saved.");
    } else {
      toast.error(res.error || "Failed to save general settings.");
    }
    setSavingTab(null);
  }

  async function saveFees() {
    if (!settings) return;
    setSavingTab("fees");
    const res = await services.admin.updateBankSettings({
      transferFeeFlat: settings.transferFeeFlat,
      transferFeePct: settings.transferFeePct,
      dailyTransferLimit: settings.dailyTransferLimit,
    });
    if (res.ok && res.data) {
      setSettings(res.data);
      toast.success("Fees & limits saved.");
    } else {
      toast.error(res.error || "Failed to save fees & limits.");
    }
    setSavingTab(null);
  }

  async function saveSecurity() {
    if (!settings) return;
    setSavingTab("security");
    const res = await services.admin.updateBankSettings({
      otpExpiryMinutes: settings.otpExpiryMinutes,
    });
    if (res.ok && res.data) {
      setSettings(res.data);
      toast.success("Security settings saved.", {
        description: "2FA, session timeout and IP whitelist configuration.",
      });
    } else {
      toast.error(res.error || "Failed to save security settings.");
    }
    setSavingTab(null);
  }

  async function saveMaintenance() {
    if (!settings) return;
    setSavingTab("maintenance");
    const res = await services.admin.updateBankSettings({
      maintenanceMode: settings.maintenanceMode,
    });
    if (res.ok && res.data) {
      setSettings(res.data);
      toast.success("Maintenance settings saved.", {
        description: "Maintenance message and scheduled window configuration.",
      });
    } else {
      toast.error(res.error || "Failed to save maintenance settings.");
    }
    setSavingTab(null);
  }

  async function toggleMaintenance(next: boolean) {
    if (!settings) return;
    setTogglingMaintenance(true);
    const res = await services.admin.updateBankSettings({ maintenanceMode: next });
    if (res.ok && res.data) {
      setSettings(res.data);
      toast.success(
        next ? "Maintenance mode enabled." : "Maintenance mode disabled.",
        {
          description: next
            ? "Customers will see the maintenance screen."
            : "Normal service restored.",
          icon: next ? (
            <AlertTriangle className="size-4 text-amber-500" />
          ) : undefined,
        }
      );
    } else {
      toast.error(res.error || "Failed to toggle maintenance mode.");
    }
    setTogglingMaintenance(false);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Bank Settings"
        description="Operational configuration for OceanSky Bank."
        actions={
          <Badge variant="outline" className="border-teal/40 bg-teal/10 text-teal gap-1.5">
            <SettingsIcon className="size-3.5" /> Admin console
          </Badge>
        }
      />

      {/* Maintenance warning banner */}
      {settings.maintenanceMode && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid place-items-center rounded-lg bg-amber-200 size-8 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 shrink-0">
              <AlertTriangle className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Maintenance mode is ON — customers will see a maintenance screen.
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                All customer-facing transactions and logins are suspended until disabled.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleMaintenance(false)}
            disabled={togglingMaintenance}
            className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/15 shrink-0"
          >
            <Power className="size-3.5" /> Disable now
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="general" className="gap-1.5 text-xs">
            <Building2 className="size-3.5" /> General
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5 text-xs">
            <Coins className="size-3.5" /> Fees & Limits
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 text-xs">
            <ShieldCheck className="size-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5 text-xs">
            <Wrench className="size-3.5" /> Maintenance
          </TabsTrigger>
        </TabsList>

        {/* General tab */}
        <TabsContent value="general" className="mt-4">
          <SectionCard
            title="General information"
            description="Bank identity and contact details"
            icon={Building2}
            bodyClassName="space-y-4"
            className="max-w-3xl"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Bank name"
                icon={Building2}
                htmlFor="set-bank-name"
              >
                <Input
                  id="set-bank-name"
                  value={settings.bankName}
                  onChange={(e) => patch("bankName", e.target.value)}
                />
              </Field>
              <Field label="Bank code" icon={Hash} htmlFor="set-bank-code">
                <Input
                  id="set-bank-code"
                  value={settings.bankCode}
                  onChange={(e) => patch("bankCode", e.target.value)}
                />
              </Field>
              <Field label="SWIFT code" icon={Globe} htmlFor="set-swift">
                <Input
                  id="set-swift"
                  value={settings.swiftCode}
                  onChange={(e) => patch("swiftCode", e.target.value)}
                />
              </Field>
              <Field label="Base currency" icon={Banknote}>
                <Select
                  value={settings.baseCurrency}
                  onValueChange={(v) => patch("baseCurrency", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Support email" icon={Mail} htmlFor="set-email">
                <Input
                  id="set-email"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => patch("supportEmail", e.target.value)}
                />
              </Field>
              <Field label="Support phone" icon={Phone} htmlFor="set-phone">
                <Input
                  id="set-phone"
                  value={settings.supportPhone}
                  onChange={(e) => patch("supportPhone", e.target.value)}
                />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={saveGeneral}
                disabled={savingTab === "general"}
                className="bg-teal text-white hover:bg-teal/90"
              >
                {savingTab === "general" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        {/* Fees & Limits tab */}
        <TabsContent value="fees" className="mt-4">
          <SectionCard
            title="Fees & limits"
            description="Transfer pricing and daily transaction caps"
            icon={Coins}
            bodyClassName="space-y-4"
            className="max-w-3xl"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                label="Transfer fee (flat)"
                icon={Wallet}
                htmlFor="set-fee-flat"
                hint="Per-transaction base fee"
              >
                <Input
                  id="set-fee-flat"
                  type="number"
                  min={0}
                  step={0.01}
                  value={settings.transferFeeFlat}
                  onChange={(e) =>
                    patch("transferFeeFlat", Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field
                label="Transfer fee (%)"
                icon={Percent}
                htmlFor="set-fee-pct"
                hint="Percentage of amount"
              >
                <Input
                  id="set-fee-pct"
                  type="number"
                  min={0}
                  step={0.01}
                  value={settings.transferFeePct}
                  onChange={(e) =>
                    patch("transferFeePct", Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field
                label="Daily transfer limit"
                icon={Banknote}
                htmlFor="set-daily-limit"
                hint="Maximum per customer per day"
              >
                <Input
                  id="set-daily-limit"
                  type="number"
                  min={0}
                  step={100}
                  value={settings.dailyTransferLimit}
                  onChange={(e) =>
                    patch("dailyTransferLimit", Number(e.target.value) || 0)
                  }
                />
              </Field>
            </div>

            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Effective fee formula</p>
              <p className="mt-1 font-mono">
                fee = max(flat, amount × pct%) · capped at daily limit
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={saveFees}
                disabled={savingTab === "fees"}
                className="bg-teal text-white hover:bg-teal/90"
              >
                {savingTab === "fees" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security" className="mt-4">
          <SectionCard
            title="Security"
            description="Authentication and access controls"
            icon={ShieldCheck}
            bodyClassName="space-y-4"
            className="max-w-3xl"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="OTP expiry (minutes)"
                icon={Clock3}
                htmlFor="set-otp"
              >
                <Input
                  id="set-otp"
                  type="number"
                  min={1}
                  max={30}
                  value={settings.otpExpiryMinutes}
                  onChange={(e) =>
                    patch("otpExpiryMinutes", Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field
                label="Session timeout (minutes)"
                icon={Lock}
                hint="Stored locally for this console"
              >
                <Input
                  type="number"
                  min={5}
                  value={mockSecurity.sessionTimeoutMinutes}
                  onChange={(e) =>
                    patchMockSecurity(
                      "sessionTimeoutMinutes",
                      Number(e.target.value) || 0
                    )
                  }
                />
              </Field>
            </div>

            {/* 2FA switch */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="grid place-items-center rounded-lg bg-teal/15 size-8 text-teal shrink-0">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">2FA enforcement</p>
                  <p className="text-xs text-muted-foreground">
                    Require two-factor auth for all admin accounts.
                  </p>
                </div>
              </div>
              <Switch
                checked={mockSecurity.twoFactorEnforced}
                onCheckedChange={(v) => patchMockSecurity("twoFactorEnforced", v)}
              />
            </div>

            {/* IP whitelist */}
            <Field
              label="IP whitelist"
              icon={Network}
              hint="One CIDR or IP per line"
            >
              <Textarea
                value={mockSecurity.ipWhitelist}
                onChange={(e) => patchMockSecurity("ipWhitelist", e.target.value)}
                className="min-h-24 text-xs font-mono"
                placeholder="10.20.30.0/24&#10;192.168.1.0/24"
              />
            </Field>

            <div className="flex justify-end pt-2">
              <Button
                onClick={saveSecurity}
                disabled={savingTab === "security"}
                className="bg-teal text-white hover:bg-teal/90"
              >
                {savingTab === "security" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        {/* Maintenance tab */}
        <TabsContent value="maintenance" className="mt-4">
          <SectionCard
            title="Maintenance"
            description="Service status and scheduled downtime"
            icon={Wrench}
            bodyClassName="space-y-4"
            className="max-w-3xl"
          >
            {/* Maintenance mode switch */}
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border p-4 transition-colors",
                settings.maintenanceMode
                  ? "border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                  : "border-border/60 bg-muted/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "grid place-items-center rounded-lg size-8 shrink-0",
                    settings.maintenanceMode
                      ? "bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                      : "bg-teal/15 text-teal"
                  )}
                >
                  <Power className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Maintenance mode</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, customers see a maintenance screen instead of the app.
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                disabled={togglingMaintenance}
                onCheckedChange={(v) => toggleMaintenance(v)}
              />
            </div>

            {/* Maintenance message */}
            <Field
              label="Maintenance message"
              icon={Wrench}
              hint="Shown to customers during downtime"
            >
              <Textarea
                value={mockMaintenance.maintenanceMessage}
                onChange={(e) =>
                  patchMockMaintenance("maintenanceMessage", e.target.value)
                }
                className="min-h-24 text-sm"
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground">
                {mockMaintenance.maintenanceMessage.length}/300
              </p>
            </Field>

            {/* Scheduled window */}
            <Field
              label="Scheduled maintenance window"
              icon={Clock3}
              hint="ISO date or human-readable"
            >
              <Input
                type="date"
                value={mockMaintenance.scheduledWindow}
                onChange={(e) =>
                  patchMockMaintenance("scheduledWindow", e.target.value)
                }
              />
            </Field>

            <div className="flex justify-end pt-2">
              <Button
                onClick={saveMaintenance}
                disabled={savingTab === "maintenance"}
                className="bg-teal text-white hover:bg-teal/90"
              >
                {savingTab === "maintenance" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </Button>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------

function Field({
  label,
  icon: Icon,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  icon?: typeof Building2;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        <Label htmlFor={htmlFor}>{label}</Label>
      </div>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
