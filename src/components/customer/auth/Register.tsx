"use client";
import { useState } from "react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { services } from "@/lib/services";
import { AuthShell } from "@/components/customer/auth/Login";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Wallet,
  Headset,
  UserPlus,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

export function Register() {
  const go = useRouterStore((s) => s.go);
  const setUser = useAuthStore((s) => s.setUser);
  const setPendingChallenge = useAuthStore((s) => s.setPendingChallenge);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+1");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!firstName.trim()) e.firstName = "First name is required.";
    if (!lastName.trim()) e.lastName = "Last name is required.";
    if (!email.trim()) {
      e.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(email.trim())) {
      e.email = "Enter a valid email address.";
    }
    const digits = phone.replace(/\D/g, "");
    if (!phone.trim()) {
      e.phone = "Phone number is required.";
    } else if (digits.length < 8) {
      e.phone = "Phone number must contain at least 8 digits.";
    }
    if (!password) {
      e.password = "Password is required.";
    } else if (password.length < 8) {
      e.password = "Password must be at least 8 characters.";
    } else if (!/\d/.test(password)) {
      e.password = "Password must include at least one number.";
    }
    if (!confirmPassword) {
      e.confirmPassword = "Please confirm your password.";
    } else if (confirmPassword !== password) {
      e.confirmPassword = "Passwords do not match.";
    }
    return e;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const eMap = validate();
    setErrors(eMap);
    if (Object.keys(eMap).length > 0) {
      toast({
        title: "Please fix the highlighted fields",
        description: "Some entries are missing or invalid.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await services.auth.register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      if (!res.ok || !res.data) {
        toast({ title: res.error || "Registration failed", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Fetch the newly created user record so the store holds real data.
      const userRes = await services.user.getById(res.data.userId);
      if (userRes.ok && userRes.data) {
        setUser(userRes.data);
      } else {
        // Fallback: a lightweight placeholder if the lookup fails.
        setUser({
          id: res.data.userId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          status: "pending",
          tier: "standard",
          createdAt: new Date().toISOString(),
          kycVerified: false,
          nationality: "American",
        });
      }

      setPendingChallenge({
        userId: res.data.userId,
        otpChallengeId: res.data.otpChallengeId,
        otpCode: res.data.otpCode,
        destination: res.data.otpDestination,
      });

      toast({
        title: "Account created — verify your email",
        description: `A 6-digit code was sent to ${res.data.otpDestination}.`,
      });
      go("/otp");
    } catch (err) {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    }
    setLoading(false);
  }

  function clearError(field: keyof FieldErrors) {
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  }

  return (
    <AuthShell
      side={
        <div className="hidden lg:flex flex-col justify-between h-full p-10 text-white">
          <Logo variant="light" size="lg" />
          <div className="space-y-8">
            <h2 className="text-3xl font-bold leading-tight">
              Open your OceanSky<br />account in minutes.
            </h2>
            <div className="space-y-4">
              <Feature icon={Wallet} title="No paperwork" desc="Sign up online — your starter account is created instantly." />
              <Feature icon={ShieldCheck} title="Verified by OTP" desc="We confirm your email with a one-time code before you can transact." />
              <Feature icon={Headset} title="Human support" desc="Our team is on standby to walk you through your first transfer." />
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
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Join OceanSky Bank and start banking in minutes.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              id="firstName"
              label="First name"
              value={firstName}
              onChange={(v) => { setFirstName(v); clearError("firstName"); }}
              placeholder="Olivia"
              error={errors.firstName}
              autoComplete="given-name"
            />
            <Field
              id="lastName"
              label="Last name"
              value={lastName}
              onChange={(v) => { setLastName(v); clearError("lastName"); }}
              placeholder="Bennett"
              error={errors.lastName}
              autoComplete="family-name"
            />
          </div>

          <Field
            id="email"
            type="email"
            label="Email address"
            value={email}
            onChange={(v) => { setEmail(v); clearError("email"); }}
            placeholder="you@example.com"
            error={errors.email}
            autoComplete="email"
          />

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); clearError("phone"); }}
              placeholder="+1 (555) 123-4567"
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={!!errors.phone}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                placeholder="At least 8 characters, 1 number"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
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
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            <p className="text-xs text-muted-foreground">
              Use 8+ characters with at least one number.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type={show ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearError("confirmPassword"); }}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
            />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              "Creating your account…"
            ) : (
              <>
                <UserPlus className="size-4 mr-1" /> Create account <ArrowRight className="size-4 ml-1" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => go("/login")}
            className="text-teal font-medium hover:underline"
          >
            Sign in
          </button>
        </div>

        <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <p>
            By creating an account, you agree to OceanSky Bank&apos;s terms of service and privacy policy.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
}) {
  const { id, label, value, onChange, type = "text", placeholder, error, autoComplete } = props;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
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
