"use client";
import { useState, type ReactNode } from "react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { services } from "@/lib/services";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Wallet, Headset } from "lucide-react";

export function Login() {
  const go = useRouterStore((s) => s.go);
  const setUser = useAuthStore((s) => s.setUser);
  const setPendingChallenge = useAuthStore((s) => s.setPendingChallenge);
  const [email, setEmail] = useState("olivia.bennett@oceansky.bank");
  const [password, setPassword] = useState("password123");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await services.auth.login(email, password);
      if (!res.ok || !res.data) {
        toast({ title: res.error || "Login failed", variant: "destructive" });
        setLoading(false);
        return;
      }
      const u = await services.user.getById(res.data.userId);
      if (!u.ok || !u.data) {
        toast({ title: "User profile not found", variant: "destructive" });
        setLoading(false);
        return;
      }
      setUser(u.data);
      setPendingChallenge({
        userId: res.data.userId,
        otpChallengeId: res.data.otpChallengeId,
        otpCode: res.data.otpCode,
        destination: res.data.otpDestination,
      });
      toast({
        title: "OTP sent",
        description: `A 6-digit code was sent to ${res.data.otpDestination}.`,
      });
      go("/otp");
    } catch (err) {
      toast({ title: "Network error", variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <AuthShell
      side={
        <div className="hidden lg:flex flex-col justify-between h-full p-10 text-white">
          <Logo variant="light" size="lg" />
          <div className="space-y-8">
            <h2 className="text-3xl font-bold leading-tight">
              Banking that moves<br />at the speed of you.
            </h2>
            <div className="space-y-4">
              <Feature icon={Wallet} title="Instant transfers" desc="Move money to any US bank in seconds with same-day ACH and real-time rails." />
              <Feature icon={ShieldCheck} title="Bank-grade security" desc="OTP verification, biometric login and 24/7 fraud monitoring." />
              <Feature icon={Headset} title="Always-on support" desc="Chat live with our team any time of day." />
            </div>
          </div>
          <p className="text-xs text-white/60">© OceanSky Bank. All rights reserved.</p>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="lg:hidden"><Logo size="md" /></div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your OceanSky account to continue.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button type="button" onClick={() => go("/forgot-password")} className="text-xs text-teal hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Remember this device</Label>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : <>Sign in <ArrowRight className="size-4 ml-1" /></>}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <button onClick={() => go("/register")} className="text-teal font-medium hover:underline">Create one</button>
        </div>

        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground text-center">
          <strong className="font-medium">Admin portal:</strong>{" "}
          <button type="button" onClick={() => go("/admin/login")} className="text-teal font-medium hover:underline">Sign in as staff</button>
        </div>

        <div className="rounded-lg border border-dashed border-teal/30 bg-teal/5 px-3 py-2 text-xs text-muted-foreground text-center">
          Need help? Contact support at +1 (800) 632-6275.
        </div>
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

export function AuthShell({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block lg:w-1/2 bg-ocean-gradient">{side}</div>
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md animate-fade-in">{children}</div>
      </div>
    </div>
  );
}
