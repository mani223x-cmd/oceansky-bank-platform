"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Download,
  FileText,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Hash,
  User,
  Landmark,
  Banknote,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { services } from "@/lib/services";
import type {
  LedgerTransactionSummary,
  LedgerTransactionDetail,
  LedgerAuditEntry,
  LedgerTransactionListResponse,
} from "@/lib/types";
import { formatMoney, formatDateTime, formatDate, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "credit", label: "Credit" },
  { value: "debit", label: "Debit" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "bill_payment", label: "Bill Payment" },
  { value: "admin_credit", label: "Admin Credit" },
  { value: "card_payment", label: "Card Payment" },
  { value: "fee", label: "Fee" },
  { value: "interest", label: "Interest" },
  { value: "salary", label: "Salary" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "reversed", label: "Reversed" },
];

const STATUS_ICONS: Record<string, LucideIcon> = {
  success: CheckCircle2,
  pending: Clock,
  failed: XCircle,
  reversed: AlertCircle,
};

const STATUS_COLORS: Record<string, string> = {
  success: "text-emerald-600 bg-emerald-50 border-emerald-200",
  pending: "text-amber-600 bg-amber-50 border-amber-200",
  failed: "text-destructive bg-destructive/5 border-destructive/20",
  reversed: "text-muted-foreground bg-muted border-border",
};

