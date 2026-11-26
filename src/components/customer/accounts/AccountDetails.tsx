"use client";

// ============================================================================
// OceanSky Bank — Account Details (customer)
// ----------------------------------------------------------------------------
// Reads `accountId` from the router params, then renders a hero summary card,
// quick actions, and tabs for Activity / Details / Statements.
// ============================================================================

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Landmark,
  PiggyBank,
  Receipt,
  Send,
  Coins,
  DollarSign,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useRouterStore } from "@/lib/router";
import {
  convertCurrency,
  formatDate,
  formatDateTime,
  formatMoneyDisplay,
  maskAccountNumber,
  useCurrencyStore,
  type CurrencyCode,
} from "@/lib/format";
import { useUIStore } from "@/lib/store/ui.store";
import { toast } from "@/hooks/use-toast";
import type {
  Account,
  AccountType,
  Transaction,
} from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { ReceiptModal, type ReceiptData } from "@/components/shared/ReceiptModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ----------------------------------------------------------------------------
// Account type metadata (kept local to avoid cross-file coupling)
// ----------------------------------------------------------------------------
const TYPE_META: Record<AccountType, { label: string; icon: LucideIcon }> = {
  savings: { label: "Savings", icon: PiggyBank },
  current: { label: "Current", icon: Landmark },
  domiciliary: { label: "Domiciliary", icon: DollarSign },
  fixed_deposit: { label: "Fixed Deposit", icon: Coins },
  joint: { label: "Joint", icon: Users },
};

