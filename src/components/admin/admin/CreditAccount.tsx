"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Landmark,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Copy,
  FileText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import { useRouterStore } from "@/lib/router";
import { formatMoney, formatDate, formatDateTime, initials } from "@/lib/format";
import type { User, Account, CreditAccountResult } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_AMOUNT = 1_000_000;
const MIN_REASON = 5;
const MAX_REASON = 200;
const QUICK_AMOUNTS = [50, 100, 500, 1000, 5000, 10000];

type Step = "search" | "accounts" | "details" | "success";

interface CustomerRow extends User {
  accountCount: number;
  totalBalance: number;
}

export function AdminCreditAccount() {
  const go = useRouterStore((s) => s.go);
  const admin = useAuthStore((s) => s.admin);

  const [step, setStep] = useState<Step>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<CreditAccountResult | null>(null);

  // -------------------------------------------------------------------------
  // Load customers on mount
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCustomers(true);
      const res = await services.admin.listCustomers();
      if (cancelled) return;
      if (res.ok && res.data) {
        setCustomers(res.data);
      }
      setLoadingCustomers(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // -------------------------------------------------------------------------
  // Filter customers by search query
  // -------------------------------------------------------------------------
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) =>
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  // -------------------------------------------------------------------------
  // Load accounts when a customer is selected
  // -------------------------------------------------------------------------
  async function selectCustomer(customer: CustomerRow) {
    setSelectedCustomer(customer);
    setStep("accounts");
    setLoadingAccounts(true);
    setAccounts([]);
    setSelectedAccount(null);

    // Try the Worker endpoint first (for the real Firebase environment).
    // If it's not configured, fall back to the existing accountService
    // (which reads from the mock db in the current environment).
    const workerRes = await services.admin.listCustomerAccounts(customer.id);
    if (workerRes.ok && workerRes.data) {
      setAccounts(workerRes.data as unknown as Account[]);
    } else {
      // Fall back to the existing service (works in the mock environment).
      const res = await services.account.listByUser(customer.id);
      if (res.ok && res.data) {
        setAccounts(res.data);
      } else {
        toast({
          title: "Unable to load accounts",
          description: res.error || "Please try again.",
          variant: "destructive",
        });
      }
    }
    setLoadingAccounts(false);
  }

  function selectAccount(account: Account) {
    setSelectedAccount(account);
    setAmount(0);
    setReason("");
    setReference(generateReference());
    setStep("details");
  }

  function generateReference(): string {
    const date = new Date();
    const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CR-${ymd}-${rand}`;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
  const amountError = useMemo(() => {
    if (amount <= 0) return "Amount must be greater than zero.";
    if (amount > MAX_AMOUNT) return `Maximum amount is ${formatMoney(MAX_AMOUNT, selectedAccount?.currency || "USD")}.`;
    return null;
  }, [amount, selectedAccount]);

  const reasonError = useMemo(() => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) return `Reason must be at least ${MIN_REASON} characters.`;
    if (trimmed.length > MAX_REASON) return `Reason must be at most ${MAX_REASON} characters.`;
    return null;
  }, [reason]);

  const referenceError = useMemo(() => {
    if (!reference.trim()) return "Reference is required.";
    return null;
  }, [reference]);

  const canSubmit = !amountError && !reasonError && !referenceError && amount > 0;

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------
  async function handleConfirm() {
    if (!selectedCustomer || !selectedAccount || !canSubmit) return;
    setConfirmOpen(false);
    setSubmitting(true);

    const res = await services.admin.creditAccount({
      customerId: selectedCustomer.id,
      accountId: selectedAccount.id,
      amount,
      currency: selectedAccount.currency,
      reason: reason.trim(),
      reference: reference.trim(),
    });

    setSubmitting(false);

    if (res.ok && res.data) {
      setResult(res.data);
      setStep("success");
      toast({
        title: "Account credited successfully",
        description: `${formatMoney(res.data.newBalance, selectedAccount.currency)} — Reference: ${res.data.reference}`,
      });
    } else {
      toast({
        title: "Credit operation failed",
        description: res.error || "An error occurred.",
        variant: "destructive",
      });
    }
  }

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------
  function handleReset() {
    setStep("search");
    setSelectedCustomer(null);
    setSelectedAccount(null);
    setAmount(0);
    setReason("");
    setReference("");
    setResult(null);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Customer Account"
        description="Credit a customer's account via a secure server-side ledger operation."
        actions={
          step !== "search" && (
            <Button variant="outline" onClick={handleReset}>
              <ArrowLeft className="size-4 mr-1" /> Start over
            </Button>
          )
        }
      />

      {/* Security notice */}
      <div className="rounded-lg border border-teal/20 bg-teal/5 px-4 py-3 flex items-start gap-3">
        <ShieldCheck className="size-5 text-teal shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Internal simulated ledger operation</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            This operation credits the customer's internal OceanSky account balance.
            It does not move real funds. All changes are processed server-side via
            the secure Cloudflare Worker with atomic Firestore transactions.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <StepBadge num={1} label="Select Customer" active={step === "search"} done={step !== "search"} />
        <Separator className="w-8" />
        <StepBadge num={2} label="Select Account" active={step === "accounts"} done={step === "details" || step === "success"} />
        <Separator className="w-8" />
        <StepBadge num={3} label="Enter Details" active={step === "details"} done={step === "success"} />
        <Separator className="w-8" />
        <StepBadge num={4} label="Complete" active={step === "success"} done={false} />
      </div>

      {/* Step content */}
      {step === "search" && (
        <CustomerSearchStep
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredCustomers={filteredCustomers}
          loading={loadingCustomers}
          onSelect={selectCustomer}
          adminUid={admin?.id}
        />
      )}

      {step === "accounts" && selectedCustomer && (
        <AccountSelectionStep
          customer={selectedCustomer}
          accounts={accounts}
          loading={loadingAccounts}
          onSelect={selectAccount}
          onBack={() => setStep("search")}
          adminUid={admin?.id}
        />
      )}

      {step === "details" && selectedCustomer && selectedAccount && (
        <CreditDetailsStep
          customer={selectedCustomer}
          account={selectedAccount}
          amount={amount}
          setAmount={setAmount}
          reason={reason}
          setReason={setReason}
          reference={reference}
          setReference={setReference}
          amountError={amountError}
          reasonError={reasonError}
          referenceError={referenceError}
          canSubmit={canSubmit}
          onSubmit={() => setConfirmOpen(true)}
          onBack={() => setStep("accounts")}
          submitting={submitting}
        />
      )}

      {step === "success" && selectedCustomer && selectedAccount && result && (
        <SuccessStep
          customer={selectedCustomer}
          account={selectedAccount}
          result={result}
          onNewCredit={handleReset}
          onViewTransactions={() => go("/admin/transactions")}
        />
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Confirm account credit"
        description="Please review the details below before confirming."
        confirmLabel="Confirm credit"
        variant="default"
      >
        {selectedCustomer && selectedAccount && (
          <div className="space-y-3">
            <ReviewRow label="Customer" value={`${selectedCustomer.firstName} ${selectedCustomer.lastName}`} />
            <ReviewRow label="Account" value={`${selectedAccount.accountNumber} (${selectedAccount.accountType})`} />
            <ReviewRow label="Amount" value={formatMoney(amount, selectedAccount.currency)} highlight />
            <ReviewRow label="Currency" value={selectedAccount.currency} />
            <ReviewRow label="Reason" value={reason.trim()} />
            <ReviewRow label="Reference" value={reference.trim()} />
            <Separator />
            <p className="text-xs text-muted-foreground">
              This action will atomically update the account balance, create a transaction
              record, and log an audit entry. The operation cannot be reversed from the UI.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "grid place-items-center size-7 rounded-full text-xs font-bold transition-colors",
        done ? "bg-teal text-white" : active ? "bg-teal/15 text-teal ring-2 ring-teal/30" : "bg-muted text-muted-foreground"
      )}>
        {done ? <CheckCircle2 className="size-4" /> : num}
      </div>
      <span className={cn("text-xs font-medium hidden sm:inline", active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

function CustomerSearchStep({
  searchQuery,
  setSearchQuery,
  filteredCustomers,
  loading,
  onSelect,
  adminUid,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filteredCustomers: CustomerRow[];
  loading: boolean;
  onSelect: (c: CustomerRow) => void;
  adminUid?: string;
}) {
  return (
    <SectionCard title="Select Customer" description="Search by name, email, or customer ID.">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers..."
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No customers found.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
            {filteredCustomers.map((customer) => {
              const isSelf = customer.id === adminUid;
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => onSelect(customer)}
                  disabled={isSelf}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-all hover:border-teal/40 hover:shadow-sm",
                    isSelf && "opacity-50 cursor-not-allowed hover:border-border/60 hover:shadow-none"
                  )}
                >
                  <Avatar className="size-10 ring-1 ring-border">
                    <AvatarFallback className="bg-teal/10 text-teal text-xs font-semibold">
                      {initials(customer.firstName, customer.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{customer.accountCount} account(s)</p>
                    <p className="text-sm font-semibold">{formatMoney(customer.totalBalance, "USD")}</p>
                  </div>
                  {isSelf ? (
                    <Badge variant="outline" className="shrink-0 text-xs">You</Badge>
                  ) : (
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-teal shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {filteredCustomers.some((c) => c.id === adminUid) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="size-3.5" />
            You cannot credit your own account. Your profile is disabled in the list.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function AccountSelectionStep({
  customer,
  accounts,
  loading,
  onSelect,
  onBack,
  adminUid,
}: {
  customer: CustomerRow;
  accounts: Account[];
  loading: boolean;
  onSelect: (a: Account) => void;
  onBack: () => void;
  adminUid?: string;
}) {
  return (
    <div className="space-y-4">
      {/* Customer summary */}
      <SectionCard title="Customer" description="Selected customer details.">
        <div className="flex items-center gap-4">
          <Avatar className="size-12 ring-1 ring-border">
            <AvatarFallback className="bg-teal/10 text-teal text-sm font-semibold">
              {initials(customer.firstName, customer.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{customer.firstName} {customer.lastName}</p>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs capitalize">{customer.tier}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{customer.status}</Badge>
              <span className="text-xs text-muted-foreground">{customer.id}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 mr-1" /> Change
          </Button>
        </div>
      </SectionCard>

      {/* Account list */}
      <SectionCard title="Select Account" description="Choose the account to credit.">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            This customer has no accounts.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((account) => {
              const isSelf = customer.id === adminUid;
              const isInactive = account.status !== "active";
              const disabled = isSelf || isInactive;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => !disabled && onSelect(account)}
                  disabled={disabled}
                  className={cn(
                    "group rounded-xl border-2 border-border/60 bg-card p-4 text-left transition-all hover:border-teal/40 hover:shadow-sm",
                    disabled && "opacity-60 cursor-not-allowed hover:border-border/60 hover:shadow-none"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm capitalize">{account.accountType}</p>
                      {account.nickname && (
                        <p className="text-xs text-muted-foreground">{account.nickname}</p>
                      )}
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        {account.accountNumber}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-xs capitalize",
                      account.status === "active" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"
                    )}>
                      {account.status}
                    </Badge>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="text-lg font-bold">{formatMoney(account.balance, account.currency)}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{account.currency}</Badge>
                  </div>
                  {isInactive && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="size-3" /> Only active accounts can receive credits.
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function CreditDetailsStep({
  customer,
  account,
  amount,
  setAmount,
  reason,
  setReason,
  reference,
  setReference,
  amountError,
  reasonError,
  referenceError,
  canSubmit,
  onSubmit,
  onBack,
  submitting,
}: {
  customer: CustomerRow;
  account: Account;
  amount: number;
  setAmount: (v: number) => void;
  reason: string;
  setReason: (v: string) => void;
  reference: string;
  setReference: (v: string) => void;
  amountError: string | null;
  reasonError: string | null;
  referenceError: string | null;
  canSubmit: boolean;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Customer"
          value={`${customer.firstName} ${customer.lastName}`}
          icon={Search}
          accent="teal"
        />
        <StatCard
          label="Account"
          value={account.accountNumber}
          icon={Landmark}
          accent="ocean"
          footer={<span className="capitalize">{account.accountType} · {account.currency}</span>}
        />
        <StatCard
          label="Current Balance"
          value={formatMoney(account.balance, account.currency)}
          icon={Banknote}
          accent="turquoise"
          footer={<span>Available: {formatMoney(account.availableBalance, account.currency)}</span>}
        />
      </div>

      {/* Credit form */}
      <SectionCard title="Credit Details" description="Enter the amount, reason, and reference for this credit.">
        <div className="space-y-5">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Credit Amount</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                {account.currency === "USD" ? "$" : account.currency === "EUR" ? "€" : account.currency}
              </span>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="pl-10 text-lg font-semibold"
                min={0}
                max={MAX_AMOUNT}
                step={0.01}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setAmount(amt)}
                >
                  {formatMoney(amt, account.currency, { maximumFractionDigits: 0 })}
                </Button>
              ))}
            </div>
            {amountError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="size-3" /> {amountError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Currency is locked to the account's currency ({account.currency}).
              Maximum: {formatMoney(MAX_AMOUNT, account.currency)}.
            </p>
          </div>

          <Separator />

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-muted-foreground text-xs">({MIN_REASON}–{MAX_REASON} characters)</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer service adjustment for disputed transaction"
              rows={3}
              maxLength={MAX_REASON}
            />
            <div className="flex items-center justify-between text-xs">
              <span className={cn(reasonError ? "text-destructive" : "text-muted-foreground")}>
                {reasonError || `${reason.trim().length} characters`}
              </span>
              <span className="text-muted-foreground">{reason.length}/{MAX_REASON}</span>
            </div>
          </div>

          <Separator />

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference">Transaction Reference</Label>
            <div className="flex gap-2">
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. CR-20261127-0001"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const date = new Date();
                  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
                  const rand = Math.floor(1000 + Math.random() * 9000);
                  setReference(`CR-${ymd}-${rand}`);
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            {referenceError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="size-3" /> {referenceError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Must be unique. The server validates uniqueness before processing.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="size-4 mr-1" /> Back
            </Button>
            <Button onClick={onSubmit} disabled={!canSubmit || submitting} size="lg">
              {submitting ? "Processing..." : <>Review & Confirm <ArrowRight className="size-4 ml-1" /></>}
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function SuccessStep({
  customer,
  account,
  result,
  onNewCredit,
  onViewTransactions,
}: {
  customer: CustomerRow;
  account: Account;
  result: CreditAccountResult;
  onNewCredit: () => void;
  onViewTransactions: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="grid place-items-center size-14 rounded-full bg-emerald-100 mx-auto">
          <CheckCircle2 className="size-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold mt-3">Account Credited Successfully</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {customer.firstName} {customer.lastName}'s account has been credited.
        </p>
      </div>

      {/* Receipt */}
      <SectionCard title="Transaction Receipt" description="Save this reference for your records.">
        <div className="space-y-3">
          <ReviewRow label="Transaction ID" value={result.transactionId} />
          <ReviewRow label="Reference" value={result.reference} />
          <ReviewRow label="Customer" value={`${customer.firstName} ${customer.lastName}`} />
          <ReviewRow label="Account" value={account.accountNumber} />
          <ReviewRow label="Amount Credited" value={formatMoney(result.newBalance - account.balance, account.currency)} highlight />
          <ReviewRow label="Currency" value={account.currency} />
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Previous Balance</p>
              <p className="font-semibold">{formatMoney(account.balance, account.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">New Balance</p>
              <p className="font-semibold text-teal">{formatMoney(result.newBalance, account.currency)}</p>
            </div>
          </div>
          <Separator />
          <ReviewRow label="Processed At" value={formatDateTime(result.creditedAt)} />
        </div>
      </SectionCard>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onViewTransactions}>
          <FileText className="size-4 mr-1" /> View Transactions
        </Button>
        <Button onClick={onNewCredit}>
          <Banknote className="size-4 mr-1" /> New Credit
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-right", highlight && "text-teal font-bold")}>{value}</span>
    </div>
  );
}
