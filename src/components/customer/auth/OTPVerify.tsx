"use client";
import { useEffect, useRef, useState } from "react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { services } from "@/lib/services";
import { AuthShell } from "@/components/customer/auth/Login";
import { Logo } from "@/components/shared/Logo";
import { OTPInput, OTPSlot } from "@/components/shared/OTPInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  Mail,
  Smartphone,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  RefreshCw,
} from "lucide-react";

const RESEND_SECONDS = 60;

export function OTPVerify() {
  const go = useRouterStore((s) => s.go);
  const pendingChallenge = useAuthStore((s) => s.pendingChallenge);
  const setPendingChallenge = useAuthStore((s) => s.setPendingChallenge);
  const setToken = useAuthStore((s) => s.setToken);
  const email = useAuthStore((s) => s.user?.email);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const redirectedRef = useRef(false);

  // If no pending challenge (e.g. user navigated here directly), send them
  // back to login so they can start a real flow.
  useEffect(() => {
    if (!pendingChallenge && !redirectedRef.current) {
      redirectedRef.current = true;
      go("/login");
    }
  }, [pendingChallenge, go]);

  // Resend countdown — ticks every second while the form is mounted.
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  if (!pendingChallenge) {
    // Minimal placeholder while the redirect effect runs.
    return (
      <AuthShell side={<SidePanel />}>
        <div className="space-y-6">
          <div className="lg:hidden"><Logo size="md" /></div>
          <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
        </div>
      </AuthShell>
    );
  }

  const destination = pendingChallenge.destination;
  const codeReady = code.length === 6;

  async function verify() {
    if (!pendingChallenge || code.length !== 6) return;
    setLoading(true);
    try {
      const res = await services.auth.verifyOtp({
        userId: pendingChallenge.userId,
        otpCode: code,
      });
      if (!res.ok || !res.data) {
        toast({ title: res.error || "Invalid code", variant: "destructive" });
        setLoading(false);
        return;
      }
      setToken(res.data.token);
      toast({
        title: "Verified",
        description: "You're signed in. Taking you to your dashboard…",
      });
      go("/dashboard");
    } catch (err) {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    }
    setLoading(false);
  }

  async function resend() {
    if (!email) {
      toast({ title: "No email on file", description: "Please sign in again.", variant: "destructive" });
      go("/login");
      return;
    }
    setResending(true);
    try {
      // Re-issue a challenge via the login endpoint using the stored email.
      const res = await services.auth.login(email, "");
      if (!res.ok || !res.data) {
        toast({ title: res.error || "Could not resend code", variant: "destructive" });
        setResending(false);
        return;
      }
      setPendingChallenge({
        userId: res.data.userId,
        otpChallengeId: res.data.otpChallengeId,
        otpCode: res.data.otpCode,
        destination: res.data.otpDestination,
      });
      setSeconds(RESEND_SECONDS);
      toast({ title: "New OTP sent", description: `Code sent to ${res.data.otpDestination}.` });
    } catch (err) {
      toast({ title: "Network error", variant: "destructive" });
    }
    setResending(false);
  }

  function switchChannel() {
    setChannel((c) => (c === "email" ? "sms" : "email"));
    toast({
      title: "Verification channel switched",
      description: "You can request your next code via either email or SMS.",
    });
  }

  return (
    <AuthShell side={<SidePanel />}>
      <div className="space-y-6">
        <div className="lg:hidden"><Logo size="md" /></div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => go("/login")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="size-3" /> Back to sign in
          </button>
          <div className="flex items-center gap-2">
            <div className="grid place-items-center size-9 rounded-lg bg-teal/10 text-teal ring-1 ring-teal/20">
              <KeyRound className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Verify it&apos;s you</h1>
              <p className="text-sm text-muted-foreground">Enter the code sent to {destination}</p>
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (codeReady && !loading) verify();
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <Label>One-time code</Label>
            <OTPInput
              maxLength={6}
              value={code}
              onChange={(v) => setCode(v)}
              autoFocus
              containerClassName="justify-between sm:justify-start"
            >
              <div className="flex items-center gap-2">
                <OTPSlot index={0} />
                <OTPSlot index={1} />
                <OTPSlot index={2} />
              </div>
              <span className="text-muted-foreground">–</span>
              <div className="flex items-center gap-2">
                <OTPSlot index={3} />
                <OTPSlot index={4} />
                <OTPSlot index={5} />
              </div>
            </OTPInput>
            <p className="text-xs text-muted-foreground">
              {codeReady
                ? "Looks complete — tap Verify to continue."
                : "Enter all 6 digits to continue."}
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={!codeReady || loading}>
            {loading ? (
              "Verifying…"
            ) : (
              <>
                Verify <ArrowRight className="size-4 ml-1" />
              </>
            )}
          </Button>
        </form>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={seconds > 0 || resending}
              onClick={resend}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="size-3.5 mr-1" />
              {seconds > 0 ? `Resend code (${seconds}s)` : resending ? "Sending…" : "Resend code"}
            </Button>
            <button
              type="button"
              onClick={switchChannel}
              className="text-xs text-teal hover:underline inline-flex items-center gap-1 justify-center sm:justify-start"
            >
              {channel === "email" ? (
                <>
                  <Smartphone className="size-3.5" /> Use a different channel
                </>
              ) : (
                <>
                  <Mail className="size-3.5" /> Use a different channel
                </>
              )}
            </button>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            Didn&apos;t get it? Check spam, or{" "}
            <button
              type="button"
              onClick={() => go("/login")}
              className="text-teal hover:underline"
            >
              start over
            </button>
            .
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

function SidePanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between h-full p-10 text-white">
      <Logo variant="light" size="lg" />
      <div className="space-y-8">
        <h2 className="text-3xl font-bold leading-tight">
          One last step<br />before you sail in.
        </h2>
        <div className="space-y-4">
          <Feature icon={ShieldCheck} title="Why we ask" desc="OTP verification keeps your account safe even if your password leaks." />
          <Feature icon={Mail} title="Email channel" desc="By default the code is emailed to the address on your account." />
          <Feature icon={Smartphone} title="SMS backup" desc="Switch channels anytime if your inbox is out of reach." />
        </div>
      </div>
      <p className="text-xs text-white/60">© OceanSky Bank. All rights reserved.</p>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid place-items-center size-10 rounded-lg bg-white/10 ring-1 ring-white/15">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-white/70">{desc}</p>
      </div>
    </div>
  );
}
