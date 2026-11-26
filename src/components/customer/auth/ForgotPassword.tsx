"use client";
import { useEffect, useState } from "react";
import { useRouterStore } from "@/lib/router";
import { services } from "@/lib/services";
import { AuthShell } from "@/components/customer/auth/Login";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  Clock,
  Inbox,
  KeyRound,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 60;

export function ForgotPassword() {
  const go = useRouterStore((s) => s.go);

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | undefined>();

  // Resend cooldown ticker — only runs while a countdown is active.
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      const res = await services.auth.forgotPassword(email.trim());
      if (!res.ok || !res.data) {
        // Service only returns ok=false on hard errors; surface the message.
        toast({ title: res.error || "Could not send reset email", variant: "destructive" });
        setLoading(false);
        return;
      }
      // Always show the same neutral success message so we never leak whether
      // an account exists for the entered address.
      setDestination(res.data.destination);
      setSeconds(RESEND_SECONDS);
      setStep(2);
      toast({
        title: "Reset link sent",
        description: `If an account exists for ${res.data.destination}, a reset link has been sent.`,
      });
    } catch (err) {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    }
    setLoading(false);
  }

  async function resend() {
    if (seconds > 0 || !email.trim()) return;
    setResending(true);
    try {
      const res = await services.auth.forgotPassword(email.trim());
      if (!res.ok || !res.data) {
        toast({ title: res.error || "Could not resend email", variant: "destructive" });
        setResending(false);
        return;
      }
      setDestination(res.data.destination);
      setSeconds(RESEND_SECONDS);
      toast({ title: "Email resent", description: `A new link was sent to ${res.data.destination}.` });
    } catch (err) {
      toast({ title: "Network error", variant: "destructive" });
    }
    setResending(false);
  }

  return (
    <AuthShell
      side={
        <div className="hidden lg:flex flex-col justify-between h-full p-10 text-white">
          <Logo variant="light" size="lg" />
          <div className="space-y-8">
            <h2 className="text-3xl font-bold leading-tight">
              Forgot your password?<br />We&apos;ve got you.
            </h2>
            <div className="space-y-4">
              <Feature icon={KeyRound} title="Reset by email" desc="Enter your email and we'll send a secure link to create a new password." />
              <Feature icon={Clock} title="Links expire in 30 minutes" desc="For your safety, reset links are short-lived. Request a new one if needed." />
              <Feature icon={ShieldCheck} title="No account? No leak." desc="We show the same confirmation either way — your email is never exposed." />
            </div>
          </div>
          <p className="text-xs text-white/60">© OceanSky Bank. All rights reserved.</p>
        </div>
      }
    >
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
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          {step === 1 ? (
            <p className="text-sm text-muted-foreground">
              Enter your account email and we&apos;ll send you a verification link.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Check your inbox for the link we just sent.
            </p>
          )}
        </div>

        {step === 1 ? (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(undefined);
                }}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!error}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Sending reset link…"
              ) : (
                <>
                  Send reset link <ArrowRight className="size-4 ml-1" />
                </>
              )}
            </Button>

            <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <p>
                We&apos;ll never reveal whether an account exists for an email — you&apos;ll see the
                same confirmation either way.
              </p>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-teal/20 bg-card-gradient p-5 text-center space-y-3">
              <div className="mx-auto grid place-items-center size-12 rounded-full bg-teal/10 text-teal ring-1 ring-teal/20">
                <Inbox className="size-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Check your inbox</h2>
                <p className="text-sm text-muted-foreground">
                  We&apos;ve sent a verification link to{" "}
                  <span className="font-medium text-foreground">{destination}</span>. The link
                  expires in 30 minutes.
                </p>
              </div>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Mail className="size-3.5" /> If you don&apos;t see it within a minute, check your
                spam folder.
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={seconds > 0 || resending}
              onClick={resend}
            >
              <RefreshCw className="size-4 mr-1" />
              {seconds > 0
                ? `Resend email (${seconds}s)`
                : resending
                ? "Sending…"
                : "Resend email"}
            </Button>

            <button
              type="button"
              onClick={() => go("/login")}
              className="block w-full text-center text-sm text-teal font-medium hover:underline"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </AuthShell>
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
