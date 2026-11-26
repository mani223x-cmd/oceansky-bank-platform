"use client";
import { useMemo, useState } from "react";
import {
  Bell,
  Send,
  Megaphone,
  ShieldAlert,
  Gift,
  Wrench,
  Receipt,
  History,
  Users,
  Sparkles,
  CheckCircle2,
  Info,
} from "lucide-react";
import { services } from "@/lib/services";
import { MOCK_NOTIFICATIONS } from "@/lib/mock";
import type { NotificationType } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type Audience = "all" | "premium" | "standard" | "private";

const TYPE_OPTIONS: { value: NotificationType; label: string; icon: typeof Bell }[] = [
  { value: "transaction", label: "Transaction", icon: Receipt },
  { value: "security", label: "Security", icon: ShieldAlert },
  { value: "promo", label: "Promo", icon: Gift },
  { value: "system", label: "System", icon: Wrench },
  { value: "support", label: "Support", icon: Bell },
  { value: "card", label: "Card", icon: Receipt },
  { value: "transfer", label: "Transfer", icon: Receipt },
];

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "all", label: "All customers" },
  { value: "premium", label: "Premium only" },
  { value: "standard", label: "Standard only" },
  { value: "private", label: "Private only" },
];

const TYPE_BADGE: Record<NotificationType, string> = {
  transaction: "bg-teal/15 text-teal",
  security: "bg-destructive/10 text-destructive",
  promo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  system: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  support: "bg-ocean/15 text-ocean",
  card: "bg-muted text-muted-foreground",
  transfer: "bg-teal/15 text-teal",
};

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  transaction: Receipt,
  security: ShieldAlert,
  promo: Gift,
  system: Wrench,
  support: Bell,
  card: Receipt,
  transfer: Receipt,
};

interface Template {
  key: string;
  label: string;
  description: string;
  icon: typeof Bell;
  title: string;
  body: string;
  type: NotificationType;
  audience: Audience;
}

const TEMPLATES: Template[] = [
  {
    key: "security",
    label: "Security alert",
    description: "Warn customers about a new threat or breach.",
    icon: ShieldAlert,
    title: "Security Alert: Unusual sign-in detected",
    body:
      "We noticed a new sign-in to your OceanSky account from an unrecognized device. If this was not you, please secure your account immediately by reviewing your active sessions and changing your password.",
    type: "security",
    audience: "all",
  },
  {
    key: "promo",
    label: "Promo announcement",
    description: "Promote a limited-time offer to Premium customers.",
    icon: Gift,
    title: "Zero transfer fees week — Premium members only",
    body:
      "Enjoy 0% transfer fees on all internal transfers this week, exclusively for Premium members. Upgrade today and save more every month with OceanSky Bank.",
    type: "promo",
    audience: "premium",
  },
  {
    key: "maintenance",
    label: "System maintenance",
    description: "Notify customers of scheduled downtime.",
    icon: Wrench,
    title: "Scheduled maintenance window",
    body:
      "OceanSky services will be unavailable on Sunday from 2:00 AM to 4:00 AM ET for scheduled maintenance. We apologise for any inconvenience. All pending transactions will be processed once service resumes.",
    type: "system",
    audience: "all",
  },
  {
    key: "confirmation",
    label: "Transaction confirmation",
    description: "Acknowledge a successful transaction.",
    icon: Receipt,
    title: "Transaction confirmation",
    body:
      "Your recent transaction has been processed successfully. You can view the full details, including reference and receipt, in your transaction history.",
    type: "transaction",
    audience: "all",
  },
];

