"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Activity,
  Download,
  Search,
  ReceiptText,
} from "lucide-react";
import { services } from "@/lib/services";
import type { Transaction, TxnType, TxnStatus } from "@/lib/types";
import { formatMoney, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import {
  DataTable,
  MoneyCell,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ReceiptModal,
  type ReceiptData,
} from "@/components/shared/ReceiptModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type TxnRow = Transaction & { userName: string };

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "credit", label: "Credit" },
  { value: "debit", label: "Debit" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "transfer_out", label: "Transfer Out" },
  { value: "bill_payment", label: "Bill Payment" },
  { value: "airtime", label: "Airtime" },
  { value: "data", label: "Data" },
  { value: "card_payment", label: "Card Payment" },
  { value: "fee", label: "Fee" },
  { value: "interest", label: "Interest" },
  { value: "salary", label: "Salary" },
  { value: "refund", label: "Refund" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "Success" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "reversed", label: "Reversed" },
];

const DATE_TABS = [
  { value: "all", label: "All time" },
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
] as const;

export function AdminTransactions() {
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selected, setSelected] = useState<TxnRow | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.listTransactions();
      if (active && res.ok && res.data) setRows(res.data);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const successCount = rows.filter((r) => r.status === "success").length;
    const pendingCount = rows.filter((r) => r.status === "pending").length;
    const volume = rows
      .filter((r) => r.status === "success")
      .reduce((s, r) => s + r.amount, 0);
    return { total, successCount, pendingCount, volume };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const days =
      dateRange === "all" ? 0 : parseInt(dateRange, 10);
    const cutoff = days ? Date.now() - days * 86400_000 : 0;
    return rows.filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (status !== "all" && r.status !== status) return false;
      if (cutoff && new Date(r.createdAt).getTime() < cutoff) return false;
      if (!q) return true;
      return (
        r.reference.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q) ||
        (r.counterparty || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, type, status, dateRange]);

  const columns: Column<TxnRow>[] = [
    {
      key: "reference",
      header: "Reference",
      className: "whitespace-nowrap",
      render: (t) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {t.reference}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      className: "whitespace-nowrap hidden sm:table-cell",
      render: (t) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(t.createdAt)}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      className: "hidden md:table-cell",
      render: (t) => <span className="text-sm">{t.userName}</span>,
    },
    {
      key: "description",
      header: "Description",
      render: (t) => (
        <div className="min-w-0 max-w-xs">
          <p className="truncate text-sm">{t.description}</p>
          {t.counterparty && (
            <p className="truncate text-[11px] text-muted-foreground">
              {t.counterparty}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      className: "hidden lg:table-cell",
      render: (t) => (
        <Badge variant="outline" className="text-[10px] capitalize">
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
    {
      key: "channel",
      header: "Channel / Counterparty",
      className: "hidden xl:table-cell",
      render: (t) => {
        if (t.counterpartyBank) {
          return (
            <span className="text-xs text-muted-foreground">
              {t.counterpartyBank} · {t.counterparty || "—"}
            </span>
          );
        }
        return (
          <Badge variant="outline" className="text-[10px] capitalize">
            {t.category.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
  ];

  const receiptData = useMemo<ReceiptData | null>(() => {
    if (!selected) return null;
    const isOut = selected.direction === "out";
    const fee = selected.fee ?? 0;
    return {
      reference: selected.reference,
      date: formatDateTime(selected.createdAt),
      description: selected.description,
      amount: Math.abs(selected.amount),
      currency: selected.currency,
      fee: fee > 0 ? fee : undefined,
      totalDebit: isOut && fee > 0 ? Math.abs(selected.amount) + fee : undefined,
      counterparty: selected.counterparty,
      counterpartyAccount: selected.counterpartyAccount,
      counterpartyBank: selected.counterpartyBank,
      status: mapStatusForReceipt(selected.status),
      meta: [
        { label: "Customer", value: selected.userName },
        { label: "Category", value: selected.category },
        { label: "Direction", value: selected.direction === "in" ? "Inflow" : "Outflow" },
      ],
    };
  }, [selected]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Transactions"
        description="Monitor all bank transactions."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("CSV export started.")}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Transactions" value={stats.total} icon={ArrowLeftRight} accent="teal" />
        <StatCard label="Successful" value={stats.successCount} icon={CheckCircle2} accent="turquoise" />
        <StatCard label="Pending" value={stats.pendingCount} icon={Clock} accent="ocean" />
        <StatCard
          label="Total Volume"
          value={formatMoney(stats.volume, "USD")}
          icon={Activity}
          accent="teal"
        />
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reference, description, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger size="sm" className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size="sm" className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={dateRange} onValueChange={setDateRange}>
              <TabsList>
                {DATE_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="p-2 sm:p-4">
          <DataTable<TxnRow>
            columns={columns}
            rows={filtered}
            loading={loading}
            emptyTitle="No transactions found"
            emptyDescription="Try adjusting your filters."
            emptyIcon={ReceiptText}
            onRowClick={(row) => setSelected(row)}
          />
        </div>
      </div>

      <ReceiptModal
        open={!!selected}
        onClose={() => setSelected(null)}
        data={receiptData}
      />
    </div>
  );
}

function mapStatusForReceipt(s: TxnStatus): "success" | "pending" | "failed" {
  if (s === "success") return "success";
  if (s === "pending") return "pending";
  return "failed";
}
