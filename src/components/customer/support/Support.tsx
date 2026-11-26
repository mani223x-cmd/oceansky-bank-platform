"use client";

// ============================================================================
// OceanSky Bank — Customer Support
// ----------------------------------------------------------------------------
// Ticket list + chat panel + FAQ accordion. Customers can create new tickets,
// exchange messages with a mock agent (with a simulated typing indicator),
// escalate tickets, and browse FAQ articles grouped by category.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  Check,
  Headset,
  LifeBuoy,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import { useRouterStore } from "@/lib/router";
import { formatRelativeShort, timeAgo } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type {
  ChatMessage,
  FAQItem,
  SupportTicket,
  TicketPriority,
  TicketStatus,
} from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const TICKET_CATEGORIES = [
  "General",
  "Accounts",
  "Transfers",
  "Cards",
  "Bills",
  "Statements",
  "Security",
  "Other",
] as const;

const PRIORITY_OPTIONS: TicketPriority[] = ["low", "medium", "high"];

const STATUS_BADGE: Record<TicketStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-teal/10 text-teal border-teal/20" },
  pending_agent: {
    label: "Awaiting agent",
    cls: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  pending_customer: {
    label: "Awaiting you",
    cls: "bg-turquoise/15 text-turquoise border-turquoise/20",
  },
  escalated: {
    label: "Escalated",
    cls: "bg-destructive/10 text-destructive border-destructive/20",
  },
  resolved: {
    label: "Resolved",
    cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  closed: { label: "Closed", cls: "bg-muted text-muted-foreground border-border" },
};

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-turquoise/15 text-turquoise border-turquoise/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  urgent: "bg-destructive text-white border-destructive",
};

const AGENT_NAME = "Sarah Mitchell";
const AGENT_REPLY =
  "Thanks for reaching out. I'm looking into this now and will get back to you shortly. — Sarah, OceanSky Support";

