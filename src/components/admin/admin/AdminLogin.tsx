"use client";
import { useState } from "react";
import { Shield, Eye, EyeOff, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { services } from "@/lib/services";
import { MOCK_ADMIN_USERS } from "@/lib/mock";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export function AdminLogin() {
  const go = useRouterStore((s) => s.go);
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const setAdminToken = useAuthStore((s) => s.setAdminToken);

  const [email, setEmail] = useState("daniel.okoro@oceansky.bank");
  const [password, setPassword] = useState("admin123");
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
      const res = await services.auth.adminLogin(email, password);
      if (!res.ok || !res.data) {
        toast({ title: res.error || "Sign in failed", variant: "destructive" });
        setLoading(false);
        return;
      }
      const admin = MOCK_ADMIN_USERS.find((a) => a.id === res.data!.adminId);
      if (!admin) {
        toast({ title: "Admin profile not found", variant: "destructive" });
        setLoading(false);
        return;
      }
      setAdmin(admin);
      setAdminToken(res.data.token);
      toast({
        title: `Welcome back, ${admin.firstName}`,
        description: "Signed in to OceanSky Operations Portal.",
      });
      go("/admin/dashboard");
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen w-full bg-ocean-gradient flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative blurred orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-teal/20 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <Logo variant="light" size="lg" />
        </div>

        <Card className="border-white/10 bg-white/95 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="grid place-items-center size-9 rounded-lg bg-teal/15 text-teal">
                <Shield className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Staff Sign In</h1>
                <p className="text-xs text-muted-foreground">OceanSky Bank Operations Portal</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email">Staff email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="firstname.lastname@oceansky.bank"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="admin-remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(Boolean(v))}
                />
                <Label htmlFor="admin-remember" className="text-sm font-normal cursor-pointer">
                  Remember this device
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  "Signing in…"
                ) : (
                  <>
                    Sign in to portal <ArrowRight className="size-4 ml-1" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-0">
            <div className="w-full rounded-lg border border-dashed border-teal/40 bg-teal/5 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Info className="size-3.5 text-teal" /> Sign-in credentials
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                daniel.okoro@oceansky.bank · admin123
              </p>
            </div>
            <button
              type="button"
              onClick={() => go("/login")}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Back to customer sign in
            </button>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-xs text-white/60">
          © OceanSky Bank. Authorised staff access only. All actions are logged.
        </p>
      </div>
    </div>
  );
}
