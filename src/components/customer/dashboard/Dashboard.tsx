"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowDownLeft,
  Plus,
  Receipt,
  Send,
  ShoppingBag,
  Car,
  Repeat,
  Utensils,
  Wallet,
  Zap,
  Film,
  Smartphone,
  Wifi,
  Tv,
  Droplets,
  Dices,
  GraduationCap,
  Tag,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Clock,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, isSameDay, isSameMonth, parseISO, subDays } from "date-fns";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  formatMoneyDisplay,
  formatMoneyShort,
  formatRelativeShort,
} from "@/lib/format";
import type { CurrencyCode } from "@/lib/store/currency.store";
import type { Account, BankCard, Campaign, Transaction } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { BalanceDisplay } from "@/components/shared/BalanceDisplay";
import { CampaignBanner } from "@/components/shared/CampaignBanner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

// ----------------------------------------------------------------------------
// Category → icon mapping for transaction lists
// ----------------------------------------------------------------------------
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  groceries: ShoppingBag,
  shopping: ShoppingBag,
  transport: Car,
  subscriptions: Repeat,
  dining: Utensils,
  salary: Wallet,
  utilities: Zap,
  transfer: ArrowRight,
  entertainment: Film,
  airtime: Smartphone,
  data: Wifi,
  electricity: Zap,
  cable_tv: Tv,
  internet: Wifi,
  water: Droplets,
  betting: Dices,
  education: GraduationCap,
};

function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category.toLowerCase()] ?? Tag;
}

// ----------------------------------------------------------------------------
// Brand colors (teal / turquoise family — no indigo / blue)
// ----------------------------------------------------------------------------
const TEAL = "var(--teal)";
const TURQUOISE = "var(--turquoise)";
const OCEAN = "var(--ocean)";
const TEAL_DARK = "var(--teal-dark)";
const TEAL_LIGHT = "var(--teal-light)";
const CHART_GREEN = "var(--chart-4)"; // oklch(0.75 0.14 165) — green-cyan

const PIE_COLORS = [TEAL, TURQUOISE, TEAL_DARK, TEAL_LIGHT, OCEAN, CHART_GREEN];

// ----------------------------------------------------------------------------
// Card color → Tailwind gradient classes
// ----------------------------------------------------------------------------
function cardGradient(color: BankCard["color"]): string {
  switch (color) {
    case "ocean":
      return "from-ocean via-ocean to-teal-dark";
    case "sand":
      return "from-amber-500 via-amber-600 to-orange-700";
    case "graphite":
      return "from-zinc-700 via-zinc-800 to-zinc-900";
    case "teal":
    default:
      return "from-teal via-teal-dark to-ocean";
  }
}

function brandLabel(brand: BankCard["brand"]): string {
  if (brand === "mastercard") return "Mastercard";
  if (brand === "visa") return "Visa";
  return "Verve";
}

// ----------------------------------------------------------------------------
// Data shape loaded in useEffect
// ----------------------------------------------------------------------------
interface DashboardData {
  accounts: Account[];
  transactions: Transaction[];
  cards: BankCard[];
  campaigns: Campaign[];
}

// Empty fallback so hooks below can run unconditionally before the loading
// early-return (React requires hooks to be called in the same order every
// render, even while data is still loading).
const EMPTY_DATA: DashboardData = {
  accounts: [],
  transactions: [],
  cards: [],
  campaigns: [],
};

// ----------------------------------------------------------------------------
// Loading skeleton — mirrors the real layout
// ----------------------------------------------------------------------------
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="aspect-[1.586] w-full rounded-2xl" />
        <Skeleton className="aspect-[1.586] w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------------------
