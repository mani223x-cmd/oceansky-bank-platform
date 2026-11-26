"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Headset,
  Inbox as InboxIcon,
  Clock4,
  ArrowUpCircle,
  CheckCircle2,
  Send,
  Search,
  MessageSquare,
  UserCircle2,
  Activity,
  Tag,
  CalendarDays,
  Gauge,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { services } from "@/lib/services";
import { MOCK_ADMIN_USERS } from "@/lib/mock";
import type { AdminUser, ChatMessage, SupportTicket, TicketPriority, TicketStatus, User } from "@/lib/types";
import { useAuthStore } from "@/lib/store/auth.store";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  pending_agent: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  pending_customer: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  escalated: "bg-destructive/10 text-destructive",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  urgent: "bg-destructive/10 text-destructive",
};

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
] as const;

const SUPPORT_AGENTS: AdminUser[] = MOCK_ADMIN_USERS.filter(
  (a) =>
    a.role === "support_agent" ||
    a.role === "super_admin" ||
    a.role === "operations_manager"
);

function isToday(iso: string): boolean {
  try {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
}

function statusMatches(status: TicketStatus, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "open") return status === "open";
  if (filter === "pending") return status === "pending_agent" || status === "pending_customer";
  if (filter === "escalated") return status === "escalated";
  if (filter === "resolved") return status === "resolved" || status === "closed";
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminSupportInbox() {
  const admin = useAuthStore((s) => s.admin);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Confirm dialogs
  const [resolveOpen, setResolveOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Simulated customer reply tracking
  const replyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Auto-scroll anchor
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------------------------------------------------
  // Load tickets + users
  // -------------------------------------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await services.support.listAllTickets();
      const usersRes = await services.admin.listCustomers();
      if (!active) return;
      if (res.ok && res.data) {
        setTickets(res.data);
        if (!selectedId && res.data.length > 0) {
          setSelectedId(res.data[0].id);
        }
      }
      if (usersRes.ok && usersRes.data) {
        setUsers(usersRes.data);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
      // Clear any pending reply timers on unmount.
      Object.values(replyTimers.current).forEach((t) => clearTimeout(t));
      replyTimers.current = {};
    };
  }, [selectedId]);

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) || null,
    [tickets, selectedId]
  );

  const userName = useMemo(() => {
    if (!selected) return "Customer";
    const u = users.find((x) => x.id === selected.userId);
    return u ? `${u.firstName} ${u.lastName}` : "Customer";
  }, [selected, users]);

  const agentName = useMemo(() => {
    if (!selected?.assignedAgentId) return "Unassigned";
    const a = SUPPORT_AGENTS.find((x) => x.id === selected.assignedAgentId);
    return a ? `${a.firstName} ${a.lastName}` : "Unassigned";
  }, [selected]);

  // -------------------------------------------------------------------------
  // Load messages when ticket changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      if (!selected) {
        setMessages([]);
        return;
      }
      setMessagesLoading(true);
      const res = await services.support.listMessages(selected.id);
      if (active) {
        setMessages(res.ok && res.data ? res.data : []);
        setMessagesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selected]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedId]);

  // Reset draft on ticket switch using the "store info from previous render"
  // pattern (avoids synchronous setState inside an effect).
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(selectedId);
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId);
    setDraft("");
  }

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (!statusMatches(t.status, statusFilter)) return false;
      if (!q) return true;
      const owner = users.find((u) => u.id === t.userId);
      const uname = owner
        ? `${owner.firstName} ${owner.lastName}`.toLowerCase()
        : "";
      return (
        t.subject.toLowerCase().includes(q) ||
        uname.includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [tickets, statusFilter, search, users]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "open").length;
    const pendingAgent = tickets.filter((t) => t.status === "pending_agent").length;
    const escalated = tickets.filter((t) => t.status === "escalated").length;
    const resolvedToday = tickets.filter(
      (t) => (t.status === "resolved" || t.status === "closed") && isToday(t.updatedAt)
    ).length;
    return { total, open, pendingAgent, escalated, resolvedToday };
  }, [tickets]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  async function handleSend() {
    if (!selected) return;
    const body = draft.trim();
    if (!body) {
      toast.error("Message body is empty.");
      return;
    }
    if (!admin) {
      toast.error("Admin session expired. Please sign in again.");
      return;
    }
    setSending(true);
    const senderName = `${admin.firstName} ${admin.lastName}`;
    const res = await services.support.sendMessage(selected.id, body, "agent", senderName);
    if (res.ok && res.data) {
      setMessages((prev) => [...prev, res.data!]);
      // Reflect updated ticket state.
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selected.id
            ? {
                ...t,
                status: "pending_customer",
                updatedAt: res.data!.createdAt,
                unreadByCustomer: true,
                unreadByAgent: false,
              }
            : t
        )
      );
      setDraft("");
      toast.success("Message sent.", { description: `To ${userName}` });

      // Simulated customer reply after 4s.
      const existing = replyTimers.current[selected.id];
      if (existing) clearTimeout(existing);
      replyTimers.current[selected.id] = setTimeout(async () => {
        const replyRes = await services.support.sendMessage(
          selected.id,
          "Thank you, that helps!",
          "customer",
          userName
        );
        if (replyRes.ok && replyRes.data) {
          setMessages((prev) => [...prev, replyRes.data!]);
          setTickets((prev) =>
            prev.map((t) =>
              t.id === selected.id
                ? {
                    ...t,
                    status: "pending_agent",
                    updatedAt: replyRes.data!.createdAt,
                    unreadByAgent: true,
                    unreadByCustomer: false,
                  }
                : t
            )
          );
        }
        delete replyTimers.current[selected.id];
      }, 4000);
    } else {
      toast.error(res.error || "Failed to send message.");
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  async function handleAssign(agentId: string) {
    if (!selected) return;
    const res = await services.support.assignTicket(selected.id, agentId);
    if (res.ok && res.data) {
      setTickets((prev) => prev.map((t) => (t.id === res.data!.id ? res.data! : t)));
      const a = SUPPORT_AGENTS.find((x) => x.id === agentId);
      toast.success(`Ticket assigned to ${a ? `${a.firstName} ${a.lastName}` : "agent"}.`);
    } else {
      toast.error(res.error || "Failed to assign ticket.");
    }
  }

  async function confirmResolve() {
    if (!selected) return;
    setDialogLoading(true);
    const res = await services.support.resolveTicket(selected.id);
    if (res.ok && res.data) {
      setTickets((prev) => prev.map((t) => (t.id === res.data!.id ? res.data! : t)));
      toast.success("Ticket marked as resolved.", {
        description: `${selected.subject}`,
      });
    } else {
      toast.error(res.error || "Failed to resolve ticket.");
    }
    setDialogLoading(false);
    setResolveOpen(false);
  }

  async function confirmEscalate() {
    if (!selected) return;
    setDialogLoading(true);
    const res = await services.support.escalate(selected.id, "Priority escalation by support agent");
    if (res.ok && res.data) {
      setTickets((prev) => prev.map((t) => (t.id === res.data!.id ? res.data! : t)));
      // Append the system message that the service adds.
      const msgsRes = await services.support.listMessages(selected.id);
      if (msgsRes.ok && msgsRes.data) setMessages(msgsRes.data);
      toast.success("Ticket escalated to senior support.");
    } else {
      toast.error(res.error || "Failed to escalate ticket.");
    }
    setDialogLoading(false);
    setEscalateOpen(false);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Support Inbox"
        description="Live customer conversations and tickets."
        actions={
          <Badge variant="outline" className="border-teal/40 bg-teal/10 text-teal gap-1.5">
            <Headset className="size-3.5" /> Live chat
          </Badge>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Tickets" value={stats.total} icon={InboxIcon} accent="teal" />
        <StatCard label="Open" value={stats.open} icon={MessageSquare} accent="turquoise" />
        <StatCard label="Pending Agent" value={stats.pendingAgent} icon={Clock4} accent="ocean" />
        <StatCard label="Escalated" value={stats.escalated} icon={ArrowUpCircle} accent="muted" />
        <StatCard
          label="Resolved Today"
          value={stats.resolvedToday}
          icon={CheckCircle2}
          accent="teal"
        />
      </div>

      {/* Three column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Left: ticket list */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="border-b p-3">
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="flex-wrap">
                  {STATUS_TABS.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search subject or user…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto scrollbar-thin p-2">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg bg-muted/60 animate-pulse" />
                  ))}
                </div>
              ) : filteredTickets.length === 0 ? (
                <EmptyState
                  title="No tickets"
                  description="No conversations match your filters."
                  icon={InboxIcon}
                  className="py-8"
                />
              ) : (
                filteredTickets.map((t) => {
                  const uname = users.find((u) => u.id === t.userId);
                  const active = t.id === selectedId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "mb-1 w-full rounded-lg border p-3 text-left transition-all hover:border-teal/40 hover:bg-teal/[0.04]",
                        active
                          ? "border-teal/50 bg-teal/[0.06] ring-1 ring-teal/30"
                          : "border-border/60 bg-background"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{t.subject}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {uname ? `${uname.firstName} ${uname.lastName}` : t.userId}
                          </p>
                        </div>
                        {t.unreadByAgent && (
                          <span
                            className="mt-1 size-2 shrink-0 rounded-full bg-teal"
                            aria-label="Unread by agent"
                          />
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1.5">
                        <Badge
                          className={cn(
                            "text-[9px] capitalize",
                            STATUS_BADGE[t.status]
                          )}
                        >
                          {t.status.replace("_", " ")}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Badge
                            className={cn(
                              "text-[9px] capitalize",
                              PRIORITY_BADGE[t.priority]
                            )}
                          >
                            {t.priority}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {t.category}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Updated {timeAgo(t.updatedAt)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Center: chat panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="rounded-xl border border-border/60 bg-card shadow-sm">
              <EmptyState
                title="Select a conversation"
                description="Choose a ticket from the list to view the live chat."
                icon={MessageSquare}
                className="py-20"
              />
            </div>
          ) : (
            <div className="flex h-[78vh] flex-col rounded-xl border border-border/60 bg-card shadow-sm">
              {/* Header */}
              <div className="border-b p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{selected.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Ticket <span className="font-mono">{selected.id}</span> · with{" "}
                      <span className="font-medium text-foreground">{userName}</span>
                    </p>
                  </div>
                  <Badge
                    className={cn("text-[10px] capitalize shrink-0", STATUS_BADGE[selected.status])}
                  >
                    {selected.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <UserCircle2 className="size-3.5" />
                  Assignee: <span className="font-medium text-foreground">{agentName}</span>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-2.5">
                <Select
                  value={selected.assignedAgentId || "__none"}
                  onValueChange={(v) => v !== "__none" && handleAssign(v)}
                >
                  <SelectTrigger className="h-8 w-full text-xs sm:w-44" size="sm">
                    <SelectValue placeholder="Assign to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_AGENTS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.firstName} {a.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEscalateOpen(true)}
                  disabled={selected.status === "escalated" || selected.status === "resolved"}
                  className="border-amber-400/60 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                >
                  <ArrowUpCircle className="size-4" /> Escalate
                </Button>
                <Button
                  size="sm"
                  onClick={() => setResolveOpen(true)}
                  disabled={selected.status === "resolved"}
                  className="ml-auto bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-4" /> Resolve
                </Button>
              </div>

              {/* Messages */}
              <div
                ref={messagesScrollRef}
                className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4"
              >
                {messagesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-12 w-2/3 rounded-lg bg-muted/60 animate-pulse",
                          i % 2 === 1 && "ml-auto"
                        )}
                      />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState
                    title="No messages yet"
                    description="Start the conversation by sending the first reply."
                    icon={MessageSquare}
                    className="py-16"
                  />
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} message={m} />)
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="border-t p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    placeholder="Type your reply… (Enter to send, Shift+Enter for newline)"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="min-h-12 max-h-32 flex-1 text-sm"
                    maxLength={1000}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="bg-teal text-white hover:bg-teal/90"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Send
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Customer replies are simulated 4s after your message.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: ticket metadata */}
        <div className="lg:col-span-1">
          {!selected ? (
            <div className="rounded-xl border border-border/60 bg-card shadow-sm">
              <EmptyState
                title="No ticket selected"
                description="Pick a ticket to view metadata and quick stats."
                icon={Activity}
                className="py-20"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="rounded-xl border border-border/60 bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Ticket details</p>
                </div>
                <div className="space-y-3 p-4">
                  <MetaItem icon={UserCircle2} label="Customer" value={userName} />
                  <MetaItem icon={Tag} label="Category" value={selected.category} className="capitalize" />
                  <MetaItem
                    icon={Activity}
                    label="Priority"
                    value={selected.priority}
                    className="capitalize"
                  />
                  <MetaItem icon={CalendarDays} label="Created" value={formatDate(selected.createdAt)} />
                  <MetaItem icon={Clock4} label="Last updated" value={timeAgo(selected.updatedAt)} />
                  <MetaItem icon={UserCircle2} label="Assigned agent" value={agentName} />
                </div>
              </div>

              {/* Quick stats */}
              <div className="rounded-xl border border-border/60 bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Quick stats</p>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4">
                  <StatTile
                    label="Messages"
                    value={messages.length}
                    icon={MessageSquare}
                  />
                  <StatTile
                    label="Avg response"
                    value="2m 14s"
                    icon={Gauge}
                  />
                  <StatTile
                    label="First reply"
                    value="3m 02s"
                    icon={Clock4}
                  />
                  <StatTile
                    label="Satisfaction"
                    value="4.8/5"
                    icon={CheckCheck}
                  />
                </div>
              </div>

              {/* Customer snapshot */}
              <div className="rounded-xl border border-border/60 bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Customer snapshot</p>
                </div>
                <div className="space-y-2 p-4 text-xs">
                  {(() => {
                    const u = users.find((x) => x.id === selected.userId);
                    if (!u) {
                      return (
                        <p className="text-muted-foreground">Customer record not loaded.</p>
                      );
                    }
                    return (
                      <>
                        <MetaItem icon={UserCircle2} label="Tier" value={u.tier} className="capitalize" />
                        <MetaItem icon={CheckCheck} label="KYC" value={u.kycVerified ? "Verified" : "Pending"} />
                        <MetaItem
                          icon={CalendarDays}
                          label="Member since"
                          value={formatDate(u.createdAt)}
                        />
                        <MetaItem
                          icon={Clock4}
                          label="Last login"
                          value={u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}
                        />
                        <Separator className="my-2" />
                        <p className="text-muted-foreground">
                          Email
                        </p>
                        <p className="break-words text-sm font-medium text-foreground">
                          {u.email}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolve confirm */}
      <ConfirmDialog
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        onConfirm={confirmResolve}
        title="Resolve this ticket?"
        description="The customer will be notified that the ticket is resolved. The conversation remains read-only."
        confirmLabel="Resolve ticket"
        variant="success"
      >
        {selected && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ticket</span>
              <span className="font-mono font-semibold">{selected.id}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Subject</span>
              <span className="font-medium">{selected.subject}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>

      {/* Escalate confirm */}
      <ConfirmDialog
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        onConfirm={confirmEscalate}
        title="Escalate this ticket?"
        description="Escalation flags the ticket as high priority and routes it to a senior support agent. A system message will be posted in the chat."
        confirmLabel="Escalate ticket"
        variant="warning"
      >
        {selected && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ticket</span>
              <span className="font-mono font-semibold">{selected.id}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Priority</span>
              <span className="font-medium capitalize">
                {selected.priority} → <span className="text-amber-700">high</span>
              </span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.sender === "system") {
    return (
      <div className="flex justify-center">
        <div className="max-w-md rounded-md bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{message.senderName}</p>
          <p className="mt-0.5">{message.body}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {formatDateTime(message.createdAt)}
          </p>
        </div>
      </div>
    );
  }
  const isAgent = message.sender === "agent";
  return (
    <div
      className={cn("flex", isAgent ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          isAgent
            ? "rounded-br-sm bg-teal text-white"
            : "rounded-bl-sm bg-muted text-foreground"
        )}
      >
        <p className="mb-0.5 text-[10px] font-semibold opacity-80">
          {message.senderName}
        </p>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px]",
            isAgent ? "justify-end text-white/70" : "text-muted-foreground"
          )}
        >
          {formatDateTime(message.createdAt)}
          {isAgent && (
            <span className="inline-flex items-center gap-0.5">
              · {message.status === "read" ? <CheckCheck className="size-3" /> : <CheckCircle2 className="size-3" />}
              {message.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof UserCircle2;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <span className={cn("text-right font-medium text-foreground break-words", className)}>
        {value}
      </span>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof MessageSquare;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="size-3.5 text-teal" />
      </div>
      <p className="mt-1 text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
