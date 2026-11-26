"use client";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import {
  ScrollText,
  Search,
  Download,
  History,
  Users,
  Flame,
  CalendarIcon,
  Server,
  ShieldAlert,
  FileText,
} from "lucide-react";
import { services } from "@/lib/services";
import type { AuditLogEntry } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import {
  DataTable,
  type Column,
} from "@/components/shared/DataTable";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTOR_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admin" },
  { value: "system", label: "System" },
  { value: "customer", label: "Customer" },
];

const RESOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All resources" },
  { value: "bank_settings", label: "Bank settings" },
  { value: "customer", label: "Customer" },
  { value: "risk_case", label: "Risk case" },
  { value: "support_ticket", label: "Support ticket" },
  { value: "campaign", label: "Campaign" },
  { value: "notifications", label: "Notifications" },
  { value: "transaction", label: "Transaction" },
];

const ACTOR_TYPE_BADGE: Record<AuditLogEntry["actorType"], string> = {
  admin: "bg-teal/15 text-teal",
  system: "bg-muted text-muted-foreground",
  customer: "bg-ocean/15 text-ocean",
};

// Actions considered "high-impact" — counted in stats.
const HIGH_IMPACT_KEYWORDS = [
  "blocked",
  "delete",
  "suspend",
  "updated bank settings",
  "created campaign",
  "broadcast",
  "resolved risk",
  "escalated",
  "auto-flagged",
  "unfrozen",
  "frozen",
];

function isHighImpact(action: string): boolean {
  const lower = action.toLowerCase();
  return HIGH_IMPACT_KEYWORDS.some((k) => lower.includes(k));
}