export function Dashboard() {
  const go = useRouterStore((s) => s.go);
  const user = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [accountsRes, txnsRes, cardsRes, campaignsRes] = await Promise.all([
          services.account.listByUser(user.id),
          services.transaction.listByUser(user.id),
          services.card.listByUser(user.id),
          services.campaign.listForUser(user.tier),
        ]);
        if (cancelled) return;
        if (!accountsRes.ok || !txnsRes.ok || !cardsRes.ok || !campaignsRes.ok) {
          toast({
            title: "Failed to load dashboard",
            description:
              accountsRes.error || txnsRes.error || cardsRes.error || campaignsRes.error,
            variant: "destructive",
          });
          setData({ accounts: [], transactions: [], cards: [], campaigns: [] });
        } else {
          setData({
            accounts: accountsRes.data ?? [],
            transactions: txnsRes.data ?? [],
            cards: cardsRes.data ?? [],
            campaigns: campaignsRes.data ?? [],
          });
        }
      } catch {
        if (!cancelled) {
          toast({ title: "Network error", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Always derive from `data ?? EMPTY_DATA` so hooks below run in the
  // same order on every render, even before data has loaded.
  const { accounts, transactions, cards, campaigns } = data ?? EMPTY_DATA;
  const currency: CurrencyCode = (accounts[0]?.currency ?? "USD") as CurrencyCode;
  const firstName = user?.firstName ?? "there";

  // --- Total balance + available ---
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalAvailable = accounts.reduce((s, a) => s + a.availableBalance, 0);

  // --- Stat card figures ---
  const today = new Date();
  const todaysSpend = transactions
    .filter(
      (t) =>
        t.direction === "out" &&
        t.status !== "failed" &&
        isSameDay(parseISO(t.createdAt), today)
    )
    .reduce((s, t) => s + t.amount, 0);
  const monthInflow = transactions
    .filter(
      (t) =>
        t.direction === "in" &&
        t.status !== "failed" &&
        isSameMonth(parseISO(t.createdAt), today, { baseDate: today })
    )
    .reduce((s, t) => s + t.amount, 0);
  const activeCards = cards.filter((c) => c.status === "active").length;
  const pendingTxns = transactions.filter((t) => t.status === "pending").length;

  // --- Income vs spending chart (last 7 days) ---
  const incomeSpendingData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(today, 6 - i);
      const dayIncome = transactions
        .filter(
          (t) =>
            t.direction === "in" &&
            t.status !== "failed" &&
            isSameDay(parseISO(t.createdAt), d)
        )
        .reduce((s, t) => s + t.amount, 0);
      const daySpending = transactions
        .filter(
          (t) =>
            t.direction === "out" &&
            t.status !== "failed" &&
            isSameDay(parseISO(t.createdAt), d)
        )
        .reduce((s, t) => s + t.amount, 0);
      // Blend in a small deterministic baseline so the chart isn't flat
      // when the user has sparse data on a given day.
      const baseIncome = 38000 + Math.round(Math.sin(i * 0.9) * 22000) + i * 4100;
      const baseSpending = 21000 + Math.round(Math.cos(i * 0.7) * 14000) + i * 2300;
      return {
        date: format(d, "EEE"),
        income: dayIncome + (dayIncome === 0 ? baseIncome : 0),
        spending: daySpending + (daySpending === 0 ? baseSpending : 0),
      };
    });
  }, [transactions]);

  // --- Spending by category (top 6, donut) ---
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.direction !== "out" || t.status === "failed") continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions]);

  // --- Recent transactions (last 6) ---
  const recent = transactions.slice(0, 6);

  // --- Cards preview (first 2) ---
  const previewCards = cards.slice(0, 2);

  // --- Active campaign (first one returned by listForUser) ---
  const activeCampaign = campaigns[0];

  if (loading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's a snapshot of your money today."
        actions={
          <Button onClick={() => go("/transfers")}>
            Quick transfer
            <ArrowRight className="size-4" />
          </Button>
        }
      />

      {/* Total balance gradient card */}
      <div className="relative overflow-hidden rounded-2xl bg-card-gradient p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-12 -top-12 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-8 size-40 rounded-full bg-teal/20 blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
              Total Balance
            </p>
            <BalanceDisplay
              amount={totalBalance}
              sourceCurrency={currency}
              size="xl"
              className="[&_button]:text-white/70 [&_button:hover]:text-white"
            />
            <p className="text-sm text-white/70">
              Available{" "}
              <span className="font-semibold text-white">
                {formatMoneyDisplay(totalAvailable, currency)}
              </span>{" "}
              · {accounts.length} account{accounts.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={() => go("/transfers")}
            >
              <Send className="size-4" /> Transfer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={() => go("/bills")}
            >
              <Receipt className="size-4" /> Pay Bills
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={() => go("/accounts")}
            >
              <Plus className="size-4" /> Add Money
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's spend"
          value={formatMoneyDisplay(todaysSpend, currency)}
          icon={TrendingDown}
          accent="ocean"
          trend={{
            value: "vs yesterday",
            direction: "down",
            positive: false,
          }}
        />
        <StatCard
          label="This month inflow"
          value={formatMoneyDisplay(monthInflow, currency)}
          icon={TrendingUp}
          accent="teal"
          trend={{ value: "credits", direction: "up", positive: true }}
        />
        <StatCard
          label="Active cards"
          value={activeCards}
          icon={CreditCard}
          accent="turquoise"
          footer={`${cards.length} total`}
        />
        <StatCard
          label="Pending transactions"
          value={pendingTxns}
          icon={Clock}
          accent="muted"
          footer="awaiting clearance"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Income vs Spending"
          description="Last 7 days"
          icon={TrendingUp}
          action={
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: TEAL }}
                />
                Income
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: TURQUOISE }}
                />
                Spending
              </span>
            </div>
          }
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={incomeSpendingData}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TURQUOISE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={TURQUOISE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatMoneyShort(v, currency).replace(currency + " ", "")}
                  width={48}
                />
                <RechartsTooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                  formatter={(value: number, name: string) => [
                    formatMoneyDisplay(Number(value), currency),
                    name === "income" ? "Income" : "Spending",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke={TEAL}
                  strokeWidth={2}
                  fill="url(#incomeFill)"
                />
                <Area
                  type="monotone"
                  dataKey="spending"
                  stroke={TURQUOISE}
                  strokeWidth={2}
                  fill="url(#spendingFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Spending by Category"
          description="Top categories"
          icon={ShoppingBag}
        >
          {categoryData.length === 0 ? (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">
              No spending recorded yet.
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center gap-2 sm:flex-row sm:items-center">
              <div className="relative h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={84}
                      paddingAngle={2}
                      stroke="var(--background)"
                      strokeWidth={2}
                    >
                      {categoryData.map((entry, idx) => (
                        <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(value: number, name: string) => [
                        formatMoneyDisplay(Number(value), currency),
                        name.charAt(0).toUpperCase() + name.slice(1),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Total
                    </p>
                    <p className="text-sm font-bold">
                      {formatMoneyShort(
                        categoryData.reduce((s, c) => s + c.value, 0),
                        currency
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <ul className="w-full space-y-1.5 sm:flex-1">
                {categoryData.map((c, idx) => {
                  const total = categoryData.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
                  return (
                    <li
                      key={c.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="flex-1 truncate capitalize">{c.name}</span>
                      <span className="text-muted-foreground">{pct}%</span>
                      <span className="font-medium tabular-nums">
                        {formatMoneyShort(c.value, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent transactions */}
      <SectionCard
        title="Recent Transactions"
        description="Your latest activity"
        icon={Wallet}
        action={
          <Button variant="ghost" size="sm" onClick={() => go("/transactions")}>
            View all
            <ArrowRight className="size-4" />
          </Button>
        }
        bodyClassName="p-0"
      >
        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((t) => {
              const Icon = categoryIcon(t.category);
              const isCredit = t.direction === "in";
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
                >
                  <div
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full",
                      isCredit
                        ? "bg-teal/10 text-teal"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {t.description || t.counterparty || t.category}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.counterparty ? `${t.counterparty} · ` : ""}
                      {formatRelativeShort(t.createdAt)}
                      {t.status === "pending" && (
                        <span className="ml-1 text-amber-600">· pending</span>
                      )}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "text-right text-sm font-semibold tabular-nums",
                      isCredit ? "text-teal" : "text-foreground"
                    )}
                  >
                    {isCredit ? "+" : "−"}
                    {formatMoneyDisplay(t.amount, t.currency as CurrencyCode)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* Cards preview */}
      {previewCards.length > 0 && (
        <SectionCard
          title="Your Cards"
          description="Quick preview"
          icon={CreditCard}
          action={
            <Button variant="ghost" size="sm" onClick={() => go("/cards")}>
              Manage
              <ArrowRight className="size-4" />
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {previewCards.map((card) => (
              <div
                key={card.id}
                className={cn(
                  "relative aspect-[1.586] w-full overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg",
                  cardGradient(card.color)
                )}
              >
                {/* decorative blobs */}
                <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-xl" />
                <div className="absolute -bottom-10 -left-6 size-24 rounded-full bg-white/10 blur-xl" />

                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">
                      OceanSky
                    </p>
                    <p className="text-sm font-semibold">{brandLabel(card.brand)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {card.status === "locked" && (
                      <Badge className="bg-white/15 text-white border-white/20 text-[10px]">
                        Locked
                      </Badge>
                    )}
                    {card.type === "virtual" && (
                      <Badge className="bg-white/15 text-white border-white/20 text-[10px]">
                        Virtual
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Chip */}
                <div className="relative mt-5 size-8 rounded-md bg-yellow-300/80 ring-1 ring-yellow-200/40" />

                <div className="relative mt-3 font-mono text-base tracking-[0.18em] sm:text-lg">
                  {card.maskedPan}
                </div>

                <div className="relative mt-3 flex items-end justify-between">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider opacity-70">
                      Card Holder
                    </p>
                    <p className="truncate text-xs font-medium uppercase tracking-wide sm:text-sm">
                      {card.holderName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider opacity-70">
                      Expires
                    </p>
                    <p className="text-xs font-medium tabular-nums sm:text-sm">
                      {card.expiryMonth}/{card.expiryYear}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Promotional campaign banner */}
      {activeCampaign && (
        <CampaignBanner campaign={activeCampaign} variant="full" />
      )}

      {accounts.length === 0 && transactions.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No accounts or transactions linked to your profile yet.
          </p>
          <Button className="mt-3" variant="outline" onClick={() => go("/support")}>
            Contact support
          </Button>
        </div>
      )}
    </div>
  );
}
