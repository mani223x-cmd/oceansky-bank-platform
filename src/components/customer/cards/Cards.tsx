"use client";

// ============================================================================
// OceanSky Bank — Cards (customer)
// ----------------------------------------------------------------------------
// Lists the customer's virtual and physical cards as large credit-card
// visuals with per-card actions (Manage, Lock/Unlock, Details) and a full
// management Sheet (Channels / Limits / Activity / Settings). A "Request new
// card" dialog allows mock-creating a synthetic card for visual feedback.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CreditCard,
  Lock,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Snowflake,
  TrendingUp,
  Unlock,
  Wallet,
  Wifi,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import { formatMoneyDisplay, formatDate, type CurrencyCode } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type {
  Account,
  BankCard,
  CardBrand,
  CardTransaction,
  CardType,
} from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const COLOR_GRADIENTS: Record<BankCard["color"], string> = {
  teal: "from-teal to-ocean",
  ocean: "from-ocean to-teal-dark",
  sand: "from-amber-500 to-amber-700",
  graphite: "from-slate-700 to-slate-900",
};

const BRAND_TEXT: Record<CardBrand, string> = {
  visa: "VISA",
  mastercard: "Mastercard",
  verve: "Verve",
};

const BRAND_FONT: Record<CardBrand, string> = {
  visa: "italic font-black tracking-tight text-lg",
  mastercard: "font-bold tracking-tight text-base",
  verve: "font-bold tracking-tight text-base",
};

type ChannelKey = "online" | "contactless" | "atm" | "pos";

