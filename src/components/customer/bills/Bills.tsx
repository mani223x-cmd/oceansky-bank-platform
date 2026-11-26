"use client";

// ============================================================================
// OceanSky Bank — Bills & Payments (customer)
// ----------------------------------------------------------------------------
// Pay airtime, data, electricity, cable TV and internet bills. Two-column
// layout: left is a category-filtered biller grid + per-biller payment dialog
// (dynamic fields, AmountInput, confirm + receipt); right is the customer's
// last 10 bill payments.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Receipt,
  Search,
  Send,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  formatMoneyDisplay,
  formatDateTime,
  timeAgo,
  convertCurrency,
  useCurrencyStore,
  type CurrencyCode,
} from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type {
  Account,
  BillCategory,
  BillPayment,
  Biller,
  BillerField,
} from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { AmountInput } from "@/components/shared/AmountInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ReceiptModal, type ReceiptData } from "@/components/shared/ReceiptModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
interface CategoryMeta {
  value: BillCategory | "all";
  label: string;
  emoji: string;
}

const CATEGORIES: CategoryMeta[] = [
  { value: "all", label: "All", emoji: "✨" },
  { value: "airtime", label: "Airtime", emoji: "📞" },
  { value: "data", label: "Data", emoji: "📶" },
  { value: "electricity", label: "Electricity", emoji: "⚡" },
  { value: "cable_tv", label: "Cable TV", emoji: "📺" },
  { value: "internet", label: "Internet", emoji: "🌐" },
];

const CATEGORY_META: Record<BillCategory, { label: string; emoji: string }> = {
  airtime: { label: "Airtime", emoji: "📞" },
  data: { label: "Data", emoji: "📶" },
  electricity: { label: "Electricity", emoji: "⚡" },
  cable_tv: { label: "Cable TV", emoji: "📺" },
  internet: { label: "Internet", emoji: "🌐" },
  water: { label: "Water", emoji: "💧" },
  betting: { label: "Betting", emoji: "🎲" },
  education: { label: "Education", emoji: "🎓" },
};

const AIRTIME_QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// Categories where a plan option string carries a price — used to auto-fill
// the amount and disable manual amount entry.
const PLAN_AMOUNT_CATEGORIES: BillCategory[] = ["data", "internet"];

