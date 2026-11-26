"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Snowflake,
  Power,
  Ban,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  CalendarDays,
  Landmark,
  Wallet,
  Receipt,
  Headset,
  CreditCard,
  History,
  Lock,
  Unlock,
} from "lucide-react";
import { services } from "@/lib/services";
import type {
  Account,
  BankCard,
  SupportTicket,
  Transaction,
  User,
} from "@/lib/types";
import { useRouterStore } from "@/lib/router";
import {
  formatMoney,
  formatDate,
  formatDateTime,
  timeAgo,
  initials,
} from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { SectionCard } from "@/components/shared/SectionCard";
import {
  DataTable,
  MoneyCell,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIER_BADGE: Record<User["tier"], string> = {
  standard: "bg-muted text-muted-foreground",
  premium: "bg-teal/15 text-teal",
  private: "bg-ocean/15 text-ocean",
};

const ACCOUNT_TYPE_LABELS: Record<Account["accountType"], string> = {
  savings: "Savings",
  current: "Current",
  fixed_deposit: "Fixed Deposit",
  domiciliary: "Domiciliary",
  joint: "Joint",
};

interface CustomerData {
  user: User;
  accounts: Account[];
  recentTransactions: Transaction[];
  cards: BankCard[];
  tickets: SupportTicket[];
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  when: string;
  ip: string;
}

export function AdminCustomerProfile() {
  const params = useRouterStore((s) => s.params);
  const go = useRouterStore((s) => s.go);
  const customerId = params[0];

  const [data, setData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "freeze" | "suspend" | "activate"; label: string; title: string }
    | null
  >(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.getCustomer(customerId);
      if (!active) return;
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [customerId]);

  const stats = useMemo(() => {
    if (!data) {
      return { accounts: 0, balance: 0, txns: 0, tickets: 0 };
    }
    const balance = data.accounts.reduce((s, a) => s + a.balance, 0);
    const openTickets = data.tickets.filter((t) =>
      ["open", "pending_agent", "pending_customer", "escalated"].includes(t.status)
    ).length;
    return {
      accounts: data.accounts.length,
      balance,
      txns: data.recentTransactions.length,
      tickets: openTickets,
    };
  }, [data]);

  // Mock audit trail derived from the user record — admin actions.
  const auditTrail = useMemo<AuditEntry[]>(() => {
    if (!data) return [];
    const name = `${data.user.firstName} ${data.user.lastName}`;
    const entries: AuditEntry[] = [];
    const now = Date.now();
    const ago = (h: number) => new Date(now - h * 3600_000).toISOString();
    if (data.user.status === "active") {
      entries.push({
        id: "au-1",
        action: `Account activated for ${name}`,
        actor: "Daniel Okoro",
        when: ago(48),
        ip: "10.20.30.40",
      });
    }
    if (data.user.status === "locked") {
      entries.push({
        id: "au-2",
        action: `Account frozen for ${name}`,
        actor: "Susan Hayes",
        when: ago(2),
        ip: "10.20.30.41",
      });
    }
    if (data.user.kycVerified) {
      entries.push({
        id: "au-3",
        action: `KYC verification approved for ${name}`,
        actor: "Compliance Bot",
        when: ago(120),
        ip: "10.20.30.42",
      });
    } else {
      entries.push({
        id: "au-3",
        action: `KYC documents requested from ${name}`,
        actor: "Susan Hayes",
        when: ago(6),
        ip: "10.20.30.41",
      });
    }
    entries.push({
      id: "au-4",
      action: `Password reset issued for ${name}`,
      actor: "Support Agent",
      when: ago(312),
      ip: "10.20.30.43",
    });
    return entries.slice(0, 4);
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="p-6">
        <PageHeader title="Customer not found" />
        <EmptyState
          title="We couldn't find that customer"
          description="The customer may have been removed or the link is invalid."
          icon={ShieldAlert}
          action={
            <Button variant="outline" onClick={() => go("/admin/customers")}>
              <ArrowLeft className="size-4" /> Back to customers
            </Button>
          }
        />
      </div>
    );
  }

  const { user } = data;

  async function runAction() {
    if (!confirm || !data) return;
    setActing(true);
    const nextStatus: User["status"] =
      confirm.kind === "freeze"
        ? "locked"
        : confirm.kind === "suspend"
          ? "dormant"
          : "active";
    const res = await services.admin.toggleCustomerStatus(data.user.id, nextStatus);
    setActing(false);
    if (res.ok && res.data) {
      setData((prev) =>
        prev ? { ...prev, user: { ...prev.user, status: res.data!.status } } : prev
      );
      toast.success(`${data.user.firstName} ${data.user.lastName} is now ${res.data.status}.`);
    } else {
      toast.error(res.error || "Action failed.");
    }
    setConfirm(null);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={`Customer ID · ${user.id}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => go("/admin/customers")}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        }
      />

      {/* Hero */}
      <SectionCard className="overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-16 ring-2 ring-teal/30">
              <AvatarFallback className="bg-teal/15 text-teal text-lg font-bold">
                {initials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">
                  {user.firstName} {user.lastName}
                </h2>
                <Badge className={cn("capitalize text-[10px]", TIER_BADGE[user.tier])}>
                  {user.tier} tier
                </Badge>
                <StatusBadge status={user.status} />
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 text-[10px]",
                    user.kycVerified
                      ? "border-teal/40 text-teal"
                      : "border-amber-500/40 text-amber-600"
                  )}
                >
                  {user.kycVerified ? (
                    <ShieldCheck className="size-3" />
                  ) : (
                    <ShieldAlert className="size-3" />
                  )}
                  KYC {user.kycVerified ? "Verified" : "Pending"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span className="flex items-center gap-2">
                  <Mail className="size-3.5 text-teal" />
                  {user.email}
                </span>
                <span className="flex items-center gap-2">
                  <Phone className="size-3.5 text-teal" />
                  {user.phone}
                </span>
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-3.5 text-teal" />
                  Member since {formatDate(user.createdAt)}
                </span>
                <span className="flex items-center gap-2">
                  <Briefcase className="size-3.5 text-teal" />
                  {user.occupation || "—"}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-teal" />
                  {user.nationality}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="size-3.5 text-teal" />
                  {user.address
                    ? `${user.address.city}, ${user.address.country}`
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setConfirm({
                  kind: "freeze",
                  label:
                    user.status === "locked" ? "Unfreeze account" : "Freeze account",
                  title:
                    user.status === "locked"
                      ? "Unfreeze this customer?"
                      : "Freeze this customer?",
                })
              }
              disabled={user.status === "locked"}
            >
              <Snowflake className="size-4" />
              {user.status === "locked" ? "Frozen" : "Freeze"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setConfirm({
                  kind: "suspend",
                  label: "Suspend account",
                  title: "Suspend this customer?",
                })
              }
              disabled={user.status === "dormant"}
            >
              <Ban className="size-4" />
              {user.status === "dormant" ? "Suspended" : "Suspend"}
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-teal text-white hover:bg-teal/90"
              onClick={() =>
                setConfirm({
                  kind: "activate",
                  label: "Activate account",
                  title: "Activate this customer?",
                })
              }
              disabled={user.status === "active"}
            >
              <Power className="size-4" />
              {user.status === "active" ? "Active" : "Activate"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Accounts" value={stats.accounts} icon={Landmark} accent="teal" />
        <StatCard
          label="Total Balance"
          value={formatMoney(stats.balance, "USD")}
          icon={Wallet}
          accent="turquoise"
        />
        <StatCard
          label="Transactions (recent)"
          value={stats.txns}
          icon={Receipt}
          accent="ocean"
        />
        <StatCard label="Open Tickets" value={stats.tickets} icon={Headset} accent="muted" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="accounts" className="w-full">
        <div className="overflow-x-auto scrollbar-thin">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="accounts" className="gap-1.5">
              <Landmark className="size-3.5" /> Accounts
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5">
              <Receipt className="size-3.5" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="cards" className="gap-1.5">
              <CreditCard className="size-3.5" /> Cards
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-1.5">
              <Headset className="size-3.5" /> Support
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <History className="size-3.5" /> Audit Trail
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="accounts" className="mt-4">
          <AccountsTab accounts={data.accounts} />
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <TransactionsTab transactions={data.recentTransactions} />
        </TabsContent>
        <TabsContent value="cards" className="mt-4">
          <CardsTab cards={data.cards} />
        </TabsContent>
        <TabsContent value="tickets" className="mt-4">
          <TicketsTab tickets={data.tickets} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTrailTab entries={auditTrail} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runAction}
        title={confirm?.title || ""}
        description="This action will update the customer's account status immediately."
        confirmLabel={confirm?.label || "Confirm"}
        variant={confirm?.kind === "activate" ? "success" : "danger"}
      >
        {acting ? (
          <p className="text-muted-foreground">Processing...</p>
        ) : (
          <p className="text-muted-foreground">
            A record of this action will be added to the audit trail.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tab: Accounts
// ----------------------------------------------------------------------------
function AccountsTab({ accounts }: { accounts: Account[] }) {
  const columns: Column<Account>[] = [
    {
      key: "number",
      header: "Account Number",
      render: (a) => <span className="font-mono text-xs">{a.accountNumber}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (a) => (
        <Badge variant="outline" className="capitalize text-[10px]">
          {ACCOUNT_TYPE_LABELS[a.accountType]}
        </Badge>
      ),
    },
    {
      key: "currency",
      header: "Currency",
      className: "hidden sm:table-cell",
      render: (a) => <span className="text-xs">{a.currency}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      render: (a) => (
        <span className="font-semibold tabular-nums">
          {formatMoney(a.balance, a.currency)}
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
      className: "hidden md:table-cell",
      render: (a) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(a.openedAt)}
        </span>
      ),
    },
  ];

  if (accounts.length === 0) {
    return (
      <SectionCard title="Accounts" description="Customer's bank accounts">
        <EmptyState
          title="No accounts"
          description="This customer does not hold any accounts yet."
          icon={Landmark}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Accounts" description={`${accounts.length} account(s)`}>
      <DataTable<Account> columns={columns} rows={accounts} />
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Tab: Transactions
// ----------------------------------------------------------------------------
function TransactionsTab({ transactions }: { transactions: Transaction[] }) {
  const columns: Column<Transaction>[] = [
    {
      key: "date",
      header: "Date",
      className: "whitespace-nowrap",
      render: (t) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(t.createdAt)}
        </span>
      ),
    },
    {
      key: "desc",
      header: "Description",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{t.description}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {t.reference}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      className: "hidden sm:table-cell",
      render: (t) => (
        <Badge variant="outline" className="capitalize text-[10px]">
          {t.type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (t) => (
        <MoneyCell
          amount={t.direction === "in" ? Math.abs(t.amount) : -Math.abs(t.amount)}
          currency={t.currency}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => <StatusBadge status={t.status} />,
    },
  ];

  if (transactions.length === 0) {
    return (
      <SectionCard title="Transactions" description="Recent activity">
        <EmptyState
          title="No transactions"
          description="There are no recent transactions for this customer."
          icon={Receipt}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Recent Transactions"
      description={`Last ${transactions.length} transaction(s)`}
    >
      <DataTable<Transaction> columns={columns} rows={transactions} />
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Tab: Cards
// ----------------------------------------------------------------------------
function CardsTab({ cards }: { cards: BankCard[] }) {
  if (cards.length === 0) {
    return (
      <SectionCard title="Cards" description="Cards linked to this customer">
        <EmptyState
          title="No cards"
          description="This customer has not requested any cards yet."
          icon={CreditCard}
        />
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Cards" description={`${cards.length} card(s)`}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <CardItem key={card.id} card={card} />
        ))}
      </div>
    </SectionCard>
  );
}

function CardItem({ card }: { card: BankCard }) {
  const isLocked = card.status === "locked" || card.status === "blocked";
  return (
    <div className="rounded-xl border border-border/60 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm tracking-wider">{card.maskedPan}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {card.holderName} · {card.type} · {card.brand.toUpperCase()}
          </p>
        </div>
        <StatusBadge status={card.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Exp {card.expiryMonth}/{card.expiryYear}
        </span>
        <span>
          Spending {formatMoney(card.spendingThisMonth, "USD")}
        </span>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => toast.info(`${isLocked ? "Unlock" : "Lock"} requested for ${card.maskedPan}`)}
        >
          {isLocked ? (
            <>
              <Unlock className="size-3.5" /> Unlock
            </>
          ) : (
            <>
              <Lock className="size-3.5" /> Lock
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tab: Support Tickets
// ----------------------------------------------------------------------------
function TicketsTab({ tickets }: { tickets: SupportTicket[] }) {
  const columns: Column<SupportTicket>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{t.subject}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {t.category}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      className: "hidden sm:table-cell",
      render: (t) => (
        <Badge variant="outline" className="text-[10px] capitalize">
          {t.category}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: "priority",
      header: "Priority",
      render: (t) => <StatusBadge status={t.priority} />,
    },
    {
      key: "updated",
      header: "Last Update",
      className: "hidden md:table-cell",
      render: (t) => (
        <span className="text-xs text-muted-foreground">
          {timeAgo(t.updatedAt)}
        </span>
      ),
    },
  ];

  if (tickets.length === 0) {
    return (
      <SectionCard title="Support Tickets" description="Customer's tickets">
        <EmptyState
          title="No support tickets"
          description="This customer has not raised any tickets."
          icon={Headset}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Support Tickets" description={`${tickets.length} ticket(s)`}>
      <DataTable<SupportTicket> columns={columns} rows={tickets} />
    </SectionCard>
  );
}

// ----------------------------------------------------------------------------
// Tab: Audit Trail
// ----------------------------------------------------------------------------
function AuditTrailTab({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <SectionCard title="Audit Trail" description="Recent admin actions">
        <EmptyState
          title="No audit entries"
          description="No admin actions have been recorded for this customer."
          icon={History}
        />
      </SectionCard>
    );
  }
  return (
    <SectionCard title="Audit Trail" description="Recent admin actions on this customer">
      <ul className="space-y-1">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40"
          >
            <Avatar className="size-8 ring-1 ring-border/60 mt-0.5">
              <AvatarFallback className="bg-teal/15 text-teal text-[10px] font-semibold">
                {actorInitials(e.actor)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{e.action}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>by {e.actor}</span>
                <span>·</span>
                <span>{timeAgo(e.when)}</span>
                <span>·</span>
                <span className="font-mono">{e.ip}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() || "—";
}