// Derive a mock "recent broadcasts" list from MOCK_NOTIFICATIONS.
// We surface the most recent 5 entries and synthesise audience + recipient
// counts that would normally come from the broadcast service.
const RECENT_BROADCASTS = MOCK_NOTIFICATIONS.slice(0, 5).map((n, idx) => {
  const audiences: Audience[] = ["all", "premium", "all", "all", "standard"];
  const counts = [4, 1, 4, 4, 2];
  return {
    id: n.id,
    title: n.title,
    type: n.type,
    audience: audiences[idx % audiences.length],
    recipientCount: counts[idx % counts.length],
    createdAt: n.createdAt,
  };
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NotificationType>("system");
  const [audience, setAudience] = useState<Audience>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastSentCount, setLastSentCount] = useState<number | null>(null);

  const charCount = body.length;
  const charLimit = 500;
  const formValid = title.trim().length > 0 && body.trim().length > 0;

  const audienceLabel = useMemo(
    () => AUDIENCE_OPTIONS.find((a) => a.value === audience)?.label || "All customers",
    [audience]
  );

  const typeLabel = useMemo(
    () => TYPE_OPTIONS.find((t) => t.value === type)?.label || "System",
    [type]
  );

  function applyTemplate(t: Template) {
    setTitle(t.title);
    setBody(t.body);
    setType(t.type);
    setAudience(t.audience);
    toast.success(`Template applied: ${t.label}.`, {
      description: "Edit the message before broadcasting.",
    });
  }

  function openConfirm() {
    if (!formValid) {
      toast.error("Please enter a title and body before sending.");
      return;
    }
    setConfirmOpen(true);
  }

  async function confirmSend() {
    setSending(true);
    const res = await services.admin.broadcastNotification({
      title: title.trim(),
      body: body.trim(),
      type,
      audience,
    });
    if (res.ok && res.data) {
      setLastSentCount(res.data.sent);
      toast.success(`Notification sent to ${res.data.sent} recipient${res.data.sent === 1 ? "" : "s"}.`, {
        description: `${typeLabel} · ${audienceLabel}`,
        icon: <CheckCircle2 className="size-4 text-emerald-600" />,
      });
      // Reset the form.
      setTitle("");
      setBody("");
      setType("system");
      setAudience("all");
    } else {
      toast.error(res.error || "Broadcast failed to send.");
    }
    setSending(false);
    setConfirmOpen(false);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Notifications"
        description="Send and manage customer notifications."
        actions={
          <Badge variant="outline" className="border-teal/40 bg-teal/10 text-teal gap-1.5">
            <Megaphone className="size-3.5" /> Broadcast studio
          </Badge>
        }
      />

      {/* Two column: form + recent broadcasts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Broadcast notification"
            description="Send a push notification to a customer segment."
            icon={Send}
            action={
              lastSentCount !== null ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 gap-1.5">
                  <CheckCircle2 className="size-3" /> Last sent: {lastSentCount}
                </Badge>
              ) : undefined
            }
            bodyClassName="space-y-4"
          >
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="notif-title"
                placeholder="e.g. Security Alert: New sign-in detected"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
              <p className="text-[10px] text-muted-foreground">
                {title.length}/120 — keep titles short and actionable.
              </p>
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-body">
                Body <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="notif-body"
                placeholder="Write the notification body…"
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, charLimit))}
                className="min-h-32 text-sm"
                maxLength={charLimit}
              />
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">
                  Max 500 characters. Plain text only.
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    charCount > charLimit - 50
                      ? "text-amber-600 font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {charCount}/{charLimit}
                </span>
              </div>
            </div>

            {/* Type + Audience */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="notif-type">Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as NotificationType)}>
                  <SelectTrigger id="notif-type" className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <t.icon className="size-3.5 text-muted-foreground" />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notif-audience">Audience</Label>
                <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                  <SelectTrigger id="notif-audience" className="w-full">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <div className="mt-2 flex items-start gap-2">
                <div className="grid place-items-center size-8 rounded-lg bg-teal/15 text-teal shrink-0">
                  {(() => {
                    const Icon = TYPE_ICON[type];
                    return <Icon className="size-4" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {title.trim() || "Notification title"}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-3 break-words">
                    {body.trim() || "Notification body will appear here."}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Badge className={cn("text-[9px] capitalize", TYPE_BADGE[type])}>
                      {typeLabel}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] capitalize">
                      {audienceLabel}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Send button */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5" /> Broadcasts are logged to the audit trail.
              </p>
              <Button
                onClick={openConfirm}
                disabled={!formValid || sending}
                className="bg-teal text-white hover:bg-teal/90"
              >
                <Send className="size-4" />
                Send broadcast
              </Button>
            </div>
          </SectionCard>
        </div>

        {/* Recent broadcasts */}
        <div className="lg:col-span-1">
          <SectionCard
            title="Recent broadcasts"
            description="Last 5 sent notifications"
            icon={History}
            bodyClassName="p-3"
          >
            <div className="space-y-2">
              {RECENT_BROADCASTS.map((b) => {
                const Icon = TYPE_ICON[b.type];
                return (
                  <div
                    key={b.id}
                    className="rounded-lg border border-border/60 bg-background p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="grid place-items-center size-7 rounded-md bg-teal/10 text-teal shrink-0">
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{b.title}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Badge className={cn("text-[9px] capitalize", TYPE_BADGE[b.type])}>
                            {b.type}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {b.audience}
                          </Badge>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{timeAgo(b.createdAt)}</span>
                          <span className="flex items-center gap-1">
                            <Users className="size-3" />
                            {b.recipientCount.toLocaleString()} recipients
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Templates */}
      <SectionCard
        title="Notification templates"
        description="Pre-built messages — click to load into the composer"
        icon={Sparkles}
        bodyClassName="p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => applyTemplate(t)}
                className="group rounded-xl border border-border/60 bg-background p-4 text-left transition-all hover:border-teal/50 hover:bg-teal/[0.04] hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="grid place-items-center size-9 rounded-lg bg-teal/15 text-teal transition-colors group-hover:bg-teal group-hover:text-white">
                    <Icon className="size-4" />
                  </div>
                  <Badge
                    className={cn("text-[9px] capitalize", TYPE_BADGE[t.type])}
                  >
                    {t.type}
                  </Badge>
                </div>
                <p className="mt-3 text-sm font-semibold">{t.label}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                  {t.description}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground capitalize">
                  Audience: {t.audience.replace("_", " ")}
                </p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Confirm broadcast */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmSend}
        title="Send this broadcast?"
        description="The notification will be delivered immediately to every customer in the selected segment. This action cannot be undone."
        confirmLabel={sending ? "Sending…" : "Send broadcast"}
        variant="default"
      >
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
          <div className="flex items-start gap-2">
            <div className="grid place-items-center size-7 rounded-md bg-teal/15 text-teal shrink-0">
              {(() => {
                const Icon = TYPE_ICON[type];
                return <Icon className="size-3.5" />;
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{title.trim()}</p>
              <p className="mt-0.5 line-clamp-2 text-muted-foreground break-words">
                {body.trim()}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <Badge className={cn("text-[9px] capitalize", TYPE_BADGE[type])}>
                  {typeLabel}
                </Badge>
                <Badge variant="outline" className="text-[9px] capitalize">
                  {audienceLabel}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