// ----------------------------------------------------------------------------
// Bills — main view
// ----------------------------------------------------------------------------
export function Bills() {
  const user = useAuthStore((s) => s.user);
  const displayCurrency = useCurrencyStore((s) => s.currency);

  // Data state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [billers, setBillers] = useState<Biller[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [billersLoading, setBillersLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Filter / search
  const [category, setCategory] = useState<BillCategory | "all">("all");
  const [search, setSearch] = useState("");

  // Payment dialog state
  const [activeBiller, setActiveBiller] = useState<Biller | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState<number>(0);
  const [accountId, setAccountId] = useState<string>("");

  // Confirm + receipt state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // ---- Initial load (accounts + payments) ----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setInitialLoading(false);
        return;
      }
      setInitialLoading(true);
      try {
        const [a, p] = await Promise.all([
          services.account.listByUser(user.id),
          services.bill.listPayments(user.id),
        ]);
        if (cancelled) return;
        if (a.ok && a.data) {
          setAccounts(a.data);
          if (a.data[0]) setAccountId(a.data[0].id);
        }
        if (p.ok && p.data) setPayments(p.data);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ---- Load billers when category changes ----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBillersLoading(true);
      try {
        const res = await services.bill.listBillers(
          category === "all" ? undefined : category
        );
        if (cancelled) return;
        if (res.ok && res.data) setBillers(res.data);
      } finally {
        if (!cancelled) setBillersLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [category]);

  // ---- Derived ----
  const filteredBillers = useMemo(() => {
    if (!search.trim()) return billers;
    const q = search.toLowerCase();
    return billers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        CATEGORY_META[b.category].label.toLowerCase().includes(q)
    );
  }, [billers, search]);

  if (!user) {
    return (
      <EmptyState
        title="Sign in required"
        description="Please sign in to pay bills."
        icon={CreditCard}
      />
    );
  }

  const recentPayments = payments.slice(0, 10);
  const totalPaidThisMonth = payments
    .filter((p) => {
      const d = new Date(p.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + (p.status === "success" ? p.amount : 0), 0);

  const activeAccount = accounts.find((a) => a.id === accountId);

  // ---- Helpers ----
  function openBiller(biller: Biller) {
    setActiveBiller(biller);
    // Seed field values: empty for text/tel, undefined for select (forces placeholder)
    const seed: Record<string, string> = {};
    biller.fields.forEach((f) => {
      if (f.type === "select" && f.options && f.options.length > 0) {
        // Leave empty so the placeholder shows; user must choose.
        seed[f.key] = "";
      } else {
        seed[f.key] = "";
      }
    });
    setFieldValues(seed);
    setAmount(0);
    setConfirmOpen(false);
  }

  function closeBiller() {
    setActiveBiller(null);
    setConfirmOpen(false);
    setSubmitting(false);
  }

  function isPlanAmountCategory(cat: BillCategory): boolean {
    return PLAN_AMOUNT_CATEGORIES.includes(cat);
  }

  /** Parse a price from a plan option string like "10GB — 5,500". */
  function parsePlanAmount(option: string): number {
    const parts = option.split(/[—–-]/);
    const last = parts[parts.length - 1] ?? "";
    const num = Number(last.replace(/[^\d.]/g, ""));
    return Number.isFinite(num) && num > 0 ? num : 0;
  }

  function handleFieldChange(field: BillerField, value: string) {
    setFieldValues((prev) => ({ ...prev, [field.key]: value }));
    // For plan-amount categories, when a select option changes, sync amount.
    if (
      activeBiller &&
      field.type === "select" &&
      isPlanAmountCategory(activeBiller.category)
    ) {
      const parsed = parsePlanAmount(value);
      if (parsed > 0) setAmount(parsed);
    }
  }

  /** Whether the amount input should be disabled for the active biller. */
  function amountDisabled(): boolean {
    if (!activeBiller) return false;
    if (!isPlanAmountCategory(activeBiller.category)) return false;
    // Disable when a plan option has been chosen with a parseable amount.
    const planField = activeBiller.fields.find((f) => f.type === "select");
    if (!planField) return false;
    const val = fieldValues[planField.key] || "";
    return parsePlanAmount(val) > 0;
  }

  function buildCustomerReference(): string {
    if (!activeBiller) return "";
    return activeBiller.fields
      .map((f) => fieldValues[f.key] || "")
      .filter(Boolean)
      .join(" / ");
  }

  function validate(): string | null {
    if (!activeBiller) return "No biller selected.";
    for (const f of activeBiller.fields) {
      if (f.required && !fieldValues[f.key]) {
        return `${f.label} is required.`;
      }
    }
    if (!accountId) return "Please select a source account.";
    if (!amount || amount <= 0) return "Enter a valid amount.";
    if (activeAccount && amount > activeAccount.availableBalance) {
      return "Insufficient available balance on the selected account.";
    }
    return null;
  }

  function handleOpenConfirm() {
    const err = validate();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirmPay() {
    if (!activeBiller || !user) return;
    const ref = buildCustomerReference();
    setSubmitting(true);
    const res = await services.bill.payBill({
      userId: user.id,
      accountId,
      billerId: activeBiller.id,
      amount,
      customerReference: ref,
    });
    setSubmitting(false);
    if (res.ok && res.data) {
      const payment = res.data;
      // Prepend to payments list
      setPayments((prev) => [payment, ...prev]);
      // Refresh account balances
      services.account.listByUser(user.id).then((a) => {
        if (a.ok && a.data) setAccounts(a.data);
      });
      // Build receipt (amount pre-converted to the customer's display
      // currency so ReceiptModal renders in the selected currency).
      const rcpt: ReceiptData = {
        reference: payment.reference,
        date: formatDateTime(payment.createdAt),
        description: `${activeBiller.name} — ${CATEGORY_META[activeBiller.category].label}`,
        amount: convertCurrency(payment.amount, payment.currency as CurrencyCode, displayCurrency),
        currency: displayCurrency,
        counterparty: activeBiller.name,
        counterpartyAccount: ref,
        counterpartyBank: CATEGORY_META[activeBiller.category].label,
        status: payment.status,
        meta: [
          { label: "Category", value: CATEGORY_META[activeBiller.category].label },
          {
            label: "From account",
            value: activeAccount
              ? `${activeAccount.nickname || activeAccount.accountType} · ••••${activeAccount.accountNumber.slice(-4)}`
              : "—",
          },
        ],
      };
      setReceipt(rcpt);
      setReceiptOpen(true);
      toast({
        title: "Payment successful",
        description: `${formatMoneyDisplay(payment.amount, payment.currency as CurrencyCode)} paid to ${activeBiller.name}.`,
      });
      closeBiller();
    } else {
      toast({
        title: "Payment failed",
        description: res.error,
        variant: "destructive",
      });
      setConfirmOpen(false);
    }
  }

  // ---- Render ----
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills & Payments"
        description="Pay airtime, data, electricity, cable TV and more."
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Billers available"
          value={billers.length}
          icon={Zap}
          accent="teal"
        />
        <StatCard
          label="Payments this month"
          value={formatMoneyDisplay(totalPaidThisMonth, "USD")}
          icon={Receipt}
          accent="turquoise"
        />
        <StatCard
          label="Total payments"
          value={payments.length}
          icon={CreditCard}
          accent="muted"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — biller grid */}
        <div className="lg:col-span-2 space-y-4">
          <SectionCard
            title="Billers"
            description="Pick a biller to start a payment."
            icon={Zap}
            action={
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search billers"
                  className="pl-8 h-9"
                />
              </div>
            }
            bodyClassName="space-y-4"
          >
            {/* Category tabs */}
            <Tabs value={category} onValueChange={(v) => setCategory(v as BillCategory | "all")}>
              <TabsList className="w-full overflow-x-auto justify-start h-auto flex-wrap">
                {CATEGORIES.map((c) => (
                  <TabsTrigger key={c.value} value={c.value} className="gap-1.5">
                    <span aria-hidden>{c.emoji}</span>
                    {c.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Biller grid */}
            {billersLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-xl bg-muted/60 animate-pulse" />
                ))}
              </div>
            ) : filteredBillers.length === 0 ? (
              <EmptyState
                title="No billers found"
                description="Try a different category or search term."
                icon={Search}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredBillers.map((b) => (
                  <BillerCard
                    key={b.id}
                    biller={b}
                    onPay={() => openBiller(b)}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column — recent payments */}
        <div className="space-y-4">
          <SectionCard
            title="Recent payments"
            description="Your last 10 bill payments."
            icon={Receipt}
            bodyClassName="p-0"
          >
            {initialLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
                ))}
              </div>
            ) : recentPayments.length === 0 ? (
              <EmptyState
                title="No payments yet"
                description="Your bill payment history will appear here."
                icon={Receipt}
              />
            ) : (
              <ul className="divide-y max-h-[28rem] overflow-y-auto scrollbar-thin">
                {recentPayments.map((p) => (
                  <li key={p.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base" aria-hidden>
                            {CATEGORY_META[p.category].emoji}
                          </span>
                          <p className="font-medium text-sm truncate">{p.billerName}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {CATEGORY_META[p.category].label}
                          </Badge>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {p.reference} · {timeAgo(p.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm tabular-nums">
                          {formatMoneyDisplay(p.amount, p.currency as CurrencyCode)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDateTime(p.createdAt, "d MMM, HH:mm")}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={!!activeBiller} onOpenChange={(o) => !o && closeBiller()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {activeBiller && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden>
                    {CATEGORY_META[activeBiller.category].emoji}
                  </span>
                  {activeBiller.name}
                </DialogTitle>
                <DialogDescription>
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_META[activeBiller.category].label}
                  </Badge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Dynamic fields */}
                {activeBiller.fields.map((f) => (
                  <DynamicField
                    key={f.key}
                    field={f}
                    value={fieldValues[f.key] || ""}
                    onChange={(v) => handleFieldChange(f, v)}
                  />
                ))}

                <Separator />

                {/* Amount */}
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <AmountInput
                    value={amount}
                    onChange={setAmount}
                    currency={activeAccount?.currency || "USD"}
                    quickAmounts={
                      activeBiller.category === "airtime" ? AIRTIME_QUICK_AMOUNTS : undefined
                    }
                    min={0}
                    className={amountDisabled() ? "opacity-60" : ""}
                  />
                  {amountDisabled() && (
                    <p className="text-xs text-muted-foreground">
                      Amount is set by the selected plan.
                    </p>
                  )}
                </div>

                {/* From account */}
                <div className="space-y-2">
                  <Label htmlFor="pay-account">From account</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="pay-account" className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nickname ? `${a.nickname} · ` : ""}
                          ••••{a.accountNumber.slice(-4)} ·{" "}
                          {formatMoneyDisplay(a.availableBalance, a.currency as CurrencyCode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeAccount && (
                    <p className="text-xs text-muted-foreground">
                      Available:{" "}
                      <span className="font-medium text-foreground">
                        {formatMoneyDisplay(activeAccount.availableBalance, activeAccount.currency as CurrencyCode)}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeBiller}>
                  Cancel
                </Button>
                <Button
                  onClick={handleOpenConfirm}
                  className="bg-teal text-white hover:bg-teal-dark"
                >
                  <Send className="size-4" />
                  Pay {amount > 0 ? formatMoneyDisplay(amount, (activeAccount?.currency || "USD") as CurrencyCode) : ""}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm payment */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmPay}
        title="Confirm payment"
        description="Please review the details below before continuing."
        confirmLabel={submitting ? "Processing…" : "Confirm payment"}
        variant="success"
      >
        {activeBiller && (
          <div className="space-y-2">
            <SummaryRow label="Biller" value={activeBiller.name} />
            <SummaryRow
              label="Category"
              value={CATEGORY_META[activeBiller.category].label}
            />
            <SummaryRow label="Reference" value={buildCustomerReference() || "—"} />
            {activeAccount && (
              <SummaryRow
                label="From"
                value={`${activeAccount.nickname || activeAccount.accountType} · ••••${activeAccount.accountNumber.slice(-4)}`}
              />
            )}
            <Separator />
            <div className="flex justify-between text-base font-semibold pt-1">
              <span>Amount</span>
              <span className="tabular-nums">
                {formatMoneyDisplay(amount, (activeAccount?.currency || "USD") as CurrencyCode)}
              </span>
            </div>
          </div>
        )}
      </ConfirmDialog>

      {/* Receipt */}
      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receipt}
        title="Payment Receipt"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function BillerCard({ biller, onPay }: { biller: Biller; onPay: () => void }) {
  const meta = CATEGORY_META[biller.category];
  return (
    <button
      type="button"
      onClick={onPay}
      className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:border-teal/40 hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between w-full">
        <div className="grid place-items-center rounded-lg bg-teal/10 size-10 text-xl">
          <span aria-hidden>{meta.emoji}</span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {meta.label}
        </Badge>
      </div>
      <div className="min-w-0 w-full">
        <p className="font-medium text-sm leading-tight truncate">{biller.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {biller.fields.length} field{biller.fields.length === 1 ? "" : "s"} required
        </p>
      </div>
      <span
        className={cn(
          "mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal",
          "group-hover:gap-1.5 transition-all"
        )}
      >
        Pay now →
      </span>
    </button>
  );
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: BillerField;
  value: string;
  onChange: (v: string) => void;
}) {
  const fieldId = `field-${field.key}`;
  if (field.type === "select") {
    return (
      <div className="space-y-2">
        <Label htmlFor={fieldId}>
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={fieldId} className="w-full">
            <SelectValue placeholder={field.placeholder || "Select option"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={fieldId}
        type={field.type === "tel" ? "tel" : "text"}
        inputMode={field.type === "tel" ? "tel" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        autoComplete="off"
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
