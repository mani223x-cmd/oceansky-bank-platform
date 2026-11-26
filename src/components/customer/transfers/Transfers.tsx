"use client";

// ============================================================================
// OceanSky Bank — Transfers (customer)
// ----------------------------------------------------------------------------
// Move money to any bank instantly. Two-column layout: left is the
// new-transfer form with live fee preview + confirm + receipt; right is the
// saved beneficiaries shortcuts and the most recent transfer_out transactions.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clock,
  Plus,
  Send,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  convertCurrency,
  formatMoneyDisplay,
  maskAccountNumber,
  timeAgo,
  useCurrencyStore,
  type CurrencyCode,
} from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type {
  Account,
  Beneficiary,
  Transaction,
  TransferRequest,
  TransferResult,
} from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { AmountInput } from "@/components/shared/AmountInput";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ReceiptModal, type ReceiptData } from "@/components/shared/ReceiptModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ----------------------------------------------------------------------------
// Bank list (default = OceanSky Bank internal)
// ----------------------------------------------------------------------------
const BANKS: { value: string; code?: string }[] = [
  { value: "OceanSky Bank" },
  { value: "Chase", code: "021000021" },
  { value: "Bank of America", code: "026009593" },
  { value: "Wells Fargo", code: "121000248" },
  { value: "Citibank", code: "021000089" },
  { value: "Capital One", code: "051404260" },
  { value: "U.S. Bank", code: "091000022" },
  { value: "PNC Bank", code: "043000096" },
];

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];
const MAX_DESC = 100;

// Avatar tint set (teal / turquoise family + neutral ocean — no indigo/blue)
const AVATAR_TINTS: { bg: string; fg: string }[] = [
  { bg: "bg-teal/15", fg: "text-teal" },
  { bg: "bg-turquoise/20", fg: "text-teal-dark" },
  { bg: "bg-ocean/15", fg: "text-ocean" },
  { bg: "bg-emerald-500/15", fg: "text-emerald-600" },
];

