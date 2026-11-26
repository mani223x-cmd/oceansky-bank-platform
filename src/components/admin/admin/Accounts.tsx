"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  Wallet,
  CheckCircle2,
  Snowflake,
  Search,
  Eye,
  ArrowLeftRight,
  UserRound,
} from "lucide-react";
import { services } from "@/lib/services";
import type { Account, Transaction } from "@/lib/types";
import { formatMoney, formatDate, formatDateTime, type CurrencyCode } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import {
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

type AccountRow = Account & { userName: string };

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
  { value: "fixed_deposit", label: "Fixed Deposit" },
  { value: "domiciliary", label: "Domiciliary" },
] as const;

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "frozen", label: "Frozen" },
  { value: "closed", label: "Closed" },
] as const;

const TYPE_LABELS: Record<Account["accountType"], string> = {
  savings: "Savings",
  current: "Current",
  fixed_deposit: "Fixed Deposit",
  domiciliary: "Domiciliary",
  joint: "Joint",
};

export function AdminAccounts() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<AccountRow | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.listAccounts();
      if (active && res.ok && res.data) setRows(res.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const totalBalance = rows.reduce((s, a) => s + a.balance, 0);
    const activeCount = rows.filter((r) => r.status === "active").length;
    const frozenCount = rows.filter(
      (r) => r.status === "frozen" || r.status === "closed"
    ).length;
    return { total, totalBalance, activeCount, frozenCount };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && r.accountType !== type) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.accountNumber.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q)
      );
    });
  }, [rows, search, type, status]);

  const columns: Column<AccountRow>[] = [
    {
      key: "number",
      header: "Account Number",
      render: (a) => <span className="font-mono text-xs">{a.accountNumber}</span>,
    },
    {
      key: "type",
      header: "Type",
      className: "hidden sm:table-cell",
      render: (a) => (
        <Badge variant="outline" className="text-[10px]">
          {TYPE_LABELS[a.accountType]}
        </Badge>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (a) => (
        <span className="text-sm">{a.userName}</span>
      ),
    },
    {
      key: "currency",
      header: "Currency",
      className: "hidden md:table-cell",
      render: (a) => <span className="text-xs">{a.currency}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      render: (a) => (
        <span className="font-semibold tabular-nums">
          {formatMoney(a.balance, a.currency as CurrencyCode)}
        </span>
      ),
    },
    {
      key: "available",
      header: "Available",
      className: "hidden md:table-cell",
      render: (a) => (
        <span className="tabular-nums text-muted-foreground">
          {formatMoney(a.availableBalance, a.currency as CurrencyCode)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: "opened",
      header: "Opened",
      className: "hidden lg:table-cell",
      render: (a) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(a.openedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (a) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setSelected(a)}
          >
            <Eye className="size-3.5" /> View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Accounts"
        description="Every account across all OceanSky customers."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Accounts" value={stats.total} icon={Landmark} accent="teal" />
        <StatCard
          label="Total Balance"
          value={formatMoney(stats.totalBalance, "USD")}
          icon={Wallet}
          accent="turquoise"
        />
        <StatCard label="Active" value={stats.activeCount} icon={CheckCircle2} accent="teal" />
        <StatCard label="Frozen / Closed" value={stats.frozenCount} icon={Snowflake} accent="muted" />
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search account number or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={type} onValueChange={setType}>
              <TabsList className="overflow-x-auto">
                {TYPE_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Tabs value={status} onValueChange={setStatus}>
              <TabsList>
                {STATUS_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="p-2 sm:p-4">
          <DataTable<AccountRow>
            columns={columns}
            rows={filtered}
            loading={loading}
            emptyTitle="No accounts found"
            emptyDescription="Try adjusting your search or filters."
            emptyIcon={UserRound}
            onRowClick={(row) => setSelected(row)}
          />
        </div>
      </div>

      <AccountDetailSheet
        account={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Account detail sheet
// ----------------------------------------------------------------------------
function AccountDetailSheet({
  account,
  open,
  onClose,
}: {
  account: AccountRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  useEffect(() => {
    if (!account) return;
    let active = true;
    (async () => {
      setLoadingTxns(true);
      const res = await services.transaction.listByUser(account.userId, {
        accountId: account.id,
      });
      if (!active) return;
      setTxns(res.ok && res.data ? res.data.slice(0, 8) : []);
      setLoadingTxns(false);
    })();
    return () => {
      active = false;
    };
  }, [account]);

  if (!account) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Landmark className="size-4 text-teal" />
            {account.accountNumber}
          </SheetTitle>
          <SheetDescription>
            {account.userName} · {TYPE_LABELS[account.accountType]}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={account.status} />
            <Badge variant="outline" className="text-[10px]">
              {account.currency}
            </Badge>
          </div>

          <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
            <DetailRow label="Ledger Balance" value={formatMoney(account.balance, account.currency as CurrencyCode)} />
            <DetailRow label="Available Balance" value={formatMoney(account.availableBalance, account.currency as CurrencyCode)} />
            {account.interestRatePct !== undefined && (
              <DetailRow label="Interest Rate" value={`${account.interestRatePct}% p.a.`} />
            )}
            <DetailRow label="Opened" value={formatDate(account.openedAt)} />
            {account.nickname && (
              <DetailRow label="Nickname" value={account.nickname} />
            )}
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ArrowLeftRight className="size-3.5 text-teal" />
              Recent Transactions
            </h4>
            {loadingTxns ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : txns.length === 0 ? (
              <EmptyState
                title="No transactions"
                description="No transactions recorded for this account."
                icon={ArrowLeftRight}
                className="py-6"
              />
            ) : (
              <ul className="space-y-1">
                {txns.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{t.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(t.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span
                        className={
                          t.direction === "in"
                            ? "font-medium tabular-nums text-emerald-600"
                            : "font-medium tabular-nums text-foreground"
                        }
                      >
                        {t.direction === "in" ? "+" : "−"}
                        {formatMoney(Math.abs(t.amount), t.currency as CurrencyCode)}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              toast.info("Statement export started.")
            }
          >
            Export Statement
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