// ----------------------------------------------------------------------------
// AccountDetails
// ----------------------------------------------------------------------------
export function AccountDetails() {
  const accountId = useRouterStore((s) => s.params[0]);
  const go = useRouterStore((s) => s.go);

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [activity, setActivity] = useState<Transaction[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("activity");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Balance visibility — shared across the dashboard/accounts/cards.
  const balanceVisible = useUIStore((s) => s.balanceVisible);
  const toggleBalanceVisible = useUIStore((s) => s.toggleBalanceVisible);

  // Customer's preferred display currency (USD or EUR). Used to convert
  // receipt amounts before passing to ReceiptModal so a receipt always
  // reflects the customer's selected currency.
  const displayCurrency = useCurrencyStore((s) => s.currency);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accountId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [accRes, actRes] = await Promise.all([
        services.account.getById(accountId),
        services.account.activity(accountId, 50),
      ]);
      if (cancelled) return;
      if (accRes.ok && accRes.data) {
        setAccount(accRes.data);
      } else {
        setAccount(null);
        toast({
          title: "Account not found",
          description: accRes.error,
          variant: "destructive",
        });
      }
      setActivity(actRes.ok && actRes.data ? actRes.data : []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  // --- Build receipt payload from a transaction row ---
  function openReceipt(txn: Transaction) {
    const status: ReceiptData["status"] =
      txn.status === "success"
        ? "success"
        : txn.status === "pending"
          ? "pending"
          : "failed";
    // Convert amounts to the customer's display currency so the receipt
    // always renders in their selected currency (ReceiptModal formats
    // using `data.currency` via Intl.NumberFormat — it does not convert).
    const srcCur = (txn.currency as CurrencyCode) ?? "USD";
    const signedAmount = txn.direction === "in" ? txn.amount : -txn.amount;
    const data: ReceiptData = {
      reference: txn.reference,
      date: formatDateTime(txn.createdAt),
      description: txn.description,
      amount: convertCurrency(signedAmount, srcCur, displayCurrency),
      currency: displayCurrency,
      fee:
        typeof txn.fee === "number"
          ? convertCurrency(txn.fee, srcCur, displayCurrency)
          : undefined,
      totalDebit:
        txn.direction === "out" && typeof txn.fee === "number"
          ? convertCurrency(txn.amount + txn.fee, srcCur, displayCurrency)
          : undefined,
      counterparty: txn.counterparty,
      counterpartyAccount: txn.counterpartyAccount,
      counterpartyBank: txn.counterpartyBank,
      status,
      meta: [
        { label: "Type", value: txn.type.replace(/_/g, " ") },
        { label: "Category", value: txn.category },
        { label: "Direction", value: txn.direction },
      ],
    };
    setReceipt(data);
    setReceiptOpen(true);
  }

  function copyAccountNumber() {
    if (!account) return;
    navigator.clipboard
      .writeText(account.accountNumber)
      .then(() => {
        setCopied(true);
        toast({ title: "Account number copied" });
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Please copy the number manually.",
          variant: "destructive",
        });
      });
  }

  // --- Activity table columns ---
  const columns: Column<Transaction>[] = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        render: (t) => (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(t.createdAt)}
          </span>
        ),
      },
      {
        key: "description",
        header: "Description",
        render: (t) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{t.description}</p>
            {t.counterparty && (
              <p className="truncate text-xs text-muted-foreground">
                {t.counterparty}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        render: (t) => (
          <Badge variant="outline" className="capitalize">
            {t.type.replace(/_/g, " ")}
          </Badge>
        ),
      },
      {
        key: "reference",
        header: "Reference",
        render: (t) => (
          <span className="font-mono text-xs text-muted-foreground">
            {t.reference}
          </span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        className: "text-right",
        render: (t) => {
          const signed = t.direction === "in" ? t.amount : -t.amount;
          const positive = signed >= 0;
          return (
            <span
              className={cn(
                "font-medium tabular-nums",
                positive ? "text-emerald-600" : "text-foreground"
              )}
            >
              {positive ? "+" : ""}
              {formatMoneyDisplay(Math.abs(signed), t.currency)}
            </span>
          );
        },
      },
    ],
    [],
  );

  // --- Empty / missing states ---
  if (!accountId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Account details" />
        <EmptyState
          title="Account not specified"
          description="Open an account from the Accounts page to view its details."
          icon={Landmark}
          action={
            <Button variant="outline" onClick={() => go("/accounts")}>
              <ArrowLeft className="size-4" />
              Back to accounts
            </Button>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/60" />
        <div className="h-48 w-full animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-muted/60" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-6">
        <PageHeader title="Account details" />
        <EmptyState
          title="Account not found"
          description="We couldn't find the account you're looking for."
          icon={Landmark}
          action={
            <Button variant="outline" onClick={() => go("/accounts")}>
              <ArrowLeft className="size-4" />
              Back to accounts
            </Button>
          }
        />
      </div>
    );
  }

  const meta = TYPE_META[account.accountType] ?? TYPE_META.savings;
  const TypeIcon = meta.icon;
  const displayName = account.nickname?.trim() || meta.label;

  return (
    <div className="space-y-6">
      <PageHeader
        title={displayName}
        description={`${meta.label} • ${account.currency}`}
        actions={
          <Button variant="outline" onClick={() => go("/accounts")}>
            <ArrowLeft className="size-4" />
            Accounts
          </Button>
        }
      />

      {/* Hero gradient card */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-teal via-teal-dark to-ocean text-white shadow-lg">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-white/15 backdrop-blur">
                <TypeIcon className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wider text-white/80">
                  {meta.label} account
                </p>
                <button
                  type="button"
                  onClick={copyAccountNumber}
                  className="mt-0.5 flex items-center gap-1.5 font-mono text-lg font-semibold tracking-wide hover:underline"
                  title="Copy account number"
                >
                  {maskAccountNumber(account.accountNumber)}
                  {copied ? (
                    <Check className="size-3.5 text-white/90" />
                  ) : (
                    <Copy className="size-3.5 text-white/80" />
                  )}
                </button>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "border-white/30 bg-white/10 capitalize text-white",
              )}
            >
              {account.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/70">
                Available balance
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tabular-nums">
                  {balanceVisible
                    ? formatMoneyDisplay(account.availableBalance, account.currency)
                    : "••••••"}
                </span>
                <button
                  type="button"
                  onClick={toggleBalanceVisible}
                  aria-label={balanceVisible ? "Hide balance" : "Show balance"}
                  className="text-white/80 transition-colors hover:text-white"
                >
                  {balanceVisible ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/70">
                Current balance
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {balanceVisible
                  ? formatMoneyDisplay(account.balance, account.currency)
                  : "••••••"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-white/70">
                Interest rate
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {typeof account.interestRatePct === "number"
                  ? `${account.interestRatePct.toFixed(2)}% p.a.`
                  : "—"}
              </p>
            </div>
          </div>

          <Separator className="bg-white/20" />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={() => go("/transfers")}
            >
              <Send className="size-3.5" />
              Transfer
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={() => go("/statements")}
            >
              <Receipt className="size-3.5" />
              Request statement
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/15 text-white hover:bg-white/25"
              onClick={() => go("/bills")}
            >
              <ArrowRight className="size-3.5" />
              Pay bills
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="activity" className="flex-1 sm:flex-none">
            Activity
          </TabsTrigger>
          <TabsTrigger value="details" className="flex-1 sm:flex-none">
            Details
          </TabsTrigger>
          <TabsTrigger value="statements" className="flex-1 sm:flex-none">
            Statements
          </TabsTrigger>
        </TabsList>

        {/* Activity tab */}
        <TabsContent value="activity" className="mt-4">
          <SectionCard
            title="Recent activity"
            description="The 50 most recent transactions on this account."
          >
            <DataTable
              columns={columns}
              rows={activity}
              onRowClick={openReceipt}
              emptyTitle="No activity yet"
              emptyDescription="Transactions for this account will appear here."
              emptyIcon={Receipt}
            />
          </SectionCard>
        </TabsContent>

        {/* Details tab */}
        <TabsContent value="details" className="mt-4">
          <SectionCard
            title="Account details"
            description="Metadata and configuration for this account."
          >
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <DetailRow label="Account name" value={displayName} />
              <DetailRow label="Account type" value={meta.label} />
              <DetailRow
                label="Account number"
                value={
                  <span className="font-mono">{account.accountNumber}</span>
                }
              />
              <DetailRow label="Currency" value={account.currency} />
              <DetailRow label="Status" value={<StatusBadge status={account.status} />} />
              <DetailRow
                label="Opened on"
                value={formatDate(account.openedAt, "d MMM yyyy")}
              />
              <DetailRow
                label="Interest rate"
                value={
                  typeof account.interestRatePct === "number"
                    ? `${account.interestRatePct.toFixed(2)}% p.a.`
                    : "—"
                }
              />
              <DetailRow
                label="Monthly maintenance fee"
                value={formatMoneyDisplay(0, account.currency)}
              />
              <DetailRow
                label="Available balance"
                value={formatMoneyDisplay(account.availableBalance, account.currency)}
              />
              <DetailRow
                label="Ledger balance"
                value={formatMoneyDisplay(account.balance, account.currency)}
              />
            </div>
          </SectionCard>
        </TabsContent>

        {/* Statements tab */}
        <TabsContent value="statements" className="mt-4">
          <SectionCard
            title="Statements"
            description="Generate downloadable statements for any period."
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="grid size-12 place-items-center rounded-xl bg-teal/10 text-teal">
                <Receipt className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Need a formal statement?</p>
                <p className="text-sm text-muted-foreground">
                  Head over to the Statements page to generate a PDF, CSV or
                  Excel statement for this account over any date range.
                </p>
              </div>
              <Button
                className="ml-auto bg-teal text-white hover:bg-teal/90"
                onClick={() => go("/statements")}
              >
                Go to Statements
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receipt}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// DetailRow — small label/value pair used in the Details tab
// ----------------------------------------------------------------------------
function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