function avatarTint(seed: string): { bg: string; fg: string } {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface PreviewState {
  fee: number;
  totalDebit: number;
  estimatedArrival: string;
  loading: boolean;
}

const INITIAL_PREVIEW: PreviewState = {
  fee: 0,
  totalDebit: 0,
  estimatedArrival: "—",
  loading: false,
};

// ----------------------------------------------------------------------------
// Transfers
// ----------------------------------------------------------------------------
export function Transfers() {
  const user = useAuthStore((s) => s.user);
  const go = useRouterStore((s) => s.go);
  // Customer's preferred display currency. Transfer receipt amounts are
  // converted into this currency before being handed to ReceiptModal.
  const displayCurrency = useCurrencyStore((s) => s.currency);

  // --- Reference data ---
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);

  // --- Form state ---
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toBankName, setToBankName] = useState<string>("OceanSky Bank");
  const [beneficiaryPick, setBeneficiaryPick] = useState<string>("new"); // "new" | beneficiary.id
  const [toAccountNumber, setToAccountNumber] = useState<string>("");
  const [toAccountName, setToAccountName] = useState<string>("");
  const [saveBeneficiary, setSaveBeneficiary] = useState<boolean>(false);
  const [beneficiaryNickname, setBeneficiaryNickname] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>("");

  // --- Preview ---
  const [preview, setPreview] = useState<PreviewState>(INITIAL_PREVIEW);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Flow state ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // ------------------------------------------------------------------
  // Initial data load — accounts, beneficiaries, recent transfer_out txns
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoadingRef(false);
        return;
      }
      setLoadingRef(true);
      try {
        const [accRes, benRes, txnRes] = await Promise.all([
          services.account.listByUser(user.id),
          services.beneficiary.listByUser(user.id),
          services.transaction.listByUser(user.id, { type: "transfer_out" }),
        ]);
        if (cancelled) return;
        if (accRes.ok && accRes.data) {
          setAccounts(accRes.data);
          if (accRes.data.length > 0 && !fromAccountId) {
            setFromAccountId(accRes.data[0]!.id);
          }
        }
        if (benRes.ok && benRes.data) setBeneficiaries(benRes.data);
        if (txnRes.ok && txnRes.data) setRecentTxns(txnRes.data.slice(0, 5));
      } finally {
        if (!cancelled) setLoadingRef(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ------------------------------------------------------------------
  // Derived lists
  // ------------------------------------------------------------------
  const isInternal = toBankName === "OceanSky Bank";

  const filteredBeneficiaries = useMemo(() => {
    return beneficiaries.filter((b) =>
      isInternal ? b.type === "internal" : b.type === "external"
    );
  }, [beneficiaries, isInternal]);

  const fromAccount = useMemo(
    () => accounts.find((a) => a.id === fromAccountId) ?? null,
    [accounts, fromAccountId]
  );

  // ------------------------------------------------------------------
  // When bank changes and the picked beneficiary no longer matches the
  // type, reset the picker.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (beneficiaryPick !== "new") {
      const picked = beneficiaries.find((b) => b.id === beneficiaryPick);
      if (!picked) {
        setBeneficiaryPick("new");
        return;
      }
      const pickedIsInternal = picked.type === "internal";
      if (pickedIsInternal !== isInternal) {
        setBeneficiaryPick("new");
      }
    }
  }, [beneficiaryPick, beneficiaries, isInternal]);

  // ------------------------------------------------------------------
  // When beneficiaryPick changes, prefill the recipient fields.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (beneficiaryPick === "new") return;
    const picked = beneficiaries.find((b) => b.id === beneficiaryPick);
    if (!picked) return;
    setToAccountNumber(picked.accountNumber);
    setToAccountName(picked.accountName);
  }, [beneficiaryPick, beneficiaries]);

  // ------------------------------------------------------------------
  // Live preview — debounced 500ms whenever amount or bank changes.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!fromAccountId || amount <= 0) {
      setPreview(INITIAL_PREVIEW);
      return;
    }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreview((p) => ({ ...p, loading: true }));
    const req: TransferRequest = {
      fromAccountId,
      toAccountNumber: toAccountNumber || "0000000000",
      toAccountName: toAccountName || "—",
      toBankName,
      amount,
      currency: fromAccount?.currency ?? "USD",
      description,
      saveBeneficiary: false,
    };
    previewTimer.current = setTimeout(async () => {
      const res = await services.transfer.preview(req);
      if (res.ok && res.data) {
        setPreview({
          fee: res.data.fee,
          totalDebit: res.data.totalDebit,
          estimatedArrival: res.data.estimatedArrival,
          loading: false,
        });
      } else {
        setPreview({ ...INITIAL_PREVIEW, loading: false });
      }
    }, 500);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [amount, toBankName, fromAccountId, fromAccount, toAccountNumber, toAccountName, description]);

  // ------------------------------------------------------------------
  // Build the TransferRequest from the current form state
  // ------------------------------------------------------------------
  function buildRequest(): TransferRequest | null {
    if (!user) return null;
    if (!fromAccountId) {
      toast({ title: "Select a source account", variant: "destructive" });
      return null;
    }
    if (!toAccountNumber.trim() || toAccountNumber.trim().length < 6) {
      toast({ title: "Enter a valid recipient account number", variant: "destructive" });
      return null;
    }
    if (!toAccountName.trim()) {
      toast({ title: "Enter the recipient account name", variant: "destructive" });
      return null;
    }
    if (amount <= 0) {
      toast({ title: "Enter an amount greater than zero", variant: "destructive" });
      return null;
    }
    if (saveBeneficiary && !beneficiaryNickname.trim()) {
      toast({ title: "Enter a nickname for the saved beneficiary", variant: "destructive" });
      return null;
    }
    return {
      fromAccountId,
      toAccountNumber: toAccountNumber.trim(),
      toAccountName: toAccountName.trim(),
      toBankName,
      amount,
      currency: fromAccount?.currency ?? "USD",
      description: description.trim().slice(0, MAX_DESC),
      saveBeneficiary,
      beneficiaryNickname: saveBeneficiary ? beneficiaryNickname.trim() : undefined,
    };
  }

  function handleContinue() {
    const req = buildRequest();
    if (!req) return;
    setConfirmOpen(true);
  }

  async function handleConfirmTransfer() {
    if (!user) return;
    const req = buildRequest();
    if (!req) {
      setConfirmOpen(false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await services.transfer.execute(req, user.id);
      if (res.ok && res.data) {
        const result: TransferResult = res.data;
        setConfirmOpen(false);
        // Refresh beneficiaries if a new one was saved
        if (req.saveBeneficiary) {
          const benRes = await services.beneficiary.listByUser(user.id);
          if (benRes.ok && benRes.data) setBeneficiaries(benRes.data);
        }
        // Refresh recent transfers
        const txnRes = await services.transaction.listByUser(user.id, { type: "transfer_out" });
        if (txnRes.ok && txnRes.data) setRecentTxns(txnRes.data.slice(0, 5));
        // Refresh source account balances (mock mutates in place)
        const accRes = await services.account.listByUser(user.id);
        if (accRes.ok && accRes.data) setAccounts(accRes.data);

        // Build receipt — convert amounts into the customer's display
        // currency so ReceiptModal renders in their selected currency.
        const srcCur = (req.currency as CurrencyCode) ?? "USD";
        const rcpt: ReceiptData = {
          reference: result.reference,
          date: result.createdAt,
          description: req.description || `Transfer to ${req.toAccountName}`,
          amount: convertCurrency(result.amount, srcCur, displayCurrency),
          currency: displayCurrency,
          fee: convertCurrency(result.fee, srcCur, displayCurrency),
          totalDebit: convertCurrency(result.totalDebit, srcCur, displayCurrency),
          counterparty: req.toAccountName,
          counterpartyAccount: req.toAccountNumber,
          counterpartyBank: req.toBankName,
          status: result.status,
          meta: [
            { label: "From account", value: fromAccount?.nickname ?? "Account" },
            { label: "Arrival", value: preview.estimatedArrival },
          ],
        };
        setReceipt(rcpt);
        setReceiptOpen(true);
        toast({ title: "Transfer successful", description: result.reference });
        resetForm();
      } else {
        toast({
          title: "Transfer failed",
          description: res.error ?? "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setToBankName("OceanSky Bank");
    setBeneficiaryPick("new");
    setToAccountNumber("");
    setToAccountName("");
    setSaveBeneficiary(false);
    setBeneficiaryNickname("");
    setAmount(0);
    setDescription("");
    setPreview(INITIAL_PREVIEW);
  }

  function prefillFromBeneficiary(b: Beneficiary) {
    setToBankName(b.bankName);
    setBeneficiaryPick(b.id);
    setToAccountNumber(b.accountNumber);
    setToAccountName(b.accountName);
    setSaveBeneficiary(false);
    setBeneficiaryNickname("");
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (!user) {
    return (
      <EmptyState
        title="Sign in required"
        description="Please sign in to your OceanSky account to make transfers."
        icon={Wallet}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfers"
        description="Send money to any bank instantly."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* =========================================================== */}
        {/* LEFT — Transfer form (spans 2 cols on desktop)              */}
        {/* =========================================================== */}
        <div className="lg:col-span-2">
          <SectionCard title="New transfer" icon={Send}>
            <div className="space-y-5">
              {/* From account */}
              <div className="space-y-2">
                <Label htmlFor="from-account">From account</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger id="from-account" className="w-full">
                    <SelectValue placeholder="Select source account" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingRef && accounts.length === 0 ? (
                      <SelectItem value="__loading" disabled>
                        Loading accounts…
                      </SelectItem>
                    ) : accounts.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No accounts available
                      </SelectItem>
                    ) : (
                      accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="truncate">
                              {a.nickname ?? a.accountType} · {maskAccountNumber(a.accountNumber)}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatMoneyDisplay(a.availableBalance, a.currency)}
                            </span>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {fromAccount && (
                  <p className="text-xs text-muted-foreground">
                    Available:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatMoneyDisplay(fromAccount.availableBalance, fromAccount.currency)}
                    </span>
                  </p>
                )}
              </div>

              {/* To bank */}
              <div className="space-y-2">
                <Label htmlFor="to-bank">To bank</Label>
                <Select value={toBankName} onValueChange={(v) => { setToBankName(v); setBeneficiaryPick("new"); }}>
                  <SelectTrigger id="to-bank" className="w-full">
                    <SelectValue placeholder="Select destination bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.value}
                        {b.value === "OceanSky Bank" && (
                          <span className="ml-2 text-xs text-muted-foreground">(internal)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Beneficiary picker */}
              <div className="space-y-2">
                <Label>
                  {isInternal ? "Select beneficiary" : "Select saved beneficiary"}
                </Label>
                <Select value={beneficiaryPick} onValueChange={setBeneficiaryPick}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">
                      {isInternal ? "Enter new account" : "Enter new recipient"}
                    </SelectItem>
                    {filteredBeneficiaries.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.nickname} · {maskAccountNumber(b.accountNumber)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* New recipient fields — shown when "new" picked (always for external w/ no saved ben) */}
              {beneficiaryPick === "new" && (
                <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="acct-number">Account number</Label>
                      <Input
                        id="acct-number"
                        inputMode="numeric"
                        placeholder="e.g. 0123456789"
                        value={toAccountNumber}
                        onChange={(e) =>
                          setToAccountNumber(e.target.value.replace(/[^\d]/g, ""))
                        }
                        maxLength={10}
                        className="tabular-nums"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="acct-name">Account name</Label>
                      <Input
                        id="acct-name"
                        placeholder="Recipient full name"
                        value={toAccountName}
                        onChange={(e) => setToAccountName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="save-ben"
                        checked={saveBeneficiary}
                        onCheckedChange={(v) => setSaveBeneficiary(v === true)}
                      />
                      <Label htmlFor="save-ben" className="text-sm font-normal cursor-pointer">
                        Save as beneficiary
                      </Label>
                    </div>
                    {saveBeneficiary && (
                      <Input
                        placeholder="Nickname (e.g. Mum, Landlord)"
                        value={beneficiaryNickname}
                        onChange={(e) => setBeneficiaryNickname(e.target.value)}
                        className="sm:max-w-xs"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="space-y-2">
                <Label>Amount</Label>
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  currency={fromAccount?.currency ?? "USD"}
                  min={0}
                  quickAmounts={QUICK_AMOUNTS}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="desc">Description</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {description.length}/{MAX_DESC}
                  </span>
                </div>
                <Input
                  id="desc"
                  placeholder="What is this transfer for? (optional)"
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value.slice(0, MAX_DESC))
                  }
                  maxLength={MAX_DESC}
                />
              </div>

              {/* Live preview */}
              <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount</p>
                    <p className="font-semibold tabular-nums">
                      {formatMoneyDisplay(amount, fromAccount?.currency ?? "USD")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Fee</p>
                    <p className="font-semibold tabular-nums">
                      {preview.loading ? "…" : formatMoneyDisplay(preview.fee, fromAccount?.currency ?? "USD")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Total debit</p>
                    <p className="font-bold text-teal tabular-nums">
                      {preview.loading
                        ? "…"
                        : formatMoneyDisplay(preview.totalDebit, fromAccount?.currency ?? "USD")}
                    </p>
                  </div>
                </div>
                <Separator className="my-3 bg-teal/15" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span>Estimated arrival: <span className="font-medium text-foreground">{preview.estimatedArrival}</span></span>
                </div>
              </div>

              {/* Continue */}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={resetForm} type="button">
                  Clear
                </Button>
                <Button
                  type="button"
                  onClick={handleContinue}
                  disabled={submitting || amount <= 0 || !fromAccountId}
                  className="bg-teal text-white hover:bg-teal/90"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* =========================================================== */}
        {/* RIGHT — Beneficiaries + Recent transfers                    */}
        {/* =========================================================== */}
        <div className="space-y-6">
          {/* Saved beneficiaries */}
          <SectionCard
            title="Saved beneficiaries"
            icon={Users}
            action={
              <Button variant="link" size="sm" className="text-teal p-0" onClick={() => go("/beneficiaries")}>
                Manage
              </Button>
            }
          >
            {beneficiaries.length === 0 ? (
              <EmptyState
                title="No beneficiaries yet"
                description="Saved recipients will appear here for one-tap transfers."
                icon={Users}
                action={
                  <Button variant="outline" size="sm" onClick={() => go("/beneficiaries")}>
                    <Plus className="size-4" />
                    Add beneficiary
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                {beneficiaries.slice(0, 6).map((b) => {
                  const tint = avatarTint(b.nickname + b.id);
                  return (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40"
                    >
                      <div
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
                          tint.bg,
                          tint.fg
                        )}
                      >
                        {initialsOf(b.nickname || b.accountName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{b.nickname}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.accountName} · {maskAccountNumber(b.accountNumber)}
                        </p>
                        <p className="text-xs text-muted-foreground">{b.bankName}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-teal text-white hover:bg-teal/90"
                        onClick={() => prefillFromBeneficiary(b)}
                      >
                        Send
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Recent transfers */}
          <SectionCard title="Recent transfers" icon={ArrowRight}>
            {recentTxns.length === 0 ? (
              <EmptyState
                title="No transfers yet"
                description="Your most recent transfer_out transactions will show here."
                icon={ArrowRight}
              />
            ) : (
              <ul className="space-y-2">
                {recentTxns.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-1 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.counterparty ?? t.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {timeAgo(t.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">
                        -{formatMoneyDisplay(t.amount, t.currency)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize",
                          t.status === "success"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : t.status === "pending"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                        )}
                      >
                        {t.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmTransfer}
        title="Confirm transfer"
        description="Please review the details below before you proceed."
        confirmLabel={submitting ? "Sending…" : "Send money"}
        variant="success"
      >
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
          <dl className="grid grid-cols-3 gap-y-2">
            <dt className="text-muted-foreground">From</dt>
            <dd className="col-span-2 font-medium">
              {fromAccount?.nickname ?? "—"}
              <span className="ml-1 text-xs text-muted-foreground">
                ({fromAccount ? maskAccountNumber(fromAccount.accountNumber) : ""})
              </span>
            </dd>
            <dt className="text-muted-foreground">Recipient</dt>
            <dd className="col-span-2 font-medium">
              {toAccountName || "—"}
              <span className="ml-1 text-xs text-muted-foreground">
                ({toAccountNumber ? maskAccountNumber(toAccountNumber) : ""})
              </span>
            </dd>
            <dt className="text-muted-foreground">Bank</dt>
            <dd className="col-span-2 font-medium">{toBankName}</dd>
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="col-span-2 font-medium tabular-nums">
              {formatMoneyDisplay(amount, fromAccount?.currency ?? "USD")}
            </dd>
            <dt className="text-muted-foreground">Fee</dt>
            <dd className="col-span-2 font-medium tabular-nums">
              {formatMoneyDisplay(preview.fee, fromAccount?.currency ?? "USD")}
            </dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="col-span-2 font-bold text-teal tabular-nums">
              {formatMoneyDisplay(preview.totalDebit, fromAccount?.currency ?? "USD")}
            </dd>
            <dt className="text-muted-foreground">Arrival</dt>
            <dd className="col-span-2 font-medium">{preview.estimatedArrival}</dd>
          </dl>
        </div>
      </ConfirmDialog>

      {/* Receipt modal */}
      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        data={receipt}
        title="Transfer receipt"
      />
    </div>
  );
}