const TYPE_COLORS: Record<string, string> = {
  credit: "text-emerald-600 bg-emerald-50",
  admin_credit: "text-teal bg-teal/10",
  transfer_in: "text-emerald-600 bg-emerald-50",
  debit: "text-foreground bg-muted",
  transfer_out: "text-foreground bg-muted",
  bill_payment: "text-ocean bg-ocean/10",
  card_payment: "text-ocean bg-ocean/10",
  fee: "text-muted-foreground bg-muted",
  interest: "text-emerald-600 bg-emerald-50",
  salary: "text-emerald-600 bg-emerald-50",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminLedgerHistory() {
  // State
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<LedgerTransactionSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<{
    transaction: LedgerTransactionDetail;
    auditEntries: LedgerAuditEntry[];
  } | null>(null);

  // -------------------------------------------------------------------------
  // Load transactions
  // -------------------------------------------------------------------------
  const loadTransactions = useCallback(
    async (resetPagination: boolean = false) => {
      setLoading(true);
      setError(null);

      const currentCursor = resetPagination ? null : cursor;
      const currentPage = resetPagination ? 1 : page;

      const res = await services.admin.listLedgerTransactions({
        page: currentPage,
        pageSize: PAGE_SIZE,
        cursor: currentCursor,
        search: searchQuery || undefined,
        type: typeFilter,
        status: statusFilter,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      if (res.ok && res.data) {
        if (resetPagination) {
          setTransactions(res.data.transactions);
          setCursor(null);
          setPage(1);
        } else {
          setTransactions((prev) => [...prev, ...res.data!.transactions]);
        }
        setHasMore(res.data.hasMore);
        if (res.data.nextPageCursor) {
          setCursor(res.data.nextPageCursor);
        }
      } else {
        setError(res.error || "Unable to load transactions.");
        if (resetPagination) {
          setTransactions([]);
        }
      }
      setLoading(false);
    },
    [cursor, page, searchQuery, typeFilter, statusFilter, fromDate, toDate]
  );

  // Load on mount and when filters change
  useEffect(() => {
    loadTransactions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, typeFilter, statusFilter, fromDate, toDate]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  function handleSearch() {
    setSearchQuery(searchInput.trim());
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  function handleClearFilters() {
    setSearchInput("");
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  async function handleLoadMore() {
    if (!hasMore || loading) return;
    setPage((p) => p + 1);
    await loadTransactions(false);
  }

  async function handleTransactionClick(txn: LedgerTransactionSummary) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);

    const res = await services.admin.getLedgerTransactionDetail(txn.id);

    if (res.ok && res.data) {
      setDetailData(res.data);
    } else {
      toast.error(res.error || "Unable to load transaction details.");
      setDetailOpen(false);
    }
    setDetailLoading(false);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const hasActiveFilters = searchQuery || typeFilter !== "all" || statusFilter !== "all" || fromDate || toDate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ledger History"
        description="Browse all bank transactions with full audit trail visibility."
        actions={
          <Button variant="outline" size="sm" disabled>
            <Download className="size-4 mr-1" /> Export
          </Button>
        }
      />

      {/* Security notice */}
      <div className="rounded-lg border border-teal/20 bg-teal/5 px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="size-5 text-teal shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Secure Ledger Access</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            All transaction data is retrieved from Firestore via the secure Cloudflare Worker.
            Admin authorization is verified server-side using Firebase custom claims.
          </p>
        </div>
      </div>

      {/* Filters */}
      <SectionCard title="Search & Filters" description="Find transactions by reference, ID, customer, type, status, or date range.">
        <div className="space-y-4">
          {/* Search row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by reference, transaction ID, or customer ID..."
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} variant="default">
              <Search className="size-4 mr-1" /> Search
            </Button>
            {hasActiveFilters && (
              <Button onClick={handleClearFilters} variant="ghost">
                Clear
              </Button>
            )}
          </div>

          {/* Filter dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Transaction list */}
      <SectionCard
        title="Transactions"
        description={`${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"}${hasMore ? " (more available)" : ""}`}
      >
        {loading && transactions.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 space-y-3">
            <div className="grid place-items-center rounded-full bg-destructive/10 size-12 mx-auto">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <div>
              <p className="font-medium">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => loadTransactions(true)}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions found"
            description={hasActiveFilters ? "Try adjusting your search or filters." : "Transactions will appear here once they are created."}
          />
        ) : (
          <div className="space-y-2">
            {transactions.map((txn) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                onClick={() => handleTransactionClick(txn)}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="pt-3 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? (
                    "Loading..."
                  ) : (
                    <>
                      Load more <ArrowRight className="size-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Transaction detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Transaction Detail</DialogTitle>
            <DialogDescription>
              Full transaction record with related audit trail.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          ) : detailData ? (
            <TransactionDetailContent
              transaction={detailData.transaction}
              auditEntries={detailData.auditEntries}
            />
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Unable to load transaction details.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction row
// ---------------------------------------------------------------------------

function TransactionRow({
  txn,
  onClick,
}: {
  txn: LedgerTransactionSummary;
  onClick: () => void;
}) {
  const isCredit = txn.direction === "in";
  const StatusIcon = STATUS_ICONS[txn.status] || Clock;
  const typeColor = TYPE_COLORS[txn.type] || "text-foreground bg-muted";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:border-teal/40 hover:shadow-sm"
    >
      {/* Type icon */}
      <div className={cn("grid place-items-center size-10 rounded-lg shrink-0", typeColor)}>
        {isCredit ? (
          <ArrowLeftRight className="size-4 rotate-180" />
        ) : (
          <ArrowLeftRight className="size-4" />
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{txn.description}</p>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{txn.reference}</span>
          <span>·</span>
          <span>{formatDateTime(txn.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[10px] py-0 capitalize">
            {txn.type.replace(/_/g, " ")}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-[10px] py-0 capitalize border", STATUS_COLORS[txn.status] || "")}
          >
            <StatusIcon className="size-2.5 mr-0.5" />
            {txn.status}
          </Badge>
          {txn.ownerUid && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {txn.ownerUid.slice(0, 12)}...
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className={cn(
          "font-semibold tabular-nums",
          isCredit ? "text-emerald-600" : "text-foreground"
        )}>
          {isCredit ? "+" : "-"}{formatMoney(Math.abs(txn.amount), txn.currency)}
        </p>
        {txn.fee > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Fee: {formatMoney(txn.fee, txn.currency)}
          </p>
        )}
      </div>

      {/* Chevron */}
      <ArrowRight className="size-4 text-muted-foreground group-hover:text-teal shrink-0" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Transaction detail content
// ---------------------------------------------------------------------------

function TransactionDetailContent({
  transaction,
  auditEntries,
}: {
  transaction: LedgerTransactionDetail;
  auditEntries: LedgerAuditEntry[];
}) {
  const isCredit = transaction.direction === "in";

  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-4 pr-2">
        {/* Amount header */}
        <div className="rounded-xl bg-muted/40 p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {transaction.type.replace(/_/g, " ")}
          </p>
          <p className={cn(
            "text-2xl font-bold mt-1",
            isCredit ? "text-emerald-600" : "text-foreground"
          )}>
            {isCredit ? "+" : "-"}{formatMoney(Math.abs(transaction.amount), transaction.currency)}
          </p>
          <Badge
            variant="outline"
            className={cn("mt-2 capitalize border", STATUS_COLORS[transaction.status] || "")}
          >
            {transaction.status}
          </Badge>
        </div>

        {/* Transaction details */}
        <div className="rounded-xl border p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Transaction Details
          </p>
          <DetailRow icon={Hash} label="Transaction ID" value={transaction.id} mono />
          <DetailRow icon={FileText} label="Reference" value={transaction.reference} mono />
          <DetailRow icon={ArrowLeftRight} label="Type" value={transaction.type.replace(/_/g, " ")} capitalize />
          <DetailRow icon={ArrowLeftRight} label="Category" value={transaction.category.replace(/_/g, " ")} capitalize />
          <DetailRow icon={Banknote} label="Amount" value={formatMoney(transaction.amount, transaction.currency)} />
          {transaction.fee > 0 && (
            <DetailRow icon={Banknote} label="Fee" value={formatMoney(transaction.fee, transaction.currency)} />
          )}
          <DetailRow icon={Clock} label="Created At" value={formatDateTime(transaction.createdAt)} />
          {transaction.valueDate && (
            <DetailRow icon={Clock} label="Value Date" value={formatDate(transaction.valueDate)} />
          )}
        </div>

        {/* Description */}
        <div className="rounded-xl border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Description
          </p>
          <p className="text-sm">{transaction.description}</p>
          {transaction.counterparty && (
            <p className="text-xs text-muted-foreground">
              Counterparty: {transaction.counterparty}
            </p>
          )}
        </div>

        {/* Customer & Account */}
        <div className="rounded-xl border p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Customer & Account
          </p>
          <DetailRow icon={User} label="Customer ID" value={transaction.ownerUid} mono />
          <DetailRow icon={Landmark} label="Account ID" value={transaction.accountId} mono />
          {transaction.counterpartyAccount && (
            <DetailRow icon={Landmark} label="Counterparty Account" value={transaction.counterpartyAccount} mono />
          )}
          {transaction.counterpartyBank && (
            <DetailRow icon={Landmark} label="Counterparty Bank" value={transaction.counterpartyBank} />
          )}
        </div>

        {/* Metadata (admin-safe fields only) */}
        {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
          <div className="rounded-xl border p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Metadata
            </p>
            <div className="space-y-1.5 text-xs">
              {Object.entries(transaction.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-medium text-right truncate max-w-[60%]">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit trail */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ScrollText className="size-4 text-teal" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Audit Trail ({auditEntries.length})
            </p>
          </div>

          {auditEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No audit entries found for this transaction.
            </p>
          ) : (
            <div className="space-y-2">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] py-0 capitalize">
                      {entry.actorType}
                    </Badge>
                    <span>{entry.actorName}</span>
                  </div>
                  {entry.metadata && (
                    <div className="space-y-0.5 mt-1.5">
                      {Object.entries(entry.metadata).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{key}</span>
                          <span className="text-right truncate max-w-[60%]">
                            {typeof value === "number" && (key.includes("Balance") || key.includes("amount"))
                              ? formatMoney(value as number, (entry.metadata?.currency as string) || "USD")
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
  capitalize,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={cn(
        "text-sm font-medium text-right",
        mono && "font-mono text-xs",
        capitalize && "capitalize"
      )}>
        {value}
      </span>
    </div>
  );
}
