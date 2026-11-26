"use client";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Megaphone,
  Plus,
  PlayCircle,
  PauseCircle,
  CalendarClock,
  CheckCircle2,
  Copy,
  Pencil,
  Trash2,
  Eye,
  MousePointerClick,
  Target,
  TrendingUp,
  Sparkles,
  Loader2,
  Save,
} from "lucide-react";
import { services } from "@/lib/services";
import type { Campaign, CampaignStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
  { value: "draft", label: "Draft" },
];

const AUDIENCE_OPTIONS: { value: Campaign["audience"]; label: string }[] = [
  { value: "all", label: "All customers" },
  { value: "premium", label: "Premium only" },
  { value: "standard", label: "Standard only" },
  { value: "private", label: "Private only" },
];

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

const ACCENT_OPTIONS: { value: string; label: string; bar: string }[] = [
  { value: "teal", label: "Teal", bar: "bg-teal" },
  { value: "ocean", label: "Ocean", bar: "bg-ocean" },
  { value: "graphite", label: "Graphite", bar: "bg-zinc-700" },
  { value: "sand", label: "Sand", bar: "bg-amber-500" },
];

const ACCENT_BAR: Record<string, string> = {
  teal: "bg-teal",
  ocean: "bg-ocean",
  graphite: "bg-zinc-700",
  sand: "bg-amber-500",
};

const ACCENT_TEXT: Record<string, string> = {
  teal: "text-teal",
  ocean: "text-ocean",
  graphite: "text-zinc-700 dark:text-zinc-300",
  sand: "text-amber-600",
};

const STATUS_BADGE: Record<CampaignStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  scheduled: "bg-teal/15 text-teal",
  paused: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  ended: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
};

