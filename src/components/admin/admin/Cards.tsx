"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Lock,
  Snowflake,
  MoreHorizontal,
  Eye,
  Ban,
  ShoppingBag,
} from "lucide-react";
import { services } from "@/lib/services";
import type { BankCard, CardTransaction } from "@/lib/types";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import {
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CardRow = BankCard & { userName: string; accountNumber: string };

const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "virtual", label: "Virtual" },
  { value: "physical", label: "Physical" },
] as const;

const BRAND_TABS = [
  { value: "all", label: "All" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "verve", label: "Verve" },
] as const;

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "locked", label: "Locked" },
  { value: "frozen", label: "Frozen" },
  { value: "blocked", label: "Blocked" },
] as const;

const BRAND_BADGE: Record<BankCard["brand"], string> = {
  visa: "bg-teal/15 text-teal",
  mastercard: "bg-ocean/15 text-ocean",
  verve: "bg-turquoise/20 text-[oklch(0.45_0.13_180)]",
};

export function AdminCards() {
  const [rows, setRows] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<CardRow | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.listCards();
      if (active && res.ok && res.data) setRows(res.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const activeCount = rows.filter((r) => r.status === "active").length;
    const lockedCount = rows.filter(
      (r) => r.status === "locked" || r.status === "frozen"
    ).length;
    const spending = rows.reduce((s, r) => s + r.spendingThisMonth, 0);
    return { total, activeCount, lockedCount, spending };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (brand !== "all" && r.brand !== brand) return false;
      if (status !== "all" && r.status !== status) return false;
      return true;
    });
  }, [rows, type, brand, status]);

  const columns: Column<CardRow>[] = [
    {
      key: "card",
      header: "Card",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid place-items-center rounded-lg size-9",
              c.type === "virtual"
                ? "bg-turquoise/20 text-[oklch(0.45_0.13_180)]"
                : "bg-teal/15 text-teal"
            )}
          >
            <CreditCard className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm tracking-wider">{c.maskedPan}</p>
            <Badge
              className={cn(
                "mt-0.5 text-[10px] uppercase",
                BRAND_BADGE[c.brand]
              )}
            >
              {c.brand}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: "holder",
      header: "Holder",
      className: "hidden md:table-cell",
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{c.holderName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {c.userName}
          </p>
        </div>
      ),
    },
    {
      key: "account",
      header: "Linked Account",
      className: "hidden lg:table-cell",
      render: (c) => (
        <span className="font-mono text-xs">{c.accountNumber}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (c) => (
        <Badge variant="outline" className="text-[10px] capitalize">
          {c.type}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "dailyLimit",
      header: "Daily Limit",
      className: "hidden lg:table-cell",
      render: (c) => (
        <span className="text-xs tabular-nums">
          {formatMoney(c.dailyLimit, "USD")}
        </span>
      ),
    },
    {
      key: "monthlyLimit",
      header: "Monthly Limit",
      className: "hidden xl:table-cell",
      render: (c) => (
        <span className="text-xs tabular-nums">
          {formatMoney(c.monthlyLimit, "USD")}
        </span>
      ),
    },
    {
      key: "spending",
      header: "Spending (This Month)",
      className: "min-w-[140px]",
      render: (c) => {
        const pct =
          c.monthlyLimit > 0
            ? Math.min(100, Math.round((c.spendingThisMonth / c.monthlyLimit) * 100))
            : 0;
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="tabular-nums font-medium">
                {formatMoney(c.spendingThisMonth, "USD")}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {pct}%
              </span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (c) => (
        <div
          className="flex justify-end"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Open card actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setSelected(c)}>
                <Eye className="size-4" /> View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleToggleLock(c)}
                disabled={c.status === "blocked"}
              >
                {c.status === "locked" ? (
                  <>
                    <Lock className="size-4 opacity-0" />
                    <span className="text-foreground">Unlock card</span>
                  </>
                ) : (
                  <>
                    <Lock className="size-4" /> Lock card
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleBlock(c)}
                disabled={c.status === "blocked"}
                className="text-destructive focus:text-destructive"
              >
                <Ban className="size-4" /> Block card
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  async function handleToggleLock(card: CardRow) {
    const willLock = card.status !== "locked";
    const res = await services.card.toggleLock(card.id, willLock);
    if (res.ok && res.data) {
      setRows((prev) =>
        prev.map((p) =>
          p.id === card.id ? { ...p, ...res.data! } : p
        )
      );
      toast.success(
        `${card.maskedPan} ${willLock ? "locked" : "unlocked"} successfully.`
      );
    } else {
      toast.error(res.error || "Action failed.");
    }
  }

  async function handleBlock(card: CardRow) {
    // Mock block — set status to blocked via toggleLock false but adjust manually
    const res = await services.card.toggleLock(card.id, true);
    if (res.ok) {
      setRows((prev) =>
        prev.map((p) => (p.id === card.id ? { ...p, status: "blocked" } : p))
      );
      toast.success(`${card.maskedPan} has been blocked.`);
    } else {
      toast.error(res.error || "Failed to block card.");
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Cards & Payments"
        description="Manage virtual and physical cards across all customers."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Cards" value={stats.total} icon={CreditCard} accent="teal" />
        <StatCard label="Active" value={stats.activeCount} icon={CheckCircle2} accent="turquoise" />
        <StatCard label="Locked / Frozen" value={stats.lockedCount} icon={Lock} accent="ocean" />
        <StatCard
          label="Spending (This Month)"
          value={formatMoney(stats.spending, "USD")}
          icon={Snowflake}
          accent="teal"
        />
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={type} onValueChange={setType}>
              <TabsList>
                {TYPE_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Tabs value={brand} onValueChange={setBrand}>
              <TabsList>
                {BRAND_TABS.map((t) => (
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
          <DataTable<CardRow>
            columns={columns}
            rows={filtered}
            loading={loading}
            emptyTitle="No cards found"
            emptyDescription="Try adjusting your filters."
            emptyIcon={CreditCard}
            onRowClick={(row) => setSelected(row)}
          />
        </div>
      </div>

      <CardDetailSheet
        card={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Card detail sheet
// ----------------------------------------------------------------------------
function CardDetailSheet({
  card,
  open,
  onClose,
}: {
  card: CardRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [txns, setTxns] = useState<CardTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  useEffect(() => {
    if (!card) return;
    let active = true;
    (async () => {
      setLoadingTxns(true);
      const res = await services.card.transactions(card.id);
      if (!active) return;
      setTxns(res.ok && res.data ? res.data.slice(0, 8) : []);
      setLoadingTxns(false);
    })();
    return () => {
      active = false;
    };
  }, [card]);

  if (!card) return null;

  const pct =
    card.monthlyLimit > 0
      ? Math.min(100, Math.round((card.spendingThisMonth / card.monthlyLimit) * 100))
      : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="size-4 text-teal" />
            {card.maskedPan}
          </SheetTitle>
          <SheetDescription>
            {card.holderName} · {card.userName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={card.status} />
            <Badge variant="outline" className="text-[10px] uppercase">
              {card.brand}
            </Badge>
          </div>

          <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
            <DetailRow label="Type" value={card.type} />
            <DetailRow label="Linked Account" value={card.accountNumber} />
            <DetailRow
              label="Expiry"
              value={`${card.expiryMonth}/${card.expiryYear}`}
            />
            <DetailRow label="CVV" value={card.cvvMasked} />
            <DetailRow
              label="Daily Limit"
              value={formatMoney(card.dailyLimit, "USD")}
            />
            <DetailRow
              label="Monthly Limit"
              value={formatMoney(card.monthlyLimit, "USD")}
            />
            <DetailRow
              label="Issued"
              value={formatDate(card.createdAt)}
            />
          </div>

          <div className="rounded-xl border border-border/60 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Monthly spending
              </span>
              <span className="font-medium tabular-nums">
                {formatMoney(card.spendingThisMonth, "USD")}
              </span>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {pct}% of monthly limit used
            </p>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ShoppingBag className="size-3.5 text-teal" />
              Recent Card Transactions
            </h4>
            {loadingTxns ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : txns.length === 0 ? (
              <EmptyState
                title="No card transactions"
                description="This card has not been used recently."
                icon={ShoppingBag}
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
                      <p className="truncate text-sm">{t.merchant}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.category}
                        {t.location ? ` · ${t.location}` : ""}
                        {" · "}
                        {formatDateTime(t.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-medium tabular-nums">
                        {formatMoney(t.amount, t.currency)}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