// ----------------------------------------------------------------------------
// Support
// ----------------------------------------------------------------------------
export function Support() {
  const user = useAuthStore((s) => s.user);
  const go = useRouterStore((s) => s.go);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);

  // New ticket dialog
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    category: "General" as (typeof TICKET_CATEGORIES)[number],
    priority: "medium" as TicketPriority,
    message: "",
  });
  const [creating, setCreating] = useState(false);

  // Escalate dialog
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [escalating, setEscalating] = useState(false);

  // Message input
  const [draft, setDraft] = useState("");

  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // ---- Load tickets ----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoadingTickets(false);
        return;
      }
      setLoadingTickets(true);
      try {
        const res = await services.support.listTicketsByUser(user.id);
        if (cancelled) return;
        if (res.ok && res.data) {
          setTickets(res.data);
          if (res.data[0] && !selectedId) setSelectedId(res.data[0].id);
        }
      } finally {
        if (!cancelled) setLoadingTickets(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  // ---- Load messages when selection changes ----
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingMessages(true);
      try {
        const res = await services.support.listMessages(selectedId!);
        if (cancelled) return;
        if (res.ok && res.data) setMessages(res.data);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // ---- Auto scroll on new messages / typing ----
  useEffect(() => {
    const el = messagesEndRef.current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, agentTyping]);

  // ---- Create ticket ----
  async function handleCreateTicket() {
    if (!user) return;
    if (!form.subject.trim() || !form.message.trim()) {
      toast({
        title: "Missing details",
        description: "Please provide a subject and an initial message.",
      });
      return;
    }
    setCreating(true);
    try {
      const res = await services.support.createTicket({
        userId: user.id,
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
      });
      if (!res.ok || !res.data) {
        toast({ title: "Could not create ticket", description: res.error });
        return;
      }
      const ticket = res.data;
      await services.support.sendMessage(
        ticket.id,
        form.message.trim(),
        "customer",
        `${user.firstName} ${user.lastName}`,
      );
      // Reload messages for the new ticket
      const msgs = await services.support.listMessages(ticket.id);
      if (msgs.ok && msgs.data) setMessages(msgs.data);
      setTickets((prev) => [ticket, ...prev]);
      setSelectedId(ticket.id);
      setNewOpen(false);
      setForm({
        subject: "",
        category: "General",
        priority: "medium",
        message: "",
      });
      toast({
        title: "Ticket created",
        description: `Reference ${ticket.id.toUpperCase()}. An agent will respond shortly.`,
      });
    } finally {
      setCreating(false);
    }
  }

  // ---- Send message ----
  async function handleSend() {
    if (!selectedId || !user || !draft.trim() || agentTyping) return;
    const body = draft.trim();
    setDraft("");

    // optimistic: append immediately
    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      ticketId: selectedId,
      sender: "customer",
      senderName: `${user.firstName} ${user.lastName}`,
      body,
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await services.support.sendMessage(
        selectedId,
        body,
        "customer",
        `${user.firstName} ${user.lastName}`,
      );
      if (res.ok && res.data) {
        // Replace optimistic with persisted message
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? res.data! : m)),
        );
      }
      // Update ticket status to pending_agent
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                status: "pending_agent",
                updatedAt: new Date().toISOString(),
                unreadByCustomer: false,
              }
            : t,
        ),
      );

      // Simulate agent typing + reply
      setAgentTyping(true);
      const delayMs = 2000 + Math.floor(Math.random() * 1000);
      window.setTimeout(async () => {
        const reply = await services.support.sendMessage(
          selectedId,
          AGENT_REPLY,
          "agent",
          AGENT_NAME,
        );
        if (reply.ok && reply.data) {
          setMessages((prev) => [...prev, reply.data!]);
        }
        setTickets((prev) =>
          prev.map((t) =>
            t.id === selectedId
              ? {
                  ...t,
                  status: "pending_customer",
                  updatedAt: new Date().toISOString(),
                  unreadByCustomer: true,
                }
              : t,
          ),
        );
        setAgentTyping(false);
      }, delayMs);
    } catch {
      toast({ title: "Failed to send message", description: "Please try again." });
      setAgentTyping(false);
    }
  }

  function handleDraftKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ---- Escalate ----
  async function handleEscalate() {
    if (!selectedId || !escalateReason.trim()) return;
    setEscalating(true);
    try {
      const res = await services.support.escalate(selectedId, escalateReason.trim());
      if (res.ok && res.data) {
        setTickets((prev) => prev.map((t) => (t.id === selectedId ? res.data! : t)));
        const msgs = await services.support.listMessages(selectedId);
        if (msgs.ok && msgs.data) setMessages(msgs.data);
        toast({
          title: "Ticket escalated",
          description: "A senior agent will take over shortly.",
        });
        setEscalateOpen(false);
        setEscalateReason("");
      }
    } finally {
      setEscalating(false);
    }
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Customer Support"
          description="Chat with our team or browse help articles."
        />
        <EmptyState
          icon={Headset}
          title="Sign in to contact support"
          description="Log in to view your tickets and chat with our team."
        />
      </div>
    );
  }

  const isClosed =
    selectedTicket?.status === "resolved" || selectedTicket?.status === "closed";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Support"
        description="Chat with our team or browse help articles."
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            New ticket
          </Button>
        }
      />

      {/* Two-column layout: tickets + chat */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ticket list */}
        <div className="lg:col-span-1">
          <SectionCard
            title="Your tickets"
            description={`${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"}`}
            icon={MessageSquare}
            bodyClassName="p-0"
          >
            <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
              {loadingTickets ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </div>
              ) : tickets.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No tickets yet"
                  description="Start a new ticket to chat with our team."
                  action={
                    <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                      <Plus className="size-4" />
                      New ticket
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border/60">
                  {tickets.map((t) => {
                    const sb = STATUS_BADGE[t.status];
                    const active = t.id === selectedId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className={cn(
                            "flex w-full flex-col gap-1.5 p-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
                            active && "bg-teal/[0.06]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "text-sm leading-snug",
                                active ? "font-semibold" : "font-medium",
                              )}
                            >
                              {t.subject}
                            </span>
                            {t.unreadByCustomer && (
                              <span className="mt-1 size-2 shrink-0 rounded-full bg-teal" />
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0", sb.cls)}
                            >
                              {sb.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 capitalize",
                                PRIORITY_BADGE[t.priority],
                              )}
                            >
                              {t.priority}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 text-muted-foreground"
                            >
                              {t.category}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            Updated {timeAgo(t.updatedAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Chat panel */}
        <div className="lg:col-span-2">
          <SectionCard
            title={selectedTicket?.subject ?? "Chat"}
            description={
              selectedTicket
                ? `Reference ${selectedTicket.id.toUpperCase()}`
                : "Select a ticket to start chatting"
            }
            icon={Headset}
            action={
              selectedTicket ? (
                <div className="flex items-center gap-2">
                  {selectedTicket.status !== "escalated" &&
                    selectedTicket.status !== "resolved" &&
                    selectedTicket.status !== "closed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEscalateOpen(true)}
                      >
                        <TrendingUp className="size-4" />
                        Escalate
                      </Button>
                    )}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      STATUS_BADGE[selectedTicket.status].cls,
                    )}
                  >
                    {STATUS_BADGE[selectedTicket.status].label}
                  </Badge>
                </div>
              ) : null
            }
            bodyClassName="p-0"
          >
            {!selectedTicket ? (
              <EmptyState
                icon={MessageSquare}
                title="Select a ticket to start chatting"
                description="Pick a conversation from the list, or browse the FAQs below."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const el = document.getElementById("faq-section");
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    <LifeBuoy className="size-4" />
                    Browse FAQs
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col">
                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  className="flex min-h-[320px] max-h-[60vh] flex-col gap-3 overflow-y-auto p-4 scrollbar-thin"
                >
                  {loadingMessages ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className={cn(
                            "h-14 w-2/3 rounded-lg",
                            i % 2 === 0 ? "" : "ml-auto",
                          )}
                        />
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="m-auto text-center text-sm text-muted-foreground">
                      No messages yet. Send the first message below.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <MessageBubble key={m.id} message={m} />
                    ))
                  )}

                  {/* Typing indicator */}
                  {agentTyping && (
                    <div className="flex items-center gap-2 self-start">
                      <span className="text-xs font-medium text-muted-foreground">
                        {AGENT_NAME}
                      </span>
                      <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border/60 bg-muted px-3 py-2">
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                      </span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <Separator />

                {/* Input */}
                <div className="flex items-end gap-2 p-3">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleDraftKeyDown}
                    placeholder={
                      isClosed
                        ? "This ticket is closed. Start a new ticket to continue."
                        : "Type a message... (Enter to send, Shift+Enter for newline)"
                    }
                    rows={2}
                    disabled={isClosed || agentTyping}
                    className="min-h-[44px] resize-none"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!draft.trim() || agentTyping || isClosed}
                    size="icon"
                    aria-label="Send message"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* FAQs */}
      <FAQSection />

      {/* New ticket dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New support ticket</DialogTitle>
            <DialogDescription>
              Tell us what you need help with and an agent will respond shortly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-subject">Subject</Label>
              <Input
                id="t-subject"
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
                placeholder="Briefly describe your issue"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      category: v as (typeof TICKET_CATEGORIES)[number],
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, priority: v as TicketPriority }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-message">Initial message</Label>
              <Textarea
                id="t-message"
                value={form.message}
                onChange={(e) =>
                  setForm((f) => ({ ...f, message: e.target.value }))
                }
                placeholder="Provide as much detail as possible..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket} disabled={creating}>
              {creating ? "Creating..." : "Create ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalate dialog */}
      <ConfirmDialog
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        onConfirm={handleEscalate}
        title="Escalate this ticket?"
        description="Escalation routes your case to a senior agent for higher-priority handling."
        confirmLabel={escalating ? "Escalating..." : "Escalate"}
        variant="warning"
      >
        <div className="space-y-1.5">
          <Label htmlFor="esc-reason">Reason</Label>
          <Textarea
            id="esc-reason"
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            placeholder="Why should this ticket be escalated?"
            rows={3}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// MessageBubble — single chat message
// ----------------------------------------------------------------------------
function MessageBubble({ message }: { message: ChatMessage }) {
  const isCustomer = message.sender === "customer";
  const isSystem = message.sender === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center self-center px-2 py-1">
        <span className="rounded-full bg-muted px-3 py-1.5 text-center text-[11px] text-muted-foreground">
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        isCustomer ? "self-end items-end" : "self-start items-start",
      )}
    >
      <span className="text-[11px] font-medium text-muted-foreground">
        {message.senderName}
      </span>
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          isCustomer
            ? "rounded-br-sm bg-teal text-primary-foreground"
            : "rounded-bl-sm border border-border/60 bg-card",
        )}
      >
        {message.body}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>{formatRelativeShort(message.createdAt)}</span>
        {isCustomer && (
          <span
            className={cn(
              "inline-flex items-center",
              message.status === "read" ? "text-teal" : "text-muted-foreground",
            )}
          >
            {message.status === "sent" ? (
              <Check className="size-3" />
            ) : (
              <CheckCheck className="size-3" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// FAQSection — accordion grouped by category
// ----------------------------------------------------------------------------
function FAQSection() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<Record<string, "up" | "down">>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await services.support.listFAQs();
        if (cancelled) return;
        if (res.ok && res.data) setFaqs(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, FAQItem[]>();
    for (const f of faqs) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [faqs]);

  function handleVote(id: string, dir: "up" | "down") {
    if (voted[id]) return;
    setVoted((v) => ({ ...v, [id]: dir }));
    toast({ title: "Thanks for your feedback" });
  }

  return (
    <SectionCard
      title="Frequently asked questions"
      description="Browse common questions, grouped by topic."
      icon={LifeBuoy}
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="No FAQs available"
          description="Help articles will appear here."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-teal" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </h4>
              </div>
              <Accordion type="single" collapsible className="rounded-lg border border-border/60 px-3">
                {items.map((f) => (
                  <AccordionItem key={f.id} value={f.id}>
                    <AccordionTrigger className="text-sm">
                      {f.question}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                      <p>{f.answer}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-muted-foreground">
                          Was this helpful?
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "size-7",
                            voted[f.id] === "up" && "bg-teal/10 text-teal",
                          )}
                          onClick={() => handleVote(f.id, "up")}
                          aria-label="Helpful"
                        >
                          <ThumbsUp className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "size-7",
                            voted[f.id] === "down" && "bg-destructive/10 text-destructive",
                          )}
                          onClick={() => handleVote(f.id, "down")}
                          aria-label="Not helpful"
                        >
                          <ThumbsDown className="size-3.5" />
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
