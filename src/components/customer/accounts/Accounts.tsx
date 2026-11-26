"use client";

// ============================================================================
// OceanSky Bank — Accounts (customer)
// ----------------------------------------------------------------------------
// Shows all accounts for the logged-in customer with summary stats, type
// filters, and per-account action shortcuts. "Open new account" opens a Sheet
// with a mock request form.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Coins,
  DollarSign,
  Landmark,
  PiggyBank,
  Plus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { formatMoneyDisplay, maskAccountNumber } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type { Account, AccountType } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { BalanceDisplay } from "@/components/shared/BalanceDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ----------------------------------------------------------------------------
// Account type → icon + label + soft badge styling (teal/turquoise family)
// ----------------------------------------------------------------------------
interface TypeMeta {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

const TYPE_META: Record<AccountType, TypeMeta> = {
  savings: {
    label: "Savings",
    icon: PiggyBank,
    badgeClass: "bg-teal/10 text-teal border-teal/25",
  },
  current: {
    label: "Current",
    icon: Landmark,
    badgeClass: "bg-ocean/10 text-ocean border-ocean/25",
  },
  domiciliary: {
    label: "Domiciliary",
    icon: DollarSign,
    badgeClass: "bg-turquoise/15 text-teal-dark border-turquoise/30",
  },
  fixed_deposit: {
    label: "Fixed Deposit",
    icon: Coins,
    badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  },
  joint: {
    label: "Joint",
    icon: Users,
    badgeClass: "bg-secondary text-secondary-foreground border-border",
  },
};

const TAB_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
  { value: "domiciliary", label: "Domiciliary" },
];

// ----------------------------------------------------------------------------
// Open-account sheet form state
// ----------------------------------------------------------------------------
interface NewAccountForm {
  type: AccountType;
  currency: string;
  initialDeposit: string;
}

const INITIAL_FORM: NewAccountForm = {
  type: "savings",
  currency: "USD",
  initialDeposit: "",
};

// ----------------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------------
export function Accounts() {
  const user = useAuthStore((s) => s.user);
  const go = useRouterStore((s) => s.go);

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<string>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<NewAccountForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await services.account.listByUser(user.id);
      if (cancelled) return;
      if (res.ok && res.data) {
        setAccounts(res.data);
      } else {
        toast({
          title: "Failed to load accounts",
          description: res.error,
          variant: "destructive",
        });
        setAccounts([]);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // --- Summary stats ---
  const summary = useMemo(() => {
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const totalAvailable = accounts.reduce((s, a) => s + a.availableBalance, 0);
    const primaryCurrency = accounts[0]?.currency ?? "USD";
    return {
      totalBalance,
      totalAvailable,
      count: accounts.length,
      currency: primaryCurrency,
    };
  }, [accounts]);

  // --- Filtered accounts for the active tab ---
  const filtered = useMemo(() => {
    if (tab === "all") return accounts;
    return accounts.filter((a) => a.accountType === (tab as AccountType));
  }, [accounts, tab]);

  function handleOpenAccountSubmit() {
    setSubmitting(true);
    // Mock-only: simulate a brief request, then notify the user.
    setTimeout(() => {
      setSubmitting(false);
      setSheetOpen(false);
      setForm(INITIAL_FORM);
      toast({
        title: "Account opening request received",
        description: "We'll be in touch within 1-2 business days.",
      });
    }, 600);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="All your OceanSky accounts in one place."
        actions={
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button className="bg-teal text-white hover:bg-teal/90">
                <Plus className="size-4" />
                Open new account
              </Button>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Open a new account</SheetTitle>
                <SheetDescription>
                  Choose an account type, currency and an optional initial deposit.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto px-4">
                <div className="space-y-2">
                  <Label htmlFor="new-acct-type">Account type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, type: v as AccountType }))
                    }
                  >
                    <SelectTrigger id="new-acct-type" className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="domiciliary">Domiciliary</SelectItem>
                      <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-acct-currency">Currency</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                  >
                    <SelectTrigger id="new-acct-currency" className="w-full">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-acct-deposit">Initial deposit (optional)</Label>
                  <Input
                    id="new-acct-deposit"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.initialDeposit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, initialDeposit: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    You can fund this account later if you prefer.
                  </p>
                </div>
              </div>

              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Cancel</Button>
                </SheetClose>
                <Button
                  onClick={handleOpenAccountSubmit}
                  disabled={submitting}
                  className="bg-teal text-white hover:bg-teal/90"
                >
                  {submitting ? "Submitting…" : "Submit request"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Balance"
          value={formatMoneyDisplay(summary.totalBalance, summary.currency)}
          icon={Wallet}
          accent="teal"
        />
        <StatCard
          label="Total Available"
          value={formatMoneyDisplay(summary.totalAvailable, summary.currency)}
          icon={Activity}
          accent="turquoise"
        />
        <StatCard
          label="Accounts"
          value={summary.count}
          icon={PiggyBank}
          accent="ocean"
          footer="Across all currencies"
        />
      </div>

      {/* Type filter tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          {TAB_FILTERS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-1 sm:flex-none">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 animate-pulse rounded-xl bg-muted/60"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No accounts in this category"
              description="Try a different filter or open a new account to get started."
              icon={Wallet}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onView={() => go(`/accounts/${account.id}`)}
                  onStatement={() => go("/statements")}
                  onTransfer={() => go("/transfers")}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ----------------------------------------------------------------------------
// AccountCard — single account summary with action shortcuts
// ----------------------------------------------------------------------------
function AccountCard({
  account,
  onView,
  onStatement,
  onTransfer,
}: {
  account: Account;
  onView: () => void;
  onStatement: () => void;
  onTransfer: () => void;
}) {
  const meta = TYPE_META[account.accountType] ?? TYPE_META.savings;
  const Icon = meta.icon;
  const displayName = account.nickname?.trim() || meta.label;

  return (
    <Card className="relative overflow-hidden border-border/60 transition-shadow hover:shadow-md">
      <CardContent className="space-y-4 p-5">
        {/* Top row: nickname + type badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid size-9 place-items-center rounded-lg bg-teal/10 text-teal">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{displayName}</p>
              <p className="text-xs text-muted-foreground">{account.currency}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("shrink-0", meta.badgeClass)}>
            {meta.label}
          </Badge>
        </div>

        {/* Balance */}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Current balance
          </p>
          <BalanceDisplay
            amount={account.balance}
            sourceCurrency={account.currency}
            size="lg"
          />
          {account.balance !== account.availableBalance && (
            <p className="text-xs text-muted-foreground">
              Available: {formatMoneyDisplay(account.availableBalance, account.currency)}
            </p>
          )}
        </div>

        {/* Account number + interest */}
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-mono tracking-wider text-muted-foreground">
            {maskAccountNumber(account.accountNumber)}
          </span>
          {typeof account.interestRatePct === "number" && (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {account.interestRatePct.toFixed(2)}% p.a.
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button size="sm" variant="default" onClick={onView} className="bg-teal text-white hover:bg-teal/90">
            <Activity className="size-3.5" />
            Activity
          </Button>
          <Button size="sm" variant="outline" onClick={onStatement}>
            Statement
          </Button>
          <Button size="sm" variant="outline" onClick={onTransfer}>
            <ArrowRight className="size-3.5" />
            Transfer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
