"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Landmark,
  ArrowLeftRight,
  Activity,
  Headset,
  ShieldAlert,
  Megaphone,
  Bell,
  AlertTriangle,
  Banknote,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { services } from "@/lib/services";
import { MOCK_USERS, MOCK_ACCOUNTS, MOCK_AUDIT_LOGS } from "@/lib/mock";
import { useRouterStore } from "@/lib/router";
import {
  formatMoney,
  formatMoneyShort,
  formatDate,
  timeAgo,
  initials,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SectionCard } from "@/components/shared/SectionCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardStats = Awaited<ReturnType<typeof services.admin.dashboardStats>>["data"];

interface TopCustomer {
  id: string;
  user: User;
  accountCount: number;
  totalBalance: number;
}

const PIE_COLORS = ["oklch(0.62 0.13 195)", "oklch(0.68 0.13 180)", "oklch(0.45 0.10 195)", "oklch(0.30 0.08 220)"];

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  savings: "Savings",
  current: "Current",
  fixed_deposit: "Fixed Deposit",
  domiciliary: "Domiciliary",
  joint: "Joint",
};

const TIER_BADGE: Record<User["tier"], string> = {
  standard: "bg-muted text-muted-foreground",
  premium: "bg-teal/15 text-teal",
  private: "bg-ocean/15 text-ocean",
};

