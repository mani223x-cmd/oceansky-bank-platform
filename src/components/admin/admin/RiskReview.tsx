"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  ArrowUpWideNarrow,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  UserCog,
  ClipboardList,
  Inbox,
  ArrowRightLeft,
  MapPin,
  Clock3,
  Network,
} from "lucide-react";
import { services } from "@/lib/services";
import { MOCK_ADMIN_USERS } from "@/lib/mock";
import type { AdminUser, RiskCase, RiskFlag, RiskLevel, Transaction } from "@/lib/types";
import { useAuthStore } from "@/lib/store/auth.store";
import { formatMoney, formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REASON_META: Record<RiskFlag, { label: string; icon: typeof MapPin }> = {
  high_amount: { label: "High Amount", icon: ArrowUpWideNarrow },
  unusual_location: { label: "Unusual Location", icon: MapPin },
  velocity: { label: "Velocity Spike", icon: ArrowRightLeft },
  new_beneficiary: { label: "New Beneficiary", icon: UserCog },
  off_hours: { label: "Off-Hours Activity", icon: Clock3 },
  structured_pattern: { label: "Structured Pattern", icon: Network },
};

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing" },
  { value: "escalated", label: "Escalated" },
  { value: "approved", label: "Approved" },
  { value: "blocked", label: "Blocked" },
] as const;

const LEVEL_TABS = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const STATUS_BADGE: Record<RiskCase["status"], string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  reviewing: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  escalated: "bg-destructive/10 text-destructive",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  blocked: "bg-muted text-muted-foreground",
};

const LEVEL_BADGE: Record<RiskLevel, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  critical: "bg-destructive/10 text-destructive",
};

function scoreColor(score: number): { text: string; bar: string; bg: string } {
  if (score < 40) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
      bg: "bg-emerald-100 dark:bg-emerald-500/15",
    };
  }
  if (score <= 70) {
    return {
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
      bg: "bg-amber-100 dark:bg-amber-500/15",
    };
  }
  return {
    text: "text-destructive",
    bar: "bg-destructive",
    bg: "bg-destructive/10",
  };
}

// Agents permitted to be assigned to a risk case.
const ASSIGNABLE_AGENTS: AdminUser[] = MOCK_ADMIN_USERS.filter(
  (a) => a.role === "risk_analyst" || a.role === "super_admin"
);

