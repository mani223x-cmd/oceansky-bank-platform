"use client";

// ============================================================================
// OceanSky Bank — Transactions (customer)
// ----------------------------------------------------------------------------
// Full transaction history for the logged-in customer with multi-filter
// search, summary stats, paginated DataTable and a receipt modal.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  ArrowUpDown,
  Calendar as CalendarIcon,
  Download,
  Filter,
  Receipt,
  Search,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  convertCurrency,
  formatDateTime,
  formatMoneyDisplay,
  useCurrencyStore,
  type CurrencyCode,
} from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type { Account, Transaction } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import {
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { ReceiptModal, type ReceiptData } from "@/components/shared/ReceiptModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ----------------------------------------------------------------------------
// Filter option lists
// ----------------------------------------------------------------------------
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "credit", label: "Credit" },
  { value: "debit", label: "Debit" },
  { value: "transfer_in", label: "Transfer in" },
  { value: "transfer_out", label: "Transfer out" },
  { value: "bill_payment", label: "Bill payment" },
  { value: "airtime", label: "Airtime" },
  { value: "card_payment", label: "Card payment" },
  { value: "fee", label: "Fee" },
  { value: "interest", label: "Interest" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "reversed", label: "Reversed" },
];

const PAGE_SIZE = 25;

// ----------------------------------------------------------------------------
// Transactions
// ----------------------------------------------------------------------------
export function Transactions() {
  const user = useAuthStore((s) => s.user);
  const go = useRouterStore((s) => s.go);
  // Customer's preferred display currency. Receipt amounts are converted
  // into this currency before being handed to ReceiptModal.
  const displayCurrency = useCurrencyStore((s) => s.currency);

  // --- Account list for the account filter dropdown ---
  const [accounts, setAccounts] = useState<Account[]>([]);

  // --- Filter state ---
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  // --- Result state ---
  const [loading, setLoading] = useState(true);
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // --- Receipt modal state ---
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // --- Debounced search (300ms) ---
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // --- Load accounts once (for the account select) ---
  useEffect(() => {
    let cancelled = false;
    async function loadAccounts() {
      if (!user) return;
      const res = await services.account.listByUser(user.id);
      if (cancelled) return;
      if (res.ok && res.data) setAccounts(res.data);
    }
    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // --- Load transactions whenever filters change ---
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const res = await services.transaction.listByUser(user.id, {
        accountId: accountId !== "all" ? accountId : undefined,
        type,
        status,
        search: search || undefined,
        from: fromDate ? fromDate.toISOString() : undefined,
        to: toDate ? new Date(toDate.getTime() + 86_399_999).toISOString() : undefined,
      });
      if (cancelled) return;
      if (res.ok && res.data) {
        setAllTxns(res.data);
        // Reset pagination whenever a fresh filtered result set arrives.
        // This is fine to call here because we are inside an async callback
        // (after `await`), not synchronously in the effect body.
        setVisibleCount(PAGE_SIZE);
      } else {
        setAllTxns([]);
        setVisibleCount(PAGE_SIZE);
        toast({
          title: "Failed to load transactions",
          description: res.error,
          variant: "destructive",
        });
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, accountId, type, status, search, fromDate, toDate]);

  // --- Stats over the full filtered result set ---
  const stats = useMemo(() => {
    const credits = allTxns
      .filter((t) => t.direction === "in")
      .reduce((s, t) => s + t.amount, 0);
    const debits = allTxns
      .filter((t) => t.direction === "out")
      .reduce((s, t) => s + t.amount, 0);
    const currency = allTxns[0]?.currency ?? accounts[0]?.currency ?? "USD";
    return { count: allTxns.length, credits, debits, currency };
  }, [allTxns, accounts]);

  // --- Visible slice (pagination) ---
  const visible = useMemo(
    () => allTxns.slice(0, visibleCount),
    [allTxns, visibleCount],
  );
  const hasMore = visibleCount < allTxns.length;

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setAccountId("all");
    setType("all");
    setStatus("all");
    setFromDate(undefined);
    setToDate(undefined);
  }

  const filtersActive =
    search !== "" ||
    accountId !== "all" ||
    type !== "all" ||
    status !== "all" ||
    fromDate !== undefined ||
    toDate !== undefined;

  // --- Build receipt payload ---
  function openReceipt(txn: Transaction) {
    const receiptStatus: ReceiptData["status"] =
      txn.status === "success"
        ? "success"
        : txn.status === "pending"
          ? "pending"
          : "failed";
    // Convert amounts into the customer's display currency so the receipt
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
      status: receiptStatus,
      meta: [
        { label: "Type", value: txn.type.replace(/_/g, " ") },
        { label: "Category", value: txn.category },
        { label: "Direction", value: txn.direction },
      ],
    };
    setReceipt(data);
    setReceiptOpen(true);
  }

  function downloadReceipt(txn: Transaction) {
    toast({
      title: "Download started",
      description: `Receipt for ${txn.reference} is being prepared.`,
    });
  }

  function exportCsv() {
    toast({
      title: "Export started",
      description: "You'll receive an email when it's ready.",
    });
  }

  // --- DataTable columns ---
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
                {t.counterpartyBank ? ` • ${t.counterpartyBank}` : ""}
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
        key: "status",
        header: "Status",
        render: (t) => <StatusBadge status={t.status} />,
      },
      {
        key: "amount",
        header: "Amount",
        className: "text-right",
        render: (t) => {
          const signed = t.direction === "in" ? t.amount : -t.amount;
          const positive = signed >= 0;
          return (
            <div className="flex items-center justify-end gap-2">
              <span
                className={cn(
                  "font-medium tabular-nums",
                  positive ? "text-emerald-600" : "text-foreground"
                )}
              >
                {positive ? "+" : ""}
                {formatMoneyDisplay(Math.abs(signed), t.currency)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadReceipt(t);
                }}
                aria-label="Download receipt"
                title="Download receipt"
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Search, filter and export every transaction across your accounts."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <SectionCard
        title="Filters"
        description="Narrow down transactions by account, type, status, date or keyword."
        icon={Filter}
        action={
          filtersActive ? (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="size-3.5" />
              Clear filters
            </Button>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Reference, description, counterparty…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Account */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Account
            </label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nickname ?? a.accountType} ••••{a.accountNumber.slice(-4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              From date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="size-4" />
                  {fromDate ? format(fromDate, "d MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={setFromDate}
                  disabled={(d) => (toDate ? d > toDate : false)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* To date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              To date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !toDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="size-4" />
                  {toDate ? format(toDate, "d MMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={setToDate}
                  disabled={(d) => (fromDate ? d < fromDate : false)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </SectionCard>

      {/* Stats over the filtered result */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Results"
          value={stats.count}
          icon={ArrowUpDown}
          accent="teal"
        />
        <StatCard
          label="Total credits"
          value={formatMoneyDisplay(stats.credits, stats.currency)}
          icon={Receipt}
          accent="turquoise"
        />
        <StatCard
          label="Total debits"
          value={formatMoneyDisplay(stats.debits, stats.currency)}
          icon={Receipt}
          accent="ocean"
        />
      </div>

      {/* Transactions table */}
      <SectionCard
        title="Transactions"
        description={`${visible.length} of ${allTxns.length} shown`}
      >
        <DataTable
          columns={columns}
          rows={visible}
          loading={loading}
          onRowClick={openReceipt}
          emptyTitle="No transactions found"
          emptyDescription="Try adjusting your filters or clearing them to see more results."
          emptyIcon={Receipt}
        />

        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Load more
              <span className="text-xs text-muted-foreground">
                (+{Math.min(PAGE_SIZE, allTxns.length - visible.length)} more)
              </span>
            </Button>
          </div>
        )}
      </SectionCard>

      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receipt}
      />

      {/* Statements shortcut — exposed for users who want a formal export */}
      <div className="flex justify-end">
        <Button variant="link" onClick={() => go("/statements")}>
          Need a formal statement?
          <ArrowUpDown className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