export function AdminDashboard() {
  const go = useRouterStore((s) => s.go);
  const [stats, setStats] = useState<DashboardStats>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.dashboardStats();
      if (active && res.ok && res.data) {
        setStats(res.data);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Top customers computed from MOCK data, sorted by total balance.
  const topCustomers = useMemo<TopCustomer[]>(() => {
    return MOCK_USERS.map((user) => {
      const accs = MOCK_ACCOUNTS.filter((a) => a.userId === user.id);
      const totalBalance = accs.reduce((s, a) => s + a.balance, 0);
      return {
        id: user.id,
        user,
        accountCount: accs.length,
        totalBalance,
      };
    })
      .sort((a, b) => b.totalBalance - a.totalBalance)
      .slice(0, 5);
  }, []);

  const recentActivity = useMemo(() => MOCK_AUDIT_LOGS.slice(0, 5), []);

  // Chart data
  const netVolumeData = useMemo(
    () =>
      (stats?.netVolume7d ?? []).map((d) => ({
        date: formatDate(d.date, "EEE"),
        volume: d.volume,
        txns: d.txns,
      })),
    [stats]
  );
  const customerGrowthData = useMemo(
    () =>
      (stats?.customerGrowth ?? []).map((d) => ({
        date: formatDate(d.date, "EEE"),
        count: d.count,
      })),
    [stats]
  );
  const accountDistributionData = useMemo(
    () =>
      (stats?.accountDistribution ?? []).map((d) => ({
        name: ACCOUNT_TYPE_LABELS[d.type] || d.type,
        value: d.count,
        total: d.value,
      })),
    [stats]
  );

  const totalAccountsValue = accountDistributionData.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Operations Dashboard"
        description="Real-time view of bank activity."
        actions={
          <div className="hidden items-center gap-2 sm:flex">
            <Badge variant="outline" className="gap-1.5 border-teal/40 text-teal">
              <span className="size-1.5 rounded-full bg-teal animate-pulse" />
              Live data
            </Badge>
            <Button size="sm" variant="outline" onClick={() => go("/admin/analytics")}>
              View analytics
            </Button>
          </div>
        }
      />

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading || !stats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Customers"
              value={stats.totalCustomers}
              icon={Users}
              accent="teal"
              trend={{ value: `${stats.newSignups7d} this week`, direction: "up", positive: true }}
            />
            <StatCard
              label="Active Accounts"
              value={stats.activeAccounts}
              icon={Landmark}
              accent="turquoise"
              trend={{ value: "across all customers", direction: "up", positive: true }}
            />
            <StatCard
              label="Transaction Volume"
              value={formatMoneyShort(stats.transactionVolume, "USD")}
              icon={Activity}
              accent="ocean"
              trend={{ value: `${stats.totalTransactions} txns total`, direction: "up", positive: true }}
            />
            <StatCard
              label="Total Transactions"
              value={stats.totalTransactions}
              icon={ArrowLeftRight}
              accent="teal"
              footer="settled + pending"
            />
            <StatCard
              label="Open Tickets"
              value={stats.openTickets}
              icon={Headset}
              accent="turquoise"
              footer="awaiting agent / customer"
            />
            <StatCard
              label="Open Risk Cases"
              value={stats.openRiskCases}
              icon={ShieldAlert}
              accent="ocean"
              footer="needs review"
            />
          </>
        )}
      </div>

      {/* Charts row 1 — net volume + customer growth */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Net transaction volume"
          description="Last 7 days"
          icon={Activity}
          action={
            <Badge variant="secondary" className="bg-teal/10 text-teal">
              7d
            </Badge>
          }
        >
          {loading || !stats ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={netVolumeData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="netVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.62 0.13 195)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="oklch(0.62 0.13 195)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.01 220)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "oklch(0.55 0.02 220)" }}
                />
                <YAxis
                  tickFormatter={(v: number) => formatMoneyShort(v, "USD")}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tick={{ fontSize: 11, fill: "oklch(0.55 0.02 220)" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid oklch(0.92 0.01 220)",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [formatMoney(value, "USD"), "Volume"]}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="oklch(0.52 0.12 195)"
                  strokeWidth={2.5}
                  fill="url(#netVol)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard
          title="Customer growth"
          description="Active customers — last 7 days"
          icon={Users}
          action={
            <Badge variant="secondary" className="bg-turquoise/15 text-[oklch(0.45_0.13_180)]">
              7d
            </Badge>
          }
        >
          {loading || !stats ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={customerGrowthData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.01 220)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "oklch(0.55 0.02 220)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fontSize: 11, fill: "oklch(0.55 0.02 220)" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid oklch(0.92 0.01 220)",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [value, "Customers"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="oklch(0.68 0.13 180)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "oklch(0.68 0.13 180)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Charts row 2 — account distribution + top customers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Account distribution"
          description="By product type"
          icon={Landmark}
          className="lg:col-span-1"
        >
          {loading || !stats ? (
            <Skeleton className="h-56 w-full rounded-lg" />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={accountDistributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="oklch(1 0 0)"
                    strokeWidth={2}
                  >
                    {accountDistributionData.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid oklch(0.92 0.01 220)",
                      fontSize: 12,
                    }}
                    content={<AccountDistributionTooltip />}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-2">
                {accountDistributionData.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 rounded-sm"
                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                    />
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="font-medium tabular-nums">{d.value}</span>
                  </div>
                ))}
                <div className="border-t pt-2 text-xs text-muted-foreground">
                  Total value {formatMoneyShort(totalAccountsValue, "USD")}
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Top customers"
          description="Ranked by total balance"
          icon={Users}
          action={
            <Button size="sm" variant="ghost" onClick={() => go("/admin/customers")}>
              View all <ArrowRight className="size-3.5 ml-1" />
            </Button>
          }
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          <TopCustomersTable rows={topCustomers} loading={loading} onOpen={(id) => go(`/admin/customers/${id}`)} />
        </SectionCard>
      </div>

      {/* Recent activity */}
      <SectionCard
        title="Recent activity"
        description="Latest audit log entries"
        icon={Activity}
        action={
          <Button size="sm" variant="ghost" onClick={() => go("/admin/audit")}>
            View audit <ArrowRight className="size-3.5 ml-1" />
          </Button>
        }
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <ul className="space-y-1">
            {recentActivity.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
              >
                <Avatar className="size-9 ring-1 ring-border/60 mt-0.5">
                  <AvatarFallback
                    className={cn(
                      "text-[11px] font-semibold",
                      entry.actorType === "system"
                        ? "bg-muted text-muted-foreground"
                        : "bg-teal/15 text-teal"
                    )}
                  >
                    {entry.actorType === "system" ? "SE" : actorInitials(entry.actorName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{entry.actorName}</span>{" "}
                    <span className="text-muted-foreground">— {entry.action}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 capitalize">
                      {entry.resource.replace(/_/g, " ")}
                    </Badge>
                    <span>{timeAgo(entry.createdAt)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          icon={Banknote}
          title="Credit account"
          desc="Credit a customer's account via secure ledger."
          onClick={() => go("/admin/credit-account")}
          accent="teal"
        />
        <QuickAction
          icon={Bell}
          title="Broadcast notification"
          desc="Send a real-time message to all customers."
          onClick={() => go("/admin/notifications")}
          accent="teal"
        />
        <QuickAction
          icon={Megaphone}
          title="New campaign"
          desc="Create a marketing campaign or offer."
          onClick={() => go("/admin/campaigns")}
          accent="turquoise"
        />
        <QuickAction
          icon={AlertTriangle}
          title="Review risk cases"
          desc="Investigate flagged transactions."
          onClick={() => go("/admin/risk")}
          accent="ocean"
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Subcomponents
// ----------------------------------------------------------------------------

interface TopCustomerRow {
  id: string;
  user: User;
  accountCount: number;
  totalBalance: number;
}

function TopCustomersTable({
  rows,
  loading,
  onOpen,
}: {
  rows: TopCustomerRow[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const columns: Column<TopCustomerRow>[] = [
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-teal/15 text-teal text-[11px] font-semibold">
              {initials(row.user.firstName, row.user.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.user.firstName} {row.user.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      render: (row) => (
        <Badge className={cn("capitalize text-[10px]", TIER_BADGE[row.user.tier])}>
          {row.user.tier}
        </Badge>
      ),
    },
    {
      key: "accounts",
      header: "Accounts",
      className: "hidden sm:table-cell",
      render: (row) => <span className="tabular-nums">{row.accountCount}</span>,
    },
    {
      key: "balance",
      header: "Total Balance",
      className: "text-right",
      render: (row) => (
        <span className="font-semibold tabular-nums text-foreground">
          {formatMoney(row.totalBalance, "USD")}
        </span>
      ),
    },
  ];

  return (
    <DataTable<TopCustomerRow>
      columns={columns}
      rows={rows}
      loading={loading}
      emptyTitle="No customers yet"
      emptyDescription="Customers will appear here once they sign up."
      onRowClick={(row) => onOpen(row.id)}
    />
  );
}

function QuickAction({
  icon: Icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  onClick: () => void;
  accent: "teal" | "ocean" | "turquoise";
}) {
  const accentMap = {
    teal: "bg-teal/10 text-teal group-hover:bg-teal group-hover:text-white",
    ocean: "bg-ocean/15 text-ocean group-hover:bg-ocean group-hover:text-white",
    turquoise:
      "bg-turquoise/20 text-[oklch(0.45_0.13_180)] group-hover:bg-turquoise group-hover:text-white",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:border-teal/40 hover:shadow-md"
    >
      <div
        className={cn(
          "grid place-items-center rounded-lg size-10 transition-colors",
          accentMap[accent]
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-teal" />
    </button>
  );
}

function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() || "—";
}

// ----------------------------------------------------------------------------
// Custom tooltip for the account distribution pie chart
// ----------------------------------------------------------------------------
interface DistributionPayloadRow {
  name: string;
  value: number;
  total: number;
}

function AccountDistributionTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as DistributionPayloadRow | undefined;
  if (!row) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{row.name}</p>
      <p className="mt-0.5 text-muted-foreground">
        {row.value} account{row.value === 1 ? "" : "s"} ·{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatMoney(row.total, "USD")}
        </span>
      </p>
    </div>
  );
}