function agentName(admins: AdminUser[], id?: string): string {
  if (!id) return "Unassigned";
  const a = admins.find((x) => x.id === id);
  return a ? `${a.firstName} ${a.lastName}` : "Unassigned";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminRiskReview() {
  const admin = useAuthStore((s) => s.admin);
  const [cases, setCases] = useState<RiskCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  // Linked transaction for the selected case (mock lookup).
  const [linkedTxn, setLinkedTxn] = useState<Transaction | null>(null);
  const [linkedLoading, setLinkedLoading] = useState(false);

  // Note composer + confirm dialogs.
  const [noteText, setNoteText] = useState("");
  const [pendingAction, setPendingAction] = useState<null | "approved" | "blocked" | "escalated">(null);
  const [actionLoading, setActionLoading] = useState(false);
  const noteListRef = useRef<HTMLDivElement | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    const res = await services.admin.listRiskCases();
    if (res.ok && res.data) {
      setCases(res.data);
      // Auto-select the first open/escalated case on first load.
      if (!selectedId && res.data.length > 0) {
        const firstOpen =
          res.data.find((c) => c.status === "open" || c.status === "escalated") || res.data[0];
        setSelectedId(firstOpen.id);
      }
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const selected = useMemo(
    () => cases.find((c) => c.id === selectedId) || null,
    [cases, selectedId]
  );

  // Fetch linked transaction whenever the selection changes.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!selected) {
        setLinkedTxn(null);
        return;
      }
      setLinkedLoading(true);
      const res = await services.transaction.getById(selected.transactionId);
      if (active) {
        setLinkedTxn(res.ok && res.data ? res.data : null);
        setLinkedLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selected]);

  // Reset note composer when switching cases.
  useEffect(() => {
    setNoteText("");
  }, [selectedId]);

  // Scroll notes to top whenever the case notes change (so the newest is visible).
  useEffect(() => {
    if (noteListRef.current) noteListRef.current.scrollTop = 0;
  }, [selected?.notes?.length]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (levelFilter !== "all" && c.riskLevel !== levelFilter) return false;
      return true;
    });
  }, [cases, statusFilter, levelFilter]);

  const stats = useMemo(() => {
    const open = cases.filter((c) => c.status === "open" || c.status === "reviewing").length;
    const critical = cases.filter((c) => c.riskLevel === "critical").length;
    const high = cases.filter((c) => c.riskLevel === "high").length;
    const escalated = cases.filter((c) => c.status === "escalated").length;
    return { open, critical, high, escalated };
  }, [cases]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function confirmAction() {
    if (!selected || !pendingAction) return;
    const action = pendingAction;
    setActionLoading(true);
    try {
      const note = noteText.trim() || undefined;
      if (action === "approved" || action === "blocked") {
        const res = await services.admin.resolveRiskCase(selected.id, action, note);
        if (res.ok && res.data) {
          setCases((prev) =>
            prev.map((c) => (c.id === res.data!.id ? res.data! : c))
          );
          toast.success(
            action === "approved"
              ? "Transaction approved and released."
              : "Transaction blocked successfully.",
            { description: `Case ${selected.id} resolved.` }
          );
        } else {
          toast.error(res.error || "Action failed.");
        }
      } else if (action === "escalated") {
        // Mark as escalated locally (no backend escalate endpoint for risk cases).
        const updated: RiskCase = {
          ...selected,
          status: "escalated",
          notes: note
            ? [...(selected.notes || []), `[Escalation note] ${note}`]
            : selected.notes,
        };
        setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast.success("Case escalated to senior risk team.", {
          description: `Case ${selected.id} flagged for senior review.`,
        });
      }
      setNoteText("");
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  }

  async function handleAssign(agentId: string) {
    if (!selected) return;
    const updated: RiskCase = { ...selected, assignedTo: agentId };
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    const name = agentName(ASSIGNABLE_AGENTS, agentId);
    toast.success(`Case assigned to ${name}.`);
  }

  function handleAddNote() {
    if (!selected) return;
    const body = noteText.trim();
    if (!body) {
      toast.error("Note body cannot be empty.");
      return;
    }
    const stamp = formatDateTime(new Date().toISOString());
    const entry = `${stamp} — ${admin ? `${admin.firstName} ${admin.lastName}` : "Risk analyst"}: ${body}`;
    const updated: RiskCase = {
      ...selected,
      notes: [...(selected.notes || []), entry],
    };
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setNoteText("");
    toast.success("Note added to case file.");
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Fraud & Risk Review"
        description="Investigate flagged transactions."
        actions={
          <Badge
            variant="outline"
            className="border-teal/40 bg-teal/10 text-teal gap-1.5"
          >
            <ShieldAlert className="size-3.5" /> Risk Engine v2.1
          </Badge>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Open Cases"
          value={stats.open}
          icon={Inbox}
          accent="teal"
          footer="Awaiting analyst review"
        />
        <StatCard
          label="Critical Risk"
          value={stats.critical}
          icon={Flame}
          accent="muted"
          footer="Immediate attention"
        />
        <StatCard
          label="High Risk"
          value={stats.high}
          icon={AlertTriangle}
          accent="ocean"
          footer="Above threshold"
        />
        <StatCard
          label="Escalated"
          value={stats.escalated}
          icon={ArrowUpCircle}
          accent="turquoise"
          footer="Senior review queue"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="flex-wrap">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Risk level</span>
          <Tabs value={levelFilter} onValueChange={setLevelFilter}>
            <TabsList className="flex-wrap">
              {LEVEL_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Left: list */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Flagged Cases"
            description={`${filtered.length} case${filtered.length === 1 ? "" : "s"}`}
            icon={ClipboardList}
            bodyClassName="p-3"
          >
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded-lg bg-muted/60 animate-pulse"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No risk cases"
                description="No flagged transactions match the current filters."
                icon={ShieldAlert}
              />
            ) : (
              <div className="max-h-[70vh] space-y-2 overflow-y-auto scrollbar-thin pr-1">
                {filtered.map((c) => {
                  const ReasonIcon = REASON_META[c.reason].icon;
                  const sc = scoreColor(c.riskScore);
                  const active = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-all hover:border-teal/40 hover:bg-teal/[0.04]",
                        active
                          ? "border-teal/50 bg-teal/[0.06] ring-1 ring-teal/30"
                          : "border-border/60 bg-background"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {timeAgo(c.createdAt)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                            sc.bg,
                            sc.text
                          )}
                        >
                          <ShieldAlert className="size-3" />
                          {c.riskScore}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatMoney(c.amount, c.currency)}
                        </p>
                        <Badge
                          variant="outline"
                          className="gap-1 border-border/60 text-[10px] capitalize"
                        >
                          <ReasonIcon className="size-3 text-muted-foreground" />
                          {REASON_META[c.reason].label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Badge
                          className={cn("text-[10px] capitalize", STATUS_BADGE[c.status])}
                        >
                          {c.status}
                        </Badge>
                        <Badge
                          className={cn("text-[10px] capitalize", LEVEL_BADGE[c.riskLevel])}
                        >
                          {c.riskLevel}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <SectionCard
              title="Case Detail"
              description="Select a case to investigate"
              icon={ShieldAlert}
              bodyClassName="p-6"
            >
              <EmptyState
                title="No case selected"
                description="Pick a flagged transaction from the list to view full investigation details."
                icon={ShieldAlert}
              />
            </SectionCard>
          ) : (
            <CaseDetail
              caseItem={selected}
              linkedTxn={linkedTxn}
              linkedLoading={linkedLoading}
              noteText={noteText}
              onNoteTextChange={setNoteText}
              onAddNote={handleAddNote}
              onAction={setPendingAction}
              onAssign={handleAssign}
              noteListRef={noteListRef}
              actionLoading={actionLoading}
            />
          )}
        </div>
      </div>

      {/* Confirm dialog for resolve / block / escalate */}
      <ConfirmDialog
        open={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmAction}
        title={
          pendingAction === "approved"
            ? "Approve flagged transaction?"
            : pendingAction === "blocked"
            ? "Block flagged transaction?"
            : "Escalate this case?"
        }
        description={
          pendingAction === "approved"
            ? "The flagged transaction will be released to the customer. This action is logged to the audit trail."
            : pendingAction === "blocked"
            ? "The transaction will be blocked and reversed where possible. The customer will be notified. This action is logged."
            : "Escalate to the senior risk team for deeper investigation. The current analyst will be relieved of primary ownership."
        }
        confirmLabel={
          pendingAction === "approved"
            ? "Approve"
            : pendingAction === "blocked"
            ? "Block transaction"
            : "Escalate case"
        }
        variant={
          pendingAction === "approved"
            ? "success"
            : pendingAction === "blocked"
            ? "danger"
            : "warning"
        }
      >
        {selected && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Case</span>
              <span className="font-mono font-semibold">{selected.id}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">User</span>
              <span className="font-medium">{selected.userName}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold tabular-nums">
                {formatMoney(selected.amount, selected.currency)}
              </span>
            </div>
            {noteText.trim() && (
              <div className="mt-2 border-t pt-2">
                <p className="text-muted-foreground">Analyst note</p>
                <p className="mt-0.5 font-medium text-foreground">“{noteText.trim()}”</p>
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Case detail panel
// ---------------------------------------------------------------------------

interface CaseDetailProps {
  caseItem: RiskCase;
  linkedTxn: Transaction | null;
  linkedLoading: boolean;
  noteText: string;
  onNoteTextChange: (v: string) => void;
  onAddNote: () => void;
  onAction: (a: "approved" | "blocked" | "escalated") => void;
  onAssign: (agentId: string) => void;
  noteListRef: React.RefObject<HTMLDivElement | null>;
  actionLoading: boolean;
}

function CaseDetail({
  caseItem,
  linkedTxn,
  linkedLoading,
  noteText,
  onNoteTextChange,
  onAddNote,
  onAction,
  onAssign,
  noteListRef,
  actionLoading,
}: CaseDetailProps) {
  const sc = scoreColor(caseItem.riskScore);
  const ReasonIcon = REASON_META[caseItem.reason].icon;
  const resolved = caseItem.status === "approved" || caseItem.status === "blocked";

  return (
    <SectionCard
      title={`Case ${caseItem.id}`}
      description={REASON_META[caseItem.reason].label}
      icon={ShieldAlert}
      action={
        <Badge className={cn("text-[10px] capitalize", STATUS_BADGE[caseItem.status])}>
          {caseItem.status}
        </Badge>
      }
      bodyClassName="p-5 space-y-5"
    >
      {/* Header: user + amount */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Customer</p>
          <p className="mt-1 text-sm font-semibold">{caseItem.userName}</p>
          <p className="text-xs text-muted-foreground">
            User ID · <span className="font-mono">{caseItem.userId}</span>
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Transaction amount
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {formatMoney(caseItem.amount, caseItem.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            Flagged {timeAgo(caseItem.createdAt)}
          </p>
        </div>
      </div>

      {/* Risk score */}
      <div className="rounded-lg border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className={cn("size-5", sc.text)} />
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Risk score
              </p>
              <p className={cn("text-3xl font-bold tabular-nums leading-tight", sc.text)}>
                {caseItem.riskScore}
                <span className="ml-1 text-sm font-medium text-muted-foreground">/ 100</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Risk level</p>
            <Badge
              className={cn("mt-0.5 text-[11px] capitalize", LEVEL_BADGE[caseItem.riskLevel])}
            >
              {caseItem.riskLevel}
            </Badge>
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", sc.bar)}
            style={{ width: `${Math.min(100, Math.max(2, caseItem.riskScore))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Engine rule: <span className="font-medium text-foreground">{REASON_META[caseItem.reason].label}</span>{" "}
          · triggered {formatDateTime(caseItem.createdAt)}.
        </p>
      </div>

      {/* Reason + assignment + dates */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Trigger reason</p>
          <div className="mt-1 flex items-center gap-2">
            <ReasonIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{REASON_META[caseItem.reason].label}</span>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Created</p>
          <p className="mt-1 text-sm font-medium">{formatDate(caseItem.createdAt)}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(caseItem.createdAt)}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Assigned to</p>
          <p className="mt-1 text-sm font-medium">
            {agentName(ASSIGNABLE_AGENTS, caseItem.assignedTo)}
          </p>
        </div>
      </div>

      {/* Assign dropdown */}
      {!resolved && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-teal/40 bg-teal/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Reassign case</p>
            <p className="text-xs text-muted-foreground">
              Hand off to a risk analyst or super admin.
            </p>
          </div>
          <Select
            value={caseItem.assignedTo || "__none"}
            onValueChange={(v) => onAssign(v === "__none" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-56" size="sm">
              <SelectValue placeholder="Assign to…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Unassigned</SelectItem>
              {ASSIGNABLE_AGENTS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.firstName} {a.lastName} · {a.role.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Action buttons */}
      {!resolved ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            onClick={() => onAction("approved")}
            disabled={actionLoading}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <CheckCircle2 className="size-4" /> Approve
          </Button>
          <Button
            onClick={() => onAction("blocked")}
            variant="destructive"
            disabled={actionLoading}
          >
            <XCircle className="size-4" /> Block
          </Button>
          <Button
            onClick={() => onAction("escalated")}
            variant="outline"
            disabled={actionLoading}
            className="border-amber-400/60 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
          >
            <ArrowUpCircle className="size-4" /> Escalate
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "rounded-lg border p-4 text-sm",
            caseItem.status === "approved"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {caseItem.status === "approved" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
            <span className="font-semibold capitalize">
              Case {caseItem.status}
            </span>
          </div>
          <p className="mt-1 text-xs">
            This case has been resolved and is now read-only. Re-open via a new risk flag if needed.
          </p>
        </div>
      )}

      {/* Linked transaction */}
      <div className="rounded-lg border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-teal" />
            <p className="text-sm font-semibold">Linked transaction</p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {caseItem.transactionId}
          </span>
        </div>
        <Separator className="my-3" />
        {linkedLoading ? (
          <div className="space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted/60 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-muted/60 animate-pulse" />
          </div>
        ) : linkedTxn ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <DetailRow label="Reference" value={linkedTxn.reference} />
            <DetailRow label="Type" value={linkedTxn.type} className="capitalize" />
            <DetailRow
              label="Amount"
              value={formatMoney(linkedTxn.amount, linkedTxn.currency)}
            />
            <DetailRow label="Description" value={linkedTxn.description} />
            <DetailRow label="Counterparty" value={linkedTxn.counterparty || "—"} />
            <DetailRow
              label="Status"
              value={linkedTxn.status}
              className="capitalize"
            />
            <DetailRow
              label="Created"
              value={formatDateTime(linkedTxn.createdAt)}
              full
            />
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">
            Linked transaction record could not be located. It may have been purged from the live ledger.
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-border/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-teal" />
            <p className="text-sm font-semibold">Analyst notes</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {(caseItem.notes || []).length} note{(caseItem.notes || []).length === 1 ? "" : "s"}
          </span>
        </div>
        <Separator className="my-3" />
        <div
          ref={noteListRef}
          className="max-h-48 space-y-2 overflow-y-auto scrollbar-thin pr-1"
        >
          {(caseItem.notes || []).length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No notes recorded yet. Add context for the next reviewer below.
            </p>
          ) : (
            (caseItem.notes || []).map((n, i) => (
              <div
                key={i}
                className="rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs"
              >
                <p className="whitespace-pre-wrap text-foreground">{n}</p>
              </div>
            ))
          )}
        </div>
        {!resolved && (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Add an analyst note (visible to other reviewers)…"
              value={noteText}
              onChange={(e) => onNoteTextChange(e.target.value)}
              className="min-h-20 text-sm"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {noteText.length}/500
              </span>
              <Button size="sm" variant="outline" onClick={onAddNote}>
                <ClipboardList className="size-4" /> Add note
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function DetailRow({
  label,
  value,
  className,
  full,
}: {
  label: string;
  value: string;
  className?: string;
  full?: boolean;
}) {
  return (
    <div className={cn(full && "col-span-2 sm:col-span-3")}>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-xs font-medium text-foreground break-words", className)}>
        {value}
      </dd>
    </div>
  );
}