const AUDIENCE_BADGE: Record<Campaign["audience"], string> = {
  all: "bg-teal/15 text-teal",
  premium: "bg-ocean/15 text-ocean",
  standard: "bg-muted text-muted-foreground",
  private: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctr(impressions: number, clicks: number): number {
  if (impressions <= 0) return 0;
  return (clicks / impressions) * 100;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function accentBar(color: string): string {
  return ACCENT_BAR[color] || "bg-teal";
}

// ---------------------------------------------------------------------------
// Campaign form values
// ---------------------------------------------------------------------------

interface CampaignFormValues {
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: Campaign["audience"];
  status: CampaignStatus;
  accentColor: string;
  startsAt: Date;
  endsAt: Date;
}

const EMPTY_FORM: CampaignFormValues = {
  title: "",
  subtitle: "",
  description: "",
  ctaLabel: "Learn more",
  ctaUrl: "#profile/tier",
  audience: "all",
  status: "draft",
  accentColor: "teal",
  startsAt: new Date(),
  endsAt: new Date(Date.now() + 7 * 86_400_000),
};

function campaignToForm(c: Campaign): CampaignFormValues {
  return {
    title: c.title,
    subtitle: c.subtitle,
    description: c.description,
    ctaLabel: c.ctaLabel,
    ctaUrl: c.ctaUrl,
    audience: c.audience,
    status: c.status,
    accentColor: c.accentColor,
    startsAt: parseISO(c.startsAt),
    endsAt: parseISO(c.endsAt),
  };
}

// ---------------------------------------------------------------------------
// Date picker field
// ---------------------------------------------------------------------------

function DatePickerField({
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
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start font-normal"
          >
            <CalendarIcon className="size-4 text-muted-foreground" />
            {value ? format(value, "d MMM yyyy") : "Pick a date"}
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

// ---------------------------------------------------------------------------
// Campaign form dialog (shared create + edit)
// ---------------------------------------------------------------------------

interface CampaignFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: CampaignFormValues;
  onClose: () => void;
  onSubmit: (values: CampaignFormValues) => Promise<void>;
}

function CampaignFormDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: CampaignFormDialogProps) {
  const [values, setValues] = useState<CampaignFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initial ? { ...initial } : { ...EMPTY_FORM });
    }
  }, [open, initial]);

  function set<K extends keyof CampaignFormValues>(key: K, v: CampaignFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  const formValid =
    values.title.trim().length > 0 &&
    values.subtitle.trim().length > 0 &&
    values.endsAt >= values.startsAt;

  async function handleSubmit() {
    if (!formValid) {
      toast.error("Please complete the title, subtitle and a valid date range.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New campaign" : "Edit campaign"}
          </DialogTitle>
          <DialogDescription>
            Configure the campaign content, audience and schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Title */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cmp-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cmp-title"
              placeholder="e.g. Zero transfer fees week"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cmp-subtitle">
              Subtitle <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cmp-subtitle"
              placeholder="e.g. OceanSky Premium offer"
              value={values.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
              maxLength={120}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cmp-desc">Description</Label>
            <Textarea
              id="cmp-desc"
              placeholder="Short marketing copy shown on the campaign banner…"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              className="min-h-24 text-sm"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground">
              {values.description.length}/500
            </p>
          </div>

          {/* CTA label */}
          <div className="space-y-1.5">
            <Label htmlFor="cmp-cta-label">CTA label</Label>
            <Input
              id="cmp-cta-label"
              placeholder="e.g. Upgrade to Premium"
              value={values.ctaLabel}
              onChange={(e) => set("ctaLabel", e.target.value)}
            />
          </div>

          {/* CTA url */}
          <div className="space-y-1.5">
            <Label htmlFor="cmp-cta-url">CTA url</Label>
            <Input
              id="cmp-cta-url"
              placeholder="#/profile/tier"
              value={values.ctaUrl}
              onChange={(e) => set("ctaUrl", e.target.value)}
            />
          </div>

          {/* Audience */}
          <div className="space-y-1.5">
            <Label>Audience</Label>
            <Select
              value={values.audience}
              onValueChange={(v) => set("audience", v as Campaign["audience"])}
            >
              <SelectTrigger className="w-full">
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

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={values.status}
              onValueChange={(v) => set("status", v as CampaignStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Accent color */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Accent color</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => set("accentColor", a.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                    values.accentColor === a.value
                      ? "border-teal/50 bg-teal/[0.06] ring-1 ring-teal/30"
                      : "border-border/60 bg-background hover:bg-muted/40"
                  )}
                >
                  <span className={cn("size-3 rounded-full", a.bar)} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <DatePickerField
            label="Start date"
            value={values.startsAt}
            onChange={(d) => d && set("startsAt", d)}
          />
          <DatePickerField
            label="End date"
            value={values.endsAt}
            onChange={(d) => d && set("endsAt", d)}
          />
          {values.endsAt < values.startsAt && (
            <p className="text-xs text-destructive sm:col-span-2">
              End date must be on or after the start date.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formValid || saving}
            className="bg-teal text-white hover:bg-teal/90"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {mode === "create" ? "Create campaign" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Campaign card
// ---------------------------------------------------------------------------

interface CampaignCardProps {
  campaign: Campaign;
  onEdit: () => void;
  onDuplicate: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
}

function CampaignCard({
  campaign,
  onEdit,
  onDuplicate,
  onTogglePause,
  onDelete,
}: CampaignCardProps) {
  const metrics = campaign.metrics || { impressions: 0, clicks: 0, conversions: 0 };
  const ctrPct = ctr(metrics.impressions, metrics.clicks);
  const isPausable = campaign.status === "active" || campaign.status === "paused";

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md">
      {/* Accent bar */}
      <div className={cn("h-1.5 w-full", accentBar(campaign.accentColor))} />
      <div className="space-y-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[10px] capitalize", STATUS_BADGE[campaign.status])}>
                {campaign.status}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-[10px] capitalize", AUDIENCE_BADGE[campaign.audience])}
              >
                {campaign.audience}
              </Badge>
            </div>
            <h3 className="truncate text-base font-semibold leading-tight">
              {campaign.title}
            </h3>
            <p className={cn("text-xs font-medium", ACCENT_TEXT[campaign.accentColor] || "text-teal")}>
              {campaign.subtitle}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-3">
          {campaign.description}
        </p>

        {/* Date range */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          <span>
            {formatDate(campaign.startsAt, "d MMM yyyy")} — {formatDate(campaign.endsAt, "d MMM yyyy")}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Eye className="size-3" /> Impr.
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {formatCompact(metrics.impressions)}
            </p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <MousePointerClick className="size-3" /> Clicks
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {formatCompact(metrics.clicks)}
            </p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Target className="size-3" /> Conv.
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {formatCompact(metrics.conversions)}
            </p>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="size-3" /> CTR
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {ctrPct.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={onDuplicate}>
            <Copy className="size-3.5" /> Duplicate
          </Button>
          {isPausable && (
            <Button size="sm" variant="outline" onClick={onTogglePause}>
              {campaign.status === "active" ? (
                <>
                  <PauseCircle className="size-3.5" /> Pause
                </>
              ) : (
                <>
                  <PlayCircle className="size-3.5" /> Resume
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Campaign | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.listCampaigns();
      if (!active) return;
      if (res.ok && res.data) setCampaigns(res.data);
      if (!res.ok) toast.error(res.error || "Failed to load campaigns.");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return campaigns;
    return campaigns.filter((c) => c.status === filter);
  }, [campaigns, filter]);

  const stats = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((c) => c.status === "active").length;
    const scheduled = campaigns.filter((c) => c.status === "scheduled").length;
    const ended = campaigns.filter((c) => c.status === "ended").length;
    const impressions = campaigns.reduce(
      (sum, c) => sum + (c.metrics?.impressions || 0),
      0
    );
    const clicks = campaigns.reduce(
      (sum, c) => sum + (c.metrics?.clicks || 0),
      0
    );
    const conversions = campaigns.reduce(
      (sum, c) => sum + (c.metrics?.conversions || 0),
      0
    );
    return { total, active, scheduled, ended, impressions, clicks, conversions };
  }, [campaigns]);

  const overallCtr = ctr(stats.impressions, stats.clicks);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(c: Campaign) {
    setFormMode("edit");
    setEditing(c);
    setFormOpen(true);
  }

  async function handleFormSubmit(values: CampaignFormValues) {
    const payload = {
      title: values.title.trim(),
      subtitle: values.subtitle.trim(),
      description: values.description.trim(),
      ctaLabel: values.ctaLabel.trim() || "Learn more",
      ctaUrl: values.ctaUrl.trim(),
      status: values.status,
      audience: values.audience,
      accentColor: values.accentColor,
      startsAt: values.startsAt.toISOString(),
      endsAt: values.endsAt.toISOString(),
    };

    if (formMode === "create") {
      const res = await services.admin.createCampaign(payload);
      if (res.ok && res.data) {
        setCampaigns((prev) => [res.data!, ...prev]);
        toast.success("Campaign created.", {
          description: res.data.title,
        });
        setFormOpen(false);
      } else {
        toast.error(res.error || "Failed to create campaign.");
      }
    } else if (formMode === "edit" && editing) {
      const res = await services.admin.updateCampaign(editing.id, payload);
      if (res.ok && res.data) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === res.data!.id ? res.data! : c))
        );
        toast.success("Campaign updated.", { description: res.data.title });
        setFormOpen(false);
      } else {
        toast.error(res.error || "Failed to update campaign.");
      }
    }
  }

  async function handleDuplicate(c: Campaign) {
    const res = await services.admin.createCampaign({
      title: `${c.title} (copy)`,
      subtitle: c.subtitle,
      description: c.description,
      ctaLabel: c.ctaLabel,
      ctaUrl: c.ctaUrl,
      status: "draft",
      audience: c.audience,
      accentColor: c.accentColor,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    });
    if (res.ok && res.data) {
      setCampaigns((prev) => [res.data!, ...prev]);
      toast.success("Campaign duplicated.", {
        description: `${res.data.title} — saved as draft.`,
      });
    } else {
      toast.error(res.error || "Failed to duplicate campaign.");
    }
  }

  async function handleTogglePause(c: Campaign) {
    const next: CampaignStatus = c.status === "active" ? "paused" : "active";
    const res = await services.admin.updateCampaign(c.id, { status: next });
    if (res.ok && res.data) {
      setCampaigns((prev) => prev.map((x) => (x.id === res.data!.id ? res.data! : x)));
      toast.success(
        next === "paused" ? "Campaign paused." : "Campaign resumed.",
        { description: c.title }
      );
    } else {
      toast.error(res.error || "Failed to update campaign status.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await services.admin.deleteCampaign(deleteTarget.id);
    if (res.ok) {
      setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Campaign deleted.", { description: deleteTarget.title });
      setDeleteTarget(null);
    } else {
      toast.error(res.error || "Failed to delete campaign.");
    }
    setDeleting(false);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Campaigns & Advertising"
        description="Create, schedule and manage promotional campaigns."
        actions={
          <Button onClick={openCreate} className="bg-teal text-white hover:bg-teal/90">
            <Plus className="size-4" /> New campaign
          </Button>
        }
      />

      {/* Status stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Campaigns" value={stats.total} icon={Megaphone} accent="teal" />
        <StatCard
          label="Active"
          value={stats.active}
          icon={PlayCircle}
          accent="turquoise"
          footer="Currently live"
        />
        <StatCard
          label="Scheduled"
          value={stats.scheduled}
          icon={CalendarClock}
          accent="ocean"
          footer="Upcoming launches"
        />
        <StatCard
          label="Ended"
          value={stats.ended}
          icon={CheckCircle2}
          accent="muted"
          footer="Concluded"
        />
      </div>

      {/* Aggregate performance */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Impressions"
          value={formatCompact(stats.impressions)}
          icon={Eye}
          accent="teal"
        />
        <StatCard
          label="Clicks"
          value={formatCompact(stats.clicks)}
          icon={MousePointerClick}
          accent="turquoise"
        />
        <StatCard
          label="Conversions"
          value={formatCompact(stats.conversions)}
          icon={Target}
          accent="ocean"
        />
        <StatCard
          label="Overall CTR"
          value={`${overallCtr.toFixed(2)}%`}
          icon={TrendingUp}
          accent="muted"
          footer="Clicks ÷ impressions"
        />
      </div>

      {/* Filter tabs */}
      <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="flex-wrap">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Campaign list */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <SectionCard icon={Sparkles} bodyClassName="p-6">
          <EmptyState
            title="No campaigns yet"
            description={
              filter === "all"
                ? "Create your first promotional campaign to engage customers."
                : "No campaigns match this filter."
            }
            icon={Megaphone}
            action={
              filter === "all" ? (
                <Button
                  onClick={openCreate}
                  className="bg-teal text-white hover:bg-teal/90"
                >
                  <Plus className="size-4" /> New campaign
                </Button>
              ) : undefined
            }
          />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onEdit={() => openEdit(c)}
              onDuplicate={() => handleDuplicate(c)}
              onTogglePause={() => handleTogglePause(c)}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <CampaignFormDialog
        open={formOpen}
        mode={formMode}
        initial={editing ? campaignToForm(editing) : EMPTY_FORM}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete this campaign?"
        description="The campaign will be permanently removed. This action cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete campaign"}
        variant="danger"
      >
        {deleteTarget && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Campaign</span>
              <span className="font-semibold">{deleteTarget.title}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="capitalize">{deleteTarget.status}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