function isWithinLastDays(iso: string, days: number): boolean {
  const t = parseISO(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 86_400_000;
}

function isToday(iso: string): boolean {
  const d = parseISO(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

// ---------------------------------------------------------------------------
// Metadata renderer
// ---------------------------------------------------------------------------

function MetadataPreview({ metadata }: { metadata?: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const entries = Object.entries(metadata).slice(0, 2);
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map(([k, v]) => (
        <span key={k} className="text-[10px] text-muted-foreground">
          <span className="font-mono text-foreground/80">{k}:</span>{" "}
          {typeof v === "object" ? JSON.stringify(v) : String(v)}
        </span>
      ))}
      {Object.keys(metadata).length > 2 && (
        <span className="text-[10px] text-muted-foreground italic">
          +{Object.keys(metadata).length - 2} more
        </span>
      )}
    </div>
  );
}

function MetadataFull({ metadata }: { metadata?: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
        No metadata recorded for this entry.
      </p>
    );
  }
  const pretty = JSON.stringify(metadata, null, 2);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {Object.entries(metadata).map(([k, v]) => (
          <div
            key={k}
            className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {k}
            </p>
            <p className="text-xs font-medium font-mono break-all">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </p>
          </div>
        ))}
      </div>
      <ScrollArea className="max-h-48 rounded-md border border-border/60 bg-muted/20 p-3">
        <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{pretty}</pre>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date range picker
// ---------------------------------------------------------------------------

function DateRangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label2>{label}</Label2>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start font-normal"
          >
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            {value ? format(value, "d MMM yyyy") : "Any date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d || undefined);
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Tiny local label wrapper to keep imports tidy.
function Label2({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-muted-foreground">{children}</p>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [actorType, setActorType] = useState<string>("all");
  const [resource, setResource] = useState<string>("all");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);

  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.listAuditLogs();
      if (!active) return;
      if (res.ok && res.data) setLogs(res.data);
      if (!res.ok) toast.error(res.error || "Failed to load audit logs.");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actorType !== "all" && l.actorType !== actorType) return false;
      if (resource !== "all" && l.resource !== resource) return false;
      if (fromDate) {
        const t = parseISO(l.createdAt);
        if (isAfter(startOfDay(fromDate), t)) return false;
      }
      if (toDate) {
        const t = parseISO(l.createdAt);
        if (isBefore(endOfDay(toDate), t)) return false;
      }
      if (!q) return true;
      return (
        l.action.toLowerCase().includes(q) ||
        l.resource.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q)
      );
    });
  }, [logs, search, actorType, resource, fromDate, toDate]);

  const stats = useMemo(() => {
    const last30d = logs.filter((l) => isWithinLastDays(l.createdAt, 30)).length;
    const today = logs.filter((l) => isToday(l.createdAt)).length;
    const uniqueActors = new Set(logs.map((l) => l.actorId)).size;
    const highImpact = logs.filter((l) => isHighImpact(l.action)).length;
    return { total: logs.length, last30d, today, uniqueActors, highImpact };
  }, [logs]);

  // -------------------------------------------------------------------------
  // Columns
  // -------------------------------------------------------------------------

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.actorName}</p>
            <Badge
              className={cn(
                "mt-0.5 text-[9px] capitalize",
                ACTOR_TYPE_BADGE[row.actorType]
              )}
            >
              {row.actorType}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <div className="flex items-center gap-2">
          {isHighImpact(row.action) && (
            <Flame className="size-3.5 text-amber-500 shrink-0" />
          )}
          <span className="text-sm">{row.action}</span>
        </div>
      ),
    },
    {
      key: "resource",
      header: "Resource",
      render: (row) => (
        <Badge
          variant="outline"
          className="text-[10px] capitalize"
        >
          {row.resource.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "resourceId",
      header: "Resource ID",
      render: (row) =>
        row.resourceId ? (
          <span className="text-xs font-mono text-muted-foreground">
            {row.resourceId}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "ip",
      header: "IP address",
      render: (row) => (
        <span className="text-xs font-mono text-muted-foreground">
          {row.ipAddress}
        </span>
      ),
    },
    {
      key: "metadata",
      header: "Metadata",
      render: (row) => <MetadataPreview metadata={row.metadata} />,
    },
  ];

  function handleExport() {
    toast.success("Export prepared.", {
      description: `${filtered.length} log entries · CSV format`,
      icon: <Download className="size-4 text-teal" />,
    });
  }

  function clearFilters() {
    setSearch("");
    setActorType("all");
    setResource("all");
    setFromDate(undefined);
    setToDate(undefined);
  }

  const hasActiveFilters =
    search !== "" ||
    actorType !== "all" ||
    resource !== "all" ||
    fromDate !== undefined ||
    toDate !== undefined;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Audit Logs"
        description="Immutable record of administrative actions."
        actions={
          <Button
            variant="outline"
            onClick={handleExport}
            className="border-teal/40 text-teal hover:bg-teal/10"
          >
            <Download className="size-4" /> Export logs
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Entries (30d)"
          value={stats.last30d}
          icon={History}
          accent="teal"
          footer={`${stats.total} all-time`}
        />
        <StatCard
          label="Entries Today"
          value={stats.today}
          icon={ScrollText}
          accent="turquoise"
        />
        <StatCard
          label="Unique Actors"
          value={stats.uniqueActors}
          icon={Users}
          accent="ocean"
        />
        <StatCard
          label="High-Impact"
          value={stats.highImpact}
          icon={Flame}
          accent="muted"
          footer="Critical actions"
        />
      </div>

      {/* Filters */}
      <SectionCard
        title="Filters"
        description="Refine the audit trail by actor, resource and date range"
        icon={Search}
        bodyClassName="space-y-4"
        action={
          hasActiveFilters ? (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      >
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search action, resource, or actor name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Actor type tabs */}
          <div className="space-y-1.5">
            <Label2>Actor type</Label2>
            <Tabs value={actorType} onValueChange={setActorType}>
              <TabsList className="flex-wrap w-full">
                {ACTOR_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-[11px]">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Resource select */}
          <div className="space-y-1.5">
            <Label2>Resource</Label2>
            <Select value={resource} onValueChange={setResource}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All resources" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From date */}
          <DateRangeField
            label="From date"
            value={fromDate}
            onChange={setFromDate}
          />

          {/* To date */}
          <DateRangeField
            label="To date"
            value={toDate}
            onChange={setToDate}
          />
        </div>
      </SectionCard>

      {/* Logs table */}
      <SectionCard
        title="Audit entries"
        description={`${filtered.length} entr${filtered.length === 1 ? "y" : "ies"}`}
        icon={ScrollText}
        bodyClassName="p-0"
      >
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          onRowClick={(r) => setSelected(r)}
          emptyTitle="No audit entries"
          emptyDescription="No log entries match the current filters."
          emptyIcon={FileText}
        />
      </SectionCard>

      {/* Detail dialog */}
      <Dialog
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {isHighImpact(selected.action) ? (
                    <ShieldAlert className="size-5 text-amber-500" />
                  ) : (
                    <Server className="size-5 text-teal" />
                  )}
                  Audit entry
                </DialogTitle>
                <DialogDescription>
                  Logged {formatDateTime(selected.createdAt)} · ID{" "}
                  <span className="font-mono">{selected.id}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Action
                  </p>
                  <p className="mt-1 text-sm font-semibold">{selected.action}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Resource
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {selected.resource.replace("_", " ")}
                    </Badge>
                    {selected.resourceId && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {selected.resourceId}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Actor
                  </p>
                  <p className="mt-1 text-sm font-medium">{selected.actorName}</p>
                  <Badge
                    className={cn(
                      "mt-1 text-[9px] capitalize",
                      ACTOR_TYPE_BADGE[selected.actorType]
                    )}
                  >
                    {selected.actorType}
                  </Badge>
                  <p className="mt-1 text-[10px] font-mono text-muted-foreground">
                    {selected.actorId}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Origin
                  </p>
                  <p className="mt-1 text-sm font-mono">{selected.ipAddress}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDateTime(selected.createdAt)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Metadata
                </p>
                <MetadataFull metadata={selected.metadata} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
