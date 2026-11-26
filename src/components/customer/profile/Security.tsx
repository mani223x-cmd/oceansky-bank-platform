"use client";

// ============================================================================
// OceanSky Bank — Security Centre (customer)
// ----------------------------------------------------------------------------
// Password, transaction PIN, 2FA / biometric / login-alert toggles, active
// sessions (with revoke) and a trusted-devices summary. All toggles are mock
// unless wired to a real backend later.
// ============================================================================

import { useEffect, useState } from "react";
import {
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  Tablet,
  Unlock,
} from "lucide-react";

import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import { timeAgo } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type { UserSession } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function deviceIcon(device: string) {
  const d = device.toLowerCase();
  if (d.includes("phone") || d.includes("mobile")) return Smartphone;
  if (d.includes("tablet") || d.includes("ipad")) return Tablet;
  return Monitor;
}

// ============================================================================
// Component
// ============================================================================
export function Security() {
  const { user } = useAuthStore();

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Password form
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  // PIN dialog
  const [pinOpen, setPinOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  // Mock security toggles
  const [twoFA, setTwoFA] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  // Revoke session dialog
  const [revokeTarget, setRevokeTarget] = useState<UserSession | null>(null);

  // ------------------------------------------------------------------------
  // Sessions
  // ------------------------------------------------------------------------
  async function refreshSessions() {
    if (!user) return;
    setLoadingSessions(true);
    const res = await services.user.getSessions(user.id);
    if (res.ok && res.data) setSessions(res.data);
    setLoadingSessions(false);
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    services.user
      .getSessions(user.id)
      .then((res) => {
        if (active && res.ok && res.data) setSessions(res.data);
      })
      .finally(() => {
        if (active) setLoadingSessions(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function doRevoke() {
    if (!revokeTarget) return;
    const res = await services.user.revokeSession(revokeTarget.id);
    if (res.ok) {
      toast({ title: "Session revoked", description: revokeTarget.device });
      await refreshSessions();
    } else {
      toast({ title: "Could not revoke", description: res.error, variant: "destructive" });
    }
    setRevokeTarget(null);
  }

  // ------------------------------------------------------------------------
  // Password
  // ------------------------------------------------------------------------
  function validatePassword(p: string): string | null {
    if (p.length < 8) return "Password must be at least 8 characters.";
    if (!/\d/.test(p)) return "Password must include at least one number.";
    return null;
  }

  async function savePassword() {
    if (!pw.current) {
      toast({ title: "Enter your current password", variant: "destructive" });
      return;
    }
    const err = validatePassword(pw.next);
    if (err) {
      toast({ title: "Weak password", description: err, variant: "destructive" });
      return;
    }
    if (pw.next !== pw.confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    // Mock — no real persistence for credentials in the demo.
    await new Promise((r) => setTimeout(r, 600));
    setSavingPw(false);
    setPw({ current: "", next: "", confirm: "" });
    toast({ title: "Password updated" });
  }

  // ------------------------------------------------------------------------
  // PIN
  // ------------------------------------------------------------------------
  async function savePin() {
    if (newPin.length !== 4) {
      toast({ title: "Enter a 4-digit PIN", variant: "destructive" });
      return;
    }
    setSavingPin(true);
    await new Promise((r) => setTimeout(r, 500));
    setSavingPin(false);
    setNewPin("");
    setPinOpen(false);
    toast({ title: "PIN updated" });
  }

  // ------------------------------------------------------------------------
  // Mock toggles
  // ------------------------------------------------------------------------
  function onToggle2FA(v: boolean) {
    setTwoFA(v);
    toast({
      title: v
        ? "Two-factor authentication is now enabled."
        : "Two-factor authentication is now disabled.",
    });
  }

  function onToggleBiometric(v: boolean) {
    setBiometric(v);
    toast({
      title: v ? "Biometric login enabled" : "Biometric login disabled",
    });
  }

  function onToggleLoginAlerts(v: boolean) {
    setLoginAlerts(v);
    if (v) toast({ title: "You'll be alerted on new sign-ins" });
    else toast({ title: "Login alerts turned off" });
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading security centre…</p>
      </div>
    );
  }

  const activeCount = sessions.length;
  const currentSession = sessions.find((s) => s.current) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-10 pt-6 sm:px-6">
      <PageHeader
        title="Security Centre"
        description="Protect your account and devices."
      />

      {/* ---------------------------------------------------------------- */}
      {/* Stats                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Security score"
          value="85 / 100"
          icon={ShieldCheck}
          accent="teal"
          footer="Strong — review sessions to improve"
        />
        <StatCard
          label="Active devices"
          value={activeCount}
          icon={MonitorSmartphone}
          accent="turquoise"
          footer="Across signed-in sessions"
        />
        <StatCard
          label="Two-factor auth"
          value={
            <Badge
              className={twoFA ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground"}
              variant="secondary"
            >
              {twoFA ? "Enabled" : "Disabled"}
            </Badge>
          }
          icon={Lock}
          accent={twoFA ? "teal" : "muted"}
          footer={twoFA ? "Protects every sign-in" : "We recommend enabling 2FA"}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Change password                                                  */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Change password"
        description="Minimum 8 characters with at least one number."
        icon={KeyRound}
        action={
          <Button onClick={savePassword} disabled={savingPw} size="sm">
            {savingPw ? "Updating…" : "Update password"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pwCurrent">Current password</Label>
            <Input
              id="pwCurrent"
              type="password"
              value={pw.current}
              onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwNext">New password</Label>
            <Input
              id="pwNext"
              type="password"
              value={pw.next}
              onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwConfirm">Confirm new password</Label>
            <Input
              id="pwConfirm"
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* Transaction PIN                                                  */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Transaction PIN"
        description="Used to authorise transfers and bill payments."
        icon={Lock}
        action={
          <Button variant="outline" size="sm" onClick={() => setPinOpen(true)}>
            <KeyRound className="size-4" />
            Change PIN
          </Button>
        }
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="grid size-9 place-items-center rounded-md border border-border bg-muted/40 text-lg font-bold text-muted-foreground"
              >
                •
              </span>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">PIN set</span>
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* Authentication toggles                                           */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard title="Authentication" icon={ShieldCheck}>
        <div className="divide-y divide-border/60">
          <ToggleRow
            icon={Lock}
            title="Two-factor authentication"
            description="Require an OTP on every new sign-in for stronger protection."
            checked={twoFA}
            onChange={onToggle2FA}
          />
          <ToggleRow
            icon={Fingerprint}
            title="Biometric login"
            description="Use Face ID or fingerprint to unlock the app on supported devices."
            checked={biometric}
            onChange={onToggleBiometric}
          />
          <ToggleRow
            icon={ShieldCheck}
            title="Login alerts"
            description="Get notified whenever your account is accessed from a new device."
            checked={loginAlerts}
            onChange={onToggleLoginAlerts}
          />
        </div>
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* Active sessions                                                  */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Active sessions"
        description="Devices currently signed in to your OceanSky account."
        icon={MonitorSmartphone}
      >
        {loadingSessions ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg border border-border/60 bg-muted/40"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            title="No active sessions"
            description="Your session list is empty."
            icon={MonitorSmartphone}
          />
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => {
              const Icon = deviceIcon(s.device);
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal/10 text-teal">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{s.device}</p>
                        {s.current && (
                          <Badge className="bg-teal/15 text-teal border-teal/30" variant="secondary">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.browser} · {s.ipAddress} · {s.location}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last active {timeAgo(s.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {s.current ? (
                      <Badge variant="outline" className="font-normal">
                        <Unlock className="size-3" />
                        This device
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevokeTarget(s)}
                      >
                        <LogOut className="size-4" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* Trusted devices                                                  */}
      {/* ---------------------------------------------------------------- */}
      <SectionCard
        title="Trusted devices"
        description="Devices you have marked as trusted for faster sign-in."
        icon={ShieldCheck}
      >
        {currentSession ? (
          <div className="flex items-center gap-3 rounded-lg border border-teal/20 bg-teal/5 p-4">
            {(() => {
              const Icon = deviceIcon(currentSession.device);
              return (
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal/15 text-teal">
                  <Icon className="size-5" />
                </div>
              );
            })()}
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate font-medium">{currentSession.device}</p>
              <p className="text-xs text-muted-foreground">
                {currentSession.browser} · {currentSession.location}
              </p>
            </div>
            <Badge className="bg-teal/15 text-teal border-teal/30" variant="secondary">
              <ShieldCheck className="size-3" />
              Trusted
            </Badge>
          </div>
        ) : (
          <EmptyState
            title="No trusted devices"
            description="Sign in once and your current device will appear here."
            icon={ShieldCheck}
          />
        )}
      </SectionCard>

      {/* ---------------------------------------------------------------- */}
      {/* PIN dialog                                                       */}
      {/* ---------------------------------------------------------------- */}
      <Dialog open={pinOpen} onOpenChange={(o) => !o && setPinOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change transaction PIN</DialogTitle>
            <DialogDescription>
              Enter a new 4-digit PIN. Avoid patterns like 1234 or repeated digits.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <InputOTP
              maxLength={4}
              value={newPin}
              onChange={(v) => setNewPin(v)}
              onComplete={() => {}}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-xs text-muted-foreground">
              Avoid patterns like 1234 or repeated digits.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPinOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePin} disabled={savingPin}>
              {savingPin ? "Saving…" : "Save PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------------------- */}
      {/* Revoke confirm                                                   */}
      {/* ---------------------------------------------------------------- */}
      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={doRevoke}
        title="Revoke this session?"
        description={
          revokeTarget
            ? `${revokeTarget.device} will be signed out immediately.`
            : ""
        }
        confirmLabel="Revoke"
        variant="danger"
      />
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
}: {
  icon: typeof Lock;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
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
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
