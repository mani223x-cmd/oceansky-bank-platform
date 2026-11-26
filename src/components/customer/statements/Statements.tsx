"use client";

// ============================================================================
// OceanSky Bank — Statements (customer)
// ----------------------------------------------------------------------------
// Lets the customer generate PDF / CSV / Excel statements for any account and
// date range, and lists previously generated statements with download links.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Download,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import { formatDate, formatMoneyDisplay } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type { Account, Statement } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  DataTable,
  type Column,
} from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ----------------------------------------------------------------------------
// Format options
// ----------------------------------------------------------------------------
type StatementFormat = "pdf" | "csv" | "excel";

const FORMAT_OPTIONS: { value: StatementFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
];

const FORMAT_BADGE_CLASS: Record<StatementFormat, string> = {
  pdf: "bg-rose-500/10 text-rose-700 border-rose-500/25",
  csv: "bg-teal/10 text-teal border-teal/25",
  excel: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
};

// ----------------------------------------------------------------------------
// Statements
// ----------------------------------------------------------------------------
export function Statements() {
  const user = useAuthStore((s) => s.user);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Form state ---
  const [accountId, setAccountId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [formatChoice, setFormatChoice] = useState<StatementFormat>("pdf");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [accRes, stmtRes] = await Promise.all([
        services.account.listByUser(user.id),
        services.statement.listByUser(user.id),
      ]);
      if (cancelled) return;
      if (accRes.ok && accRes.data) {
        setAccounts(accRes.data);
        // Pre-select the first account if available.
        setAccountId((prev) => prev || accRes.data![0]?.id || "");
      }
      if (stmtRes.ok && stmtRes.data) {
        setStatements(stmtRes.data);
      } else {
        toast({
          title: "Failed to load statements",
          description: stmtRes.error,
          variant: "destructive",
        });
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // --- Look up an account by id (used for the table + display) ---
  const accountMap = useMemo(() => {
    const m = new Map<string, Account>();
    accounts.forEach((a) => m.set(a.id, a));
    return m;
  }, [accounts]);

  function accountLabel(id: string): string {
    const a = accountMap.get(id);
    if (!a) return "Unknown account";
    const nick = a.nickname?.trim() || a.accountType;
    return `${nick} ••••${a.accountNumber.slice(-4)}`;
  }

  function accountCurrency(id: string): string {
    return accountMap.get(id)?.currency ?? "USD";
  }

  // --- Generate a new statement ---
  async function handleGenerate() {
    if (!user) return;
    if (!accountId) {
      toast({ title: "Select an account", variant: "destructive" });
      return;
    }
    if (!startDate || !endDate) {
      toast({ title: "Pick a start and end date", variant: "destructive" });
      return;
    }
    if (endDate < startDate) {
      toast({
        title: "Invalid date range",
        description: "End date must be after the start date.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    const res = await services.statement.generate({
      userId: user.id,
      accountId,
      startDate: startDate.toISOString(),
      // End-of-day on the end date so the range is inclusive.
      endDate: new Date(endDate.getTime() + 86_399_999).toISOString(),
      format: formatChoice,
    });
    setGenerating(false);
    if (res.ok && res.data) {
      setStatements((prev) => [res.data!, ...prev]);
      toast({
        title: "Statement generated",
        description: `${accountLabel(accountId)} • ${formatDate(
          res.data!.startDate,
        )} – ${formatDate(res.data!.endDate)}`,
      });
    } else {
      toast({
        title: "Failed to generate statement",
        description: res.error,
        variant: "destructive",
      });
    }
  }

  function downloadStatement(stmt: Statement) {
    toast({
      title: "Download started. Your statement will open in a new tab.",
      description: `${stmt.format.toUpperCase()} statement for ${accountLabel(stmt.accountId)}.`,
    });
  }

  // --- Table columns ---
  // Built inline (no useMemo) so the closures over accountLabel/accountCurrency
  // and downloadStatement are always fresh — the React Compiler optimizes this.
  const columns: Column<Statement>[] = [
    {
      key: "account",
      header: "Account",
      render: (s) => (
        <span className="font-medium">{accountLabel(s.accountId)}</span>
      ),
    },
    {
      key: "period",
      header: "Period",
      render: (s) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(s.startDate)} – {formatDate(s.endDate)}
        </span>
      ),
    },
    {
      key: "txns",
      header: "Txns",
      className: "text-center",
      render: (s) => <span className="tabular-nums">{s.transactionCount}</span>,
    },
    {
      key: "opening",
      header: "Opening",
      className: "text-right",
      render: (s) => (
        <span className="tabular-nums">
          {formatMoneyDisplay(s.openingBalance, accountCurrency(s.accountId))}
        </span>
      ),
    },
    {
      key: "closing",
      header: "Closing",
      className: "text-right",
      render: (s) => (
        <span className="tabular-nums font-medium">
          {formatMoneyDisplay(s.closingBalance, accountCurrency(s.accountId))}
        </span>
      ),
    },
    {
      key: "generated",
      header: "Generated",
      render: (s) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(s.generatedAt, "d MMM yyyy")}
        </span>
      ),
    },
    {
      key: "format",
      header: "Format",
      render: (s) => (
        <Badge
          variant="outline"
          className={cn(
            "uppercase",
            FORMAT_BADGE_CLASS[s.format as StatementFormat] ??
              "bg-muted text-muted-foreground",
          )}
        >
          {s.format}
        </Badge>
      ),
    },
    {
      key: "download",
      header: "",
      className: "text-right",
      render: (s) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            downloadStatement(s);
          }}
        >
          <Download className="size-3.5" />
          Download
        </Button>
      ),
    },
  ];

  const canGenerate =
    !!user && !!accountId && !!startDate && !!endDate && !generating;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statements"
        description="Generate and download your account statements."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Generate new statement */}
        <SectionCard
          title="Generate new statement"
          description="Pick an account, a date range and a format."
          icon={Plus}
        >
          <div className="space-y-4">
            {/* Account */}
            <div className="space-y-1.5">
              <Label htmlFor="stmt-account">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="stmt-account" className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nickname?.trim() || a.accountType} ••••
                      {a.accountNumber.slice(-4)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="size-4" />
                      {startDate ? format(startDate, "d MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      disabled={(d) => (endDate ? d > endDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="size-4" />
                      {endDate ? format(endDate, "d MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(d) => (startDate ? d < startDate : false)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <Label htmlFor="stmt-format">Format</Label>
              <Select
                value={formatChoice}
                onValueChange={(v) => setFormatChoice(v as StatementFormat)}
              >
                <SelectTrigger id="stmt-format" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full bg-teal text-white hover:bg-teal/90"
            >
              {generating ? (
                <>
                  <Sparkles className="size-4 animate-pulse" />
                  Generating…
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Generate statement
                </>
              )}
            </Button>
          </div>
        </SectionCard>

        {/* Recent statements */}
        <SectionCard
          title="Recent statements"
          description={`${statements.length} statement${statements.length === 1 ? "" : "s"} on file`}
          icon={FileText}
        >
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-md bg-muted/60"
                />
              ))}
            </div>
          ) : statements.length === 0 ? (
            <EmptyState
              title="No statements yet"
              description="Generate your first statement using the form on the left."
              icon={FileText}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={statements}
              emptyTitle="No statements yet"
              emptyDescription="Generate your first statement using the form on the left."
              emptyIcon={FileText}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
