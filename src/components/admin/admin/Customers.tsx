"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  Clock,
  Ban,
  Search,
  Download,
  MoreHorizontal,
  Eye,
  Snowflake,
  Power,
  UserRound,
} from "lucide-react";
import { services } from "@/lib/services";
import type { User } from "@/lib/types";
import { useRouterStore } from "@/lib/router";
import { formatMoney, initials, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import {
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CustomerRow = User & {
  accountCount: number;
  totalBalance: number;
  lastLoginAt?: string;
};

const TIER_BADGE: Record<User["tier"], string> = {
  standard: "bg-muted text-muted-foreground",
  premium: "bg-teal/15 text-teal",
  private: "bg-ocean/15 text-ocean",
};

const TIER_TABS = [
  { value: "all", label: "All" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "private", label: "Private" },
] as const;

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending KYC" },
  { value: "locked", label: "Locked" },
  { value: "dormant", label: "Dormant" },
] as const;

export function AdminCustomers() {
  const go = useRouterStore((s) => s.go);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.listCustomers();
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
    const pendingCount = rows.filter((r) => r.status === "pending").length;
    const lockedDormant = rows.filter(
      (r) => r.status === "locked" || r.status === "dormant"
    ).length;
    return { total, activeCount, pendingCount, lockedDormant };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tier !== "all" && r.tier !== tier) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      const name = `${r.firstName} ${r.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q)
      );
    });
  }, [rows, search, tier, status]);

  const columns: Column<CustomerRow>[] = [
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-teal/15 text-teal text-xs font-semibold">
              {initials(row.firstName, row.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.firstName} {row.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      render: (row) => (
        <Badge
          className={cn("capitalize text-[10px]", TIER_BADGE[row.tier])}
        >
          {row.tier}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "accounts",
      header: "Accounts",
      className: "hidden sm:table-cell text-center",
      render: (row) => (
        <span className="tabular-nums">{row.accountCount}</span>
      ),
    },
    {
      key: "balance",
      header: "Total Balance",
      render: (row) => (
        <span className="font-semibold tabular-nums text-foreground">
          {formatMoney(row.totalBalance, "USD")}
        </span>
      ),
    },
    {
      key: "lastLogin",
      header: "Last Login",
      className: "hidden md:table-cell",
      render: (row) =>
        row.lastLoginAt ? (
          <span className="text-xs text-muted-foreground">
            {timeAgo(row.lastLoginAt)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Never</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
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
                aria-label="Open actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => go(`/admin/customers/${row.id}`)}>
                <Eye className="size-4" /> View profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleFreeze(row)}
                disabled={row.status === "locked"}
              >
                <Snowflake className="size-4" />
                {row.status === "locked" ? "Frozen" : "Freeze account"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleActivate(row)}
                disabled={row.status === "active"}
              >
                <Power className="size-4" />
                {row.status === "active" ? "Active" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  async function handleFreeze(row: CustomerRow) {
    const res = await services.admin.toggleCustomerStatus(row.id, "locked");
    if (res.ok && res.data) {
      setRows((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, status: res.data!.status } : p))
      );
      toast.success(`${row.firstName} ${row.lastName} has been frozen.`);
    } else {
      toast.error(res.error || "Failed to freeze customer.");
    }
  }

  async function handleActivate(row: CustomerRow) {
    const res = await services.admin.toggleCustomerStatus(row.id, "active");
    if (res.ok && res.data) {
      setRows((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, status: res.data!.status } : p))
      );
      toast.success(`${row.firstName} ${row.lastName} has been activated.`);
    } else {
      toast.error(res.error || "Failed to activate customer.");
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Customer Management"
        description="Search, review and manage every OceanSky customer."
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
        <StatCard label="Total Customers" value={stats.total} icon={Users} accent="teal" />
        <StatCard label="Active" value={stats.activeCount} icon={UserCheck} accent="turquoise" />
        <StatCard label="Pending KYC" value={stats.pendingCount} icon={Clock} accent="ocean" />
        <StatCard label="Locked / Dormant" value={stats.lockedDormant} icon={Ban} accent="muted" />
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={tier} onValueChange={setTier}>
              <TabsList>
                {TIER_TABS.map((t) => (
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
          <DataTable<CustomerRow>
            columns={columns}
            rows={filtered}
            loading={loading}
            emptyTitle="No customers found"
            emptyDescription="Try adjusting your search or filters."
            emptyIcon={UserRound}
            onRowClick={(row) => go(`/admin/customers/${row.id}`)}
          />
        </div>
      </div>
    </div>
  );
}