// ----------------------------------------------------------------------------
// Cards — main view
// ----------------------------------------------------------------------------
export function Cards() {
  const user = useAuthStore((s) => s.user);

  // Data state
  const [cards, setCards] = useState<BankCard[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep latest cards in a ref so the open-sheet effect can read current
  // limits without re-running on every toggle.
  const cardsRef = useRef<BankCard[]>([]);
  cardsRef.current = cards;

  // Request new card dialog state
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqType, setReqType] = useState<CardType>("virtual");
  const [reqBrand, setReqBrand] = useState<CardBrand>("visa");
  const [reqAccountId, setReqAccountId] = useState<string>("");
  const [reqDaily, setReqDaily] = useState<number>(200_000);
  const [reqMonthly, setReqMonthly] = useState<number>(1_000_000);

  // Management sheet state
  const [manageCardId, setManageCardId] = useState<string | null>(null);
  const [txns, setTxns] = useState<CardTransaction[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("channels");
  const [dailyDraft, setDailyDraft] = useState(0);
  const [monthlyDraft, setMonthlyDraft] = useState(0);
  const [limitsDirty, setLimitsDirty] = useState(false);

  // Confirm dialog state
  const [confirmLock, setConfirmLock] = useState<{ id: string; lock: boolean } | null>(null);
  const [confirmFreeze, setConfirmFreeze] = useState<string | null>(null);
  const [confirmLost, setConfirmLost] = useState<string | null>(null);

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [c, a] = await Promise.all([
          services.card.listByUser(user.id),
          services.account.listByUser(user.id),
        ]);
        if (cancelled) return;
        if (c.ok && c.data) setCards(c.data);
        if (a.ok && a.data) {
          setAccounts(a.data);
          if (a.data[0]) setReqAccountId(a.data[0].id);
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

  // ---- When management sheet opens, load transactions + seed limit drafts ----
  useEffect(() => {
    if (!manageCardId) return;
    let cancelled = false;
    async function load() {
      setTxnsLoading(true);
      setTxns([]);
      setActiveTab("channels");
      try {
        const res = await services.card.transactions(manageCardId);
        if (cancelled) return;
        if (res.ok && res.data) setTxns(res.data);
      } finally {
        if (!cancelled) setTxnsLoading(false);
      }
      const c = cardsRef.current.find((x) => x.id === manageCardId);
      if (c) {
        setDailyDraft(c.dailyLimit);
        setMonthlyDraft(c.monthlyLimit);
        setLimitsDirty(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [manageCardId]);

  if (!user) {
    return (
      <EmptyState
        title="Sign in required"
        description="Please sign in to view your cards."
        icon={CreditCard}
      />
    );
  }

  const activeCount = cards.filter((c) => c.status === "active").length;
  const lockedCount = cards.filter(
    (c) => c.status === "locked" || c.status === "frozen"
  ).length;
  const totalSpent = cards.reduce((sum, c) => sum + c.spendingThisMonth, 0);

  const managedCard = cards.find((c) => c.id === manageCardId) || null;

  // ---- Handlers ----
  async function handleToggleLock(id: string, lock: boolean) {
    const res = await services.card.toggleLock(id, lock);
    if (res.ok && res.data) {
      setCards((prev) => prev.map((c) => (c.id === id ? res.data! : c)));
      toast({
        title: lock ? "Card locked" : "Card unlocked",
        description: lock
          ? "All card transactions are now paused."
          : "Card is now active.",
      });
    } else {
      toast({
        title: "Action failed",
        description: res.error,
        variant: "destructive",
      });
    }
    setConfirmLock(null);
  }

  async function handleToggleChannel(
    id: string,
    channel: ChannelKey,
    enabled: boolean
  ) {
    const res = await services.card.toggleChannel(id, channel, enabled);
    if (res.ok && res.data) {
      setCards((prev) => prev.map((c) => (c.id === id ? res.data! : c)));
      toast({
        title: enabled ? "Channel enabled" : "Channel disabled",
        description: `${channelLabel(channel)} ${enabled ? "is now on" : "has been turned off"}.`,
      });
    } else {
      toast({
        title: "Could not update channel",
        description: res.error,
        variant: "destructive",
      });
    }
  }

  async function handleSaveLimits(id: string) {
    if (monthlyDraft < dailyDraft) {
      toast({
        title: "Invalid limits",
        description: "Monthly limit must be greater than or equal to daily limit.",
        variant: "destructive",
      });
      return;
    }
    const res = await services.card.updateLimits(id, dailyDraft, monthlyDraft);
    if (res.ok && res.data) {
      setCards((prev) => prev.map((c) => (c.id === id ? res.data! : c)));
      setLimitsDirty(false);
      toast({ title: "Limits updated" });
    } else {
      toast({
        title: "Could not save limits",
        description: res.error,
        variant: "destructive",
      });
    }
  }

  async function handleFreeze(id: string) {
    const res = await services.card.toggleLock(id, true);
    if (res.ok && res.data) {
      setCards((prev) => prev.map((c) => (c.id === id ? res.data! : c)));
      toast({
        title: "Card frozen",
        description: "All transactions are blocked. Contact support to unfreeze.",
      });
      setManageCardId(null);
    }
    setConfirmFreeze(null);
  }

  function handleReportLost(card: BankCard) {
    setConfirmLost(null);
    toast({
      title: "Card reported lost",
      description: `${card.maskedPan} has been permanently blocked. A replacement will be issued.`,
      variant: "destructive",
    });
    setManageCardId(null);
  }

  function handleReplacement(card: BankCard) {
    toast({
      title: "Replacement requested",
      description: `A new ${BRAND_TEXT[card.brand]} ${card.type} card will be delivered within 5 business days.`,
    });
  }

  function handleRequestNewCard(e: React.FormEvent) {
    e.preventDefault();
    if (!reqAccountId) {
      toast({
        title: "Select an account",
        description: "Please choose a linked account for this card.",
        variant: "destructive",
      });
      return;
    }
    if (reqMonthly < reqDaily) {
      toast({
        title: "Invalid limits",
        description: "Monthly limit must be greater than or equal to daily limit.",
        variant: "destructive",
      });
      return;
    }
    // Build a synthetic card to prepend for visual feedback (mock only)
    const last4 = String(1000 + Math.floor(Math.random() * 9000));
    const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
    const year = String(28 + Math.floor(Math.random() * 3));
    const synthetic: BankCard = {
      id: `card_new_${Date.now()}`,
      userId: user.id,
      accountId: reqAccountId,
      type: reqType,
      brand: reqBrand,
      maskedPan: `•••• •••• •••• ${last4}`,
      expiryMonth: month,
      expiryYear: year,
      cvvMasked: "•••",
      holderName: `${user.firstName} ${user.lastName}`.toUpperCase(),
      status: "active",
      color: "teal",
      dailyLimit: reqDaily,
      monthlyLimit: reqMonthly,
      spendingThisMonth: 0,
      onlineEnabled: true,
      contactlessEnabled: reqType === "physical",
      atmEnabled: reqType === "physical",
      posEnabled: true,
      createdAt: new Date().toISOString(),
    };
    setCards((prev) => [synthetic, ...prev]);
    setRequestOpen(false);
    toast({
      title: "Card request submitted",
      description: "Your new card will arrive in 5-7 business days.",
    });
    // Reset form
    setReqType("virtual");
    setReqBrand("visa");
    setReqDaily(200_000);
    setReqMonthly(1_000_000);
  }

  // ---- Card transaction table columns ----
  const cardTxnColumns: Column<CardTransaction>[] = [
    {
      key: "date",
      header: "Date",
      render: (t) => (
        <span className="text-muted-foreground">{formatDate(t.createdAt, "d MMM")}</span>
      ),
    },
    {
      key: "merchant",
      header: "Merchant",
      render: (t) => (
        <div className="flex flex-col">
          <span className="font-medium">{t.merchant}</span>
          {t.location && (
            <span className="text-xs text-muted-foreground">{t.location}</span>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (t) => (
        <Badge variant="outline" className="capitalize">
          {t.category}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (t) => (
        <span className="font-medium tabular-nums">
          -{formatMoneyDisplay(t.amount, t.currency as CurrencyCode)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => <StatusBadge status={t.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cards"
        description="Manage your virtual and physical OceanSky cards."
        actions={
          <Button
            onClick={() => setRequestOpen(true)}
            className="bg-teal text-white hover:bg-teal-dark"
          >
            <Plus className="size-4" />
            Request new card
          </Button>
        }
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total cards" value={cards.length} icon={CreditCard} accent="teal" />
        <StatCard label="Active" value={activeCount} icon={ShieldCheck} accent="turquoise" />
        <StatCard label="Locked" value={lockedCount} icon={Lock} accent="ocean" />
        <StatCard
          label="Spent this month"
          value={formatMoneyDisplay(totalSpent, "USD")}
          icon={TrendingUp}
          accent="muted"
        />
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          title="No cards yet"
          description="Request a virtual or physical card to get started."
          icon={CreditCard}
          action={
            <Button
              onClick={() => setRequestOpen(true)}
              className="bg-teal text-white hover:bg-teal-dark"
            >
              <Plus className="size-4" />
              Request new card
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cards.map((card) => (
            <CardView
              key={card.id}
              card={card}
              onManage={() => setManageCardId(card.id)}
              onLockToggle={(lock) => setConfirmLock({ id: card.id, lock })}
            />
          ))}
        </div>
      )}

      {/* Request new card dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRequestNewCard}>
            <DialogHeader>
              <DialogTitle>Request a new card</DialogTitle>
              <DialogDescription>
                Choose your card type, brand and spending limits.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Type radio */}
              <div className="space-y-2">
                <Label>Card type</Label>
                <RadioGroup
                  value={reqType}
                  onValueChange={(v) => setReqType(v as CardType)}
                  className="grid grid-cols-2 gap-3"
                >
                  {(["virtual", "physical"] as CardType[]).map((t) => (
                    <label
                      key={t}
                      htmlFor={`req-type-${t}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer text-sm capitalize transition-colors",
                        reqType === t
                          ? "border-teal bg-teal/5 text-teal"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <RadioGroupItem id={`req-type-${t}`} value={t} />
                      {t}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {/* Brand select */}
              <div className="space-y-2">
                <Label htmlFor="req-brand">Brand</Label>
                <Select value={reqBrand} onValueChange={(v) => setReqBrand(v as CardBrand)}>
                  <SelectTrigger id="req-brand" className="w-full">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visa">VISA</SelectItem>
                    <SelectItem value="mastercard">Mastercard</SelectItem>
                    <SelectItem value="verve">Verve</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Linked account */}
              <div className="space-y-2">
                <Label htmlFor="req-account">Linked account</Label>
                <Select value={reqAccountId} onValueChange={setReqAccountId}>
                  <SelectTrigger id="req-account" className="w-full">
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
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="req-daily">Daily limit</Label>
                  <Input
                    id="req-daily"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={reqDaily}
                    onChange={(e) => setReqNumber(e.target.value, setReqDaily)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="req-monthly">Monthly limit</Label>
                  <Input
                    id="req-monthly"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1000}
                    value={reqMonthly}
                    onChange={(e) => setReqNumber(e.target.value, setReqMonthly)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-teal text-white hover:bg-teal-dark">
                Submit request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Management sheet */}
      <Sheet open={!!manageCardId} onOpenChange={(o) => !o && setManageCardId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {managedCard && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <CreditCard className="size-4 text-teal" />
                  Manage card
                </SheetTitle>
                <SheetDescription>
                  {BRAND_TEXT[managedCard.brand]} · {managedCard.type} · {managedCard.maskedPan}
                </SheetDescription>
              </SheetHeader>

              {/* Mini card preview */}
              <div className="px-4">
                <CardFace card={managedCard} compact />
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="channels">Channels</TabsTrigger>
                  <TabsTrigger value="limits">Limits</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                {/* Channels */}
                <TabsContent value="channels" className="space-y-3 mt-4">
                  <ChannelRow
                    icon={Wifi}
                    label="Online payments"
                    description="Web and in-app purchases"
                    checked={managedCard.onlineEnabled}
                    disabled={managedCard.status !== "active"}
                    onChange={(v) => handleToggleChannel(managedCard.id, "online", v)}
                  />
                  <ChannelRow
                    icon={Ban}
                    label="Contactless"
                    description="Tap to pay on POS terminals"
                    checked={managedCard.contactlessEnabled}
                    disabled={managedCard.status !== "active"}
                    onChange={(v) => handleToggleChannel(managedCard.id, "contactless", v)}
                  />
                  <ChannelRow
                    icon={CreditCard}
                    label="ATM"
                    description="Cash withdrawals and balance checks"
                    checked={managedCard.atmEnabled}
                    disabled={managedCard.status !== "active"}
                    onChange={(v) => handleToggleChannel(managedCard.id, "atm", v)}
                  />
                  <ChannelRow
                    icon={Wallet}
                    label="POS"
                    description="In-store terminal payments"
                    checked={managedCard.posEnabled}
                    disabled={managedCard.status !== "active"}
                    onChange={(v) => handleToggleChannel(managedCard.id, "pos", v)}
                  />
                  {managedCard.status !== "active" && (
                    <p className="text-xs text-amber-600 pt-2">
                      Card is currently {managedCard.status}. Unlock it to manage channels.
                    </p>
                  )}
                </TabsContent>

                {/* Limits */}
                <TabsContent value="limits" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="lim-daily">Daily limit</Label>
                      <Input
                        id="lim-daily"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1000}
                        value={dailyDraft}
                        onChange={(e) => {
                          setDailyDraft(Number(e.target.value) || 0);
                          setLimitsDirty(true);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lim-monthly">Monthly limit</Label>
                      <Input
                        id="lim-monthly"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1000}
                        value={monthlyDraft}
                        onChange={(e) => {
                          setMonthlyDraft(Number(e.target.value) || 0);
                          setLimitsDirty(true);
                        }}
                      />
                    </div>
                    <Button
                      onClick={() => handleSaveLimits(managedCard.id)}
                      disabled={!limitsDirty}
                      className="bg-teal text-white hover:bg-teal-dark w-full"
                    >
                      Save limits
                    </Button>
                  </div>

                  <Separator />

                  {/* Spending progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Spending this month</span>
                      <span className="font-medium tabular-nums">
                        {formatMoneyDisplay(managedCard.spendingThisMonth, "USD")}{" "}
                        /{" "}
                        {formatMoneyDisplay(managedCard.monthlyLimit, "USD")}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(
                        100,
                        (managedCard.spendingThisMonth / Math.max(1, managedCard.monthlyLimit)) *
                          100
                      )}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {(
                        (managedCard.spendingThisMonth /
                          Math.max(1, managedCard.monthlyLimit)) *
                        100
                      ).toFixed(1)}
                      % of monthly limit used.
                    </p>
                  </div>
                </TabsContent>

                {/* Activity */}
                <TabsContent value="activity" className="mt-4">
                  <DataTable
                    columns={cardTxnColumns}
                    rows={txns}
                    loading={txnsLoading}
                    emptyTitle="No transactions yet"
                    emptyDescription="Card activity will appear here once you start spending."
                    emptyIcon={CreditCard}
                  />
                </TabsContent>

                {/* Settings */}
                <TabsContent value="settings" className="space-y-3 mt-4">
                  <SettingsAction
                    icon={Snowflake}
                    label="Freeze card"
                    description="Temporarily block all transactions on this card."
                    variant="danger"
                    onClick={() => setConfirmFreeze(managedCard.id)}
                  />
                  <SettingsAction
                    icon={AlertTriangle}
                    label="Report lost / stolen"
                    description="Permanently block the card and request a replacement."
                    variant="danger"
                    onClick={() => setConfirmLost(managedCard.id)}
                  />
                  <SettingsAction
                    icon={RotateCcw}
                    label="Request replacement"
                    description="Get a new card with the same details and limits."
                    variant="default"
                    onClick={() => handleReplacement(managedCard)}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm lock / unlock */}
      <ConfirmDialog
        open={!!confirmLock}
        onClose={() => setConfirmLock(null)}
        onConfirm={() => confirmLock && handleToggleLock(confirmLock.id, confirmLock.lock)}
        title={confirmLock?.lock ? "Lock this card?" : "Unlock this card?"}
        description={
          confirmLock?.lock
            ? "All transactions on this card will be paused. You can unlock it again at any time."
            : "This will restore all card transactions and re-enable previously active channels."
        }
        confirmLabel={confirmLock?.lock ? "Lock card" : "Unlock card"}
        variant={confirmLock?.lock ? "warning" : "success"}
      >
        {managedCard && <p className="font-medium">{managedCard.maskedPan}</p>}
      </ConfirmDialog>

      {/* Confirm freeze */}
      <ConfirmDialog
        open={!!confirmFreeze}
        onClose={() => setConfirmFreeze(null)}
        onConfirm={() => confirmFreeze && handleFreeze(confirmFreeze)}
        title="Freeze this card?"
        description="Freezing blocks every transaction immediately. You will need to contact OceanSky support to unfreeze this card."
        confirmLabel="Freeze card"
        variant="danger"
      >
        {managedCard && <p className="font-medium">{managedCard.maskedPan}</p>}
      </ConfirmDialog>

      {/* Confirm lost / stolen */}
      <ConfirmDialog
        open={!!confirmLost}
        onClose={() => setConfirmLost(null)}
        onConfirm={() => {
          if (!confirmLost) return;
          const card = cards.find((c) => c.id === confirmLost);
          if (card) handleReportLost(card);
        }}
        title="Report card lost or stolen?"
        description="This permanently blocks the card. A replacement will be issued and delivered within 5 business days. This action cannot be undone."
        confirmLabel="Report and block"
        variant="danger"
      >
        {managedCard && <p className="font-medium">{managedCard.maskedPan}</p>}
      </ConfirmDialog>
    </div>
  );

  function setReqNumber(value: string, setter: (n: number) => void) {
    const n = Number(value);
    setter(Number.isFinite(n) && n >= 0 ? n : 0);
  }
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function channelLabel(key: ChannelKey): string {
  switch (key) {
    case "online":
      return "Online payments";
    case "contactless":
      return "Contactless";
    case "atm":
      return "ATM";
    case "pos":
      return "POS";
  }
}

function CardView({
  card,
  onManage,
  onLockToggle,
}: {
  card: BankCard;
  onManage: () => void;
  onLockToggle: (lock: boolean) => void;
}) {
  const isLocked = card.status === "locked" || card.status === "frozen";
  return (
    <div className="space-y-4">
      <CardFace card={card} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onManage}
          className="bg-teal text-white hover:bg-teal-dark"
        >
          <Settings2 className="size-3.5" />
          Manage
        </Button>
        <Button
          variant={isLocked ? "default" : "outline"}
          size="sm"
          onClick={() => onLockToggle(!isLocked)}
          className={isLocked ? "bg-teal text-white hover:bg-teal-dark" : ""}
        >
          {isLocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
          {isLocked ? "Unlock" : "Lock"}
        </Button>
        <Button variant="outline" size="sm" onClick={onManage}>
          Details
        </Button>
      </div>
    </div>
  );
}

function CardFace({ card, compact = false }: { card: BankCard; compact?: boolean }) {
  const gradient = COLOR_GRADIENTS[card.color];
  const masked = card.cvvMasked === "•••";
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg",
        gradient,
        compact ? "aspect-[1.586] max-w-full" : "aspect-[1.586]"
      )}
    >
      {/* Decorative sheen */}
      <div className="absolute -top-12 -right-12 size-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-16 -left-12 size-44 rounded-full bg-black/10 blur-2xl" />

      {/* Status badge — top-left */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
        <CardStatusPill status={card.status} />
      </div>

      {/* Brand logo — top-right */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
        <span className={BRAND_FONT[card.brand]}>{BRAND_TEXT[card.brand]}</span>
      </div>

      {/* Masked PAN — middle */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 sm:px-6 text-center">
        <p className="font-mono tracking-[0.18em] text-base sm:text-xl tabular-nums drop-shadow-sm">
          {card.maskedPan}
        </p>
        {masked && (
          <p className="mt-1.5 text-[10px] uppercase tracking-wider text-white/70">
            Tap card to reveal CVV
          </p>
        )}
      </div>

      {/* Holder name + expiry — bottom-left */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-white/60">Card holder</p>
        <p className="text-xs sm:text-sm font-semibold truncate max-w-[140px] sm:max-w-[180px]">
          {card.holderName}
        </p>
      </div>

      {/* Expiry + type label — bottom-right */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 text-right space-y-0.5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/60">Expires</p>
          <p className="text-xs sm:text-sm font-semibold tabular-nums">
            {card.expiryMonth}/{card.expiryYear}
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-white/70">
          {card.type}
        </p>
      </div>
    </div>
  );
}

function CardStatusPill({ status }: { status: BankCard["status"] }) {
  const map: Record<BankCard["status"], { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-500/25 text-emerald-50 ring-emerald-300/30" },
    locked: { label: "Locked", className: "bg-amber-500/25 text-amber-50 ring-amber-300/30" },
    frozen: { label: "Frozen", className: "bg-amber-500/25 text-amber-50 ring-amber-300/30" },
    expired: { label: "Expired", className: "bg-white/15 text-white/80 ring-white/20" },
    blocked: { label: "Blocked", className: "bg-red-500/25 text-red-50 ring-red-300/30" },
  };
  const cfg = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 backdrop-blur-sm",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

function ChannelRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Wifi;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-center gap-3">
        <div className="grid place-items-center rounded-lg bg-teal/10 size-9 text-teal shrink-0">
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium leading-tight">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function SettingsAction({
  icon: Icon,
  label,
  description,
  variant,
  onClick,
}: {
  icon: typeof Snowflake;
  label: string;
  description: string;
  variant: "danger" | "default";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        variant === "danger"
          ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
          : "border-border/60 hover:bg-muted/40"
      )}
    >
      <div
        className={cn(
          "grid place-items-center rounded-lg size-9 shrink-0",
          variant === "danger"
            ? "bg-destructive/10 text-destructive"
            : "bg-teal/10 text-teal"
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <p
          className={cn(
            "text-sm font-medium leading-tight",
            variant === "danger" && "text-destructive"
          )}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
