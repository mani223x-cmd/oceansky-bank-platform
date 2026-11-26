"use client";

// ============================================================================
// OceanSky Bank — Notifications (customer)
// ----------------------------------------------------------------------------
// Lists the user's notifications with category filters, type icons, unread
// indicators and stats. Clicking a notification marks it as read (and
// navigates to its actionUrl if present). "Mark all as read" clears unread
// state for the whole inbox.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Bell,
  CheckCheck,
  CreditCard,
  Gift,
  Headset,
  Info,
  Send,
  ShieldCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useAuthStore } from "@/lib/store/auth.store";
import { useNotificationStore } from "@/lib/store/notification.store";
import { useRouterStore } from "@/lib/router";
import { timeAgo } from "@/lib/format";
import type { AppNotification, NotificationType } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// ----------------------------------------------------------------------------
// Type styling — icon + accent color per notification type
// ----------------------------------------------------------------------------
const TYPE_STYLE: Record<
  NotificationType,
  { icon: typeof Info; color: string; bg: string }
> = {
  transaction: { icon: ArrowLeftRight, color: "text-teal", bg: "bg-teal/10" },
  security: { icon: ShieldCheck, color: "text-amber-600", bg: "bg-amber-500/10" },
  promo: { icon: Gift, color: "text-turquoise", bg: "bg-turquoise/15" },
  system: { icon: Info, color: "text-muted-foreground", bg: "bg-muted" },
  support: { icon: Headset, color: "text-teal", bg: "bg-teal/10" },
  card: { icon: CreditCard, color: "text-teal", bg: "bg-teal/10" },
  transfer: { icon: Send, color: "text-teal", bg: "bg-teal/10" },
};

type FilterKey =
  | "all"
  | "unread"
  | "transaction"
  | "security"
  | "promo"
  | "support";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "transaction", label: "Transaction" },
  { key: "security", label: "Security" },
  { key: "promo", label: "Promo" },
  { key: "support", label: "Support" },
];

// ----------------------------------------------------------------------------
// Notifications
// ----------------------------------------------------------------------------
export function Notifications() {
  const user = useAuthStore((s) => s.user);
  const go = useRouterStore((s) => s.go);

  const items = useNotificationStore((s) => s.items);
  const setItems = useNotificationStore((s) => s.setItems);
  const markReadStore = useNotificationStore((s) => s.markRead);
  const markAllReadStore = useNotificationStore((s) => s.markAllRead);
  const unreadCount = useNotificationStore((s) => s.unreadCount());

  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

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
        const res = await services.notification.listByUser(user.id);
        if (cancelled) return;
        if (res.ok && res.data) setItems(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, setItems]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = items.length;
    const unread = items.filter((n) => !n.read).length;
    const security = items.filter((n) => n.type === "security").length;
    const promo = items.filter((n) => n.type === "promo").length;
    return { total, unread, security, promo };
  }, [items]);

  // ---- Filtered list ----
  const filtered = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    switch (filter) {
      case "all":
        return sorted;
      case "unread":
        return sorted.filter((n) => !n.read);
      default:
        return sorted.filter((n) => n.type === filter);
    }
  }, [items, filter]);

  // ---- Handlers ----
  async function handleMarkAllRead() {
    if (!user || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await services.notification.markAllRead(user.id);
      if (res.ok) {
        markAllReadStore();
      }
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleRowClick(n: AppNotification) {
    if (!n.read) {
      // optimistic
      markReadStore(n.id);
      services.notification.markRead(n.id);
    }
    if (n.actionUrl) {
      const clean = n.actionUrl.replace(/^#\/?/, "");
      go(clean);
    }
  }

  // ---- Render ----
  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Notifications"
          description="Stay informed about your account activity."
        />
        <EmptyState
          icon={Bell}
          title="Sign in to view notifications"
          description="Your account activity will appear here once you log in."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay informed about your account activity."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll || stats.unread === 0}
          >
            <CheckCheck className="size-4" />
            {markingAll ? "Marking..." : "Mark all as read"}
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={Bell}
          accent="teal"
        />
        <StatCard
          label="Unread"
          value={stats.unread}
          icon={Info}
          accent="ocean"
        />
        <StatCard
          label="Security"
          value={stats.security}
          icon={ShieldCheck}
          accent="muted"
        />
        <StatCard
          label="Promo"
          value={stats.promo}
          icon={Gift}
          accent="turquoise"
        />
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="h-9 w-max">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="gap-1.5">
                {f.label}
                {f.key === "unread" && stats.unread > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-teal px-1 text-[10px] font-semibold text-primary-foreground">
                    {stats.unread}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications"
            description={
              filter === "all"
                ? "You're all caught up. New activity will appear here."
                : "No notifications in this category."
            }
          />
        ) : (
          filtered.map((n) => {
            const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.system;
            const Icon = style.icon;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleRowClick(n)}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:border-teal/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
                  !n.read && "bg-teal/[0.04] border-teal/20",
                )}
              >
                {/* Unread dot */}
                <span className="relative mt-1 flex h-2 w-2 shrink-0">
                  {!n.read && (
                    <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-teal opacity-60" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex h-2 w-2 rounded-full",
                      n.read ? "bg-transparent" : "bg-teal",
                    )}
                  />
                </span>

                {/* Type icon */}
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg",
                    style.bg,
                  )}
                >
                  <Icon className={cn("size-4", style.color)} />
                </span>

                {/* Body */}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        n.read ? "font-medium" : "font-semibold",
                      )}
                    >
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {n.body}
                  </span>
                  {n.actionLabel && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-teal">
                      {n.actionLabel}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
