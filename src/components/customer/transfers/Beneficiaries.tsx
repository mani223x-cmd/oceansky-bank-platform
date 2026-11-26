"use client";

// ============================================================================
// OceanSky Bank — Beneficiaries (customer)
// ----------------------------------------------------------------------------
// Manage saved recipients: list, search, filter by type, add new, delete.
// Each card has "Send money" (routes to /transfers) and "Delete" actions.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { services } from "@/lib/services";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { maskAccountNumber, timeAgo } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import type { Beneficiary, BeneficiaryType } from "@/lib/types";

import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// ----------------------------------------------------------------------------
// Bank options (internal + common US banks)
// ----------------------------------------------------------------------------
const BANK_OPTIONS = [
  "OceanSky Bank",
  "Chase",
  "Bank of America",
  "Wells Fargo",
  "Citibank",
  "Capital One",
  "U.S. Bank",
  "PNC Bank",
];

// Avatar tint set (teal / turquoise / ocean family + emerald accent — no indigo/blue)
const AVATAR_TINTS: { bg: string; fg: string }[] = [
  { bg: "bg-teal/15", fg: "text-teal" },
  { bg: "bg-turquoise/20", fg: "text-teal-dark" },
  { bg: "bg-ocean/15", fg: "text-ocean" },
  { bg: "bg-emerald-500/15", fg: "text-emerald-600" },
];

function avatarTint(seed: string): { bg: string; fg: string } {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ----------------------------------------------------------------------------
// Add-beneficiary dialog form state
// ----------------------------------------------------------------------------
interface AddForm {
  nickname: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  type: BeneficiaryType;
}

const EMPTY_FORM: AddForm = {
  nickname: "",
  accountName: "",
  accountNumber: "",
  bankName: "OceanSky Bank",
  type: "internal",
};

// ----------------------------------------------------------------------------
// Beneficiaries
// ----------------------------------------------------------------------------
export function Beneficiaries() {
  const user = useAuthStore((s) => s.user);
  const go = useRouterStore((s) => s.go);

  const [loading, setLoading] = useState(true);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "internal" | "external">("all");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Beneficiary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ------------------------------------------------------------------
  // Load beneficiaries
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await services.beneficiary.listByUser(user.id);
        if (cancelled) return;
        if (res.ok && res.data) {
          setBeneficiaries(res.data);
        } else {
          toast({
            title: "Failed to load beneficiaries",
            description: res.error,
            variant: "destructive",
          });
          setBeneficiaries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ------------------------------------------------------------------
  // Derived stats
  // ------------------------------------------------------------------
  const stats = useMemo(() => {
    const internal = beneficiaries.filter((b) => b.type === "internal").length;
    const external = beneficiaries.filter((b) => b.type === "external").length;
    return { total: beneficiaries.length, internal, external };
  }, [beneficiaries]);

  // ------------------------------------------------------------------
  // Filtered list (search + tab)
  // ------------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return beneficiaries.filter((b) => {
      if (tab !== "all" && b.type !== tab) return false;
      if (!q) return true;
      return (
        b.nickname.toLowerCase().includes(q) ||
        b.accountName.toLowerCase().includes(q) ||
        b.accountNumber.toLowerCase().includes(q) ||
        b.bankName.toLowerCase().includes(q)
      );
    });
  }, [beneficiaries, search, tab]);

  // ------------------------------------------------------------------
  // Add beneficiary
  // ------------------------------------------------------------------
  function openAdd() {
    setAddForm(EMPTY_FORM);
    setAddOpen(true);
  }

  async function handleAddSubmit() {
    if (!user) return;
    if (!addForm.nickname.trim()) {
      toast({ title: "Enter a nickname", variant: "destructive" });
      return;
    }
    if (!addForm.accountName.trim()) {
      toast({ title: "Enter the account name", variant: "destructive" });
      return;
    }
    if (!addForm.accountNumber.trim() || addForm.accountNumber.trim().length < 6) {
      toast({ title: "Enter a valid account number", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const isInternalBank = addForm.bankName === "OceanSky Bank";
      const type: BeneficiaryType =
        addForm.type === "internal" && isInternalBank
          ? "internal"
          : addForm.type === "external" && !isInternalBank
            ? "external"
            : isInternalBank
              ? "internal"
              : "external";
      const res = await services.beneficiary.create({
        userId: user.id,
        nickname: addForm.nickname.trim(),
        accountName: addForm.accountName.trim(),
        accountNumber: addForm.accountNumber.trim(),
        bankName: addForm.bankName,
        type,
        currency: "USD",
        avatarColor: "teal",
        lastUsedAt: new Date().toISOString(),
      });
      if (res.ok && res.data) {
        setBeneficiaries((prev) => [res.data!, ...prev]);
        toast({
          title: "Beneficiary added",
          description: `${res.data.nickname} has been saved.`,
        });
        setAddOpen(false);
        setAddForm(EMPTY_FORM);
      } else {
        toast({
          title: "Could not add beneficiary",
          description: res.error,
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ------------------------------------------------------------------
  // Delete beneficiary
  // ------------------------------------------------------------------
  function openDelete(b: Beneficiary) {
    setDeleteTarget(b);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await services.beneficiary.remove(deleteTarget.id);
      if (res.ok) {
        setBeneficiaries((prev) => prev.filter((b) => b.id !== deleteTarget.id));
        toast({
          title: "Beneficiary removed",
          description: `${deleteTarget.nickname} was deleted.`,
        });
        setDeleteTarget(null);
      } else {
        toast({
          title: "Could not delete beneficiary",
          description: res.error,
          variant: "destructive",
        });
      }
    } finally {
      setDeleting(false);
    }
  }

  // ------------------------------------------------------------------
  // Send money — stash the beneficiary in sessionStorage then route
  // ------------------------------------------------------------------
  function sendMoney(b: Beneficiary) {
    try {
      sessionStorage.setItem(
        "oceansky.transfer.prefill",
        JSON.stringify({
          toBankName: b.bankName,
          toAccountNumber: b.accountNumber,
          toAccountName: b.accountName,
        })
      );
    } catch {
      // ignore — sessionStorage may be unavailable
    }
    go("/transfers");
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  if (!user) {
    return (
      <EmptyState
        title="Sign in required"
        description="Please sign in to manage your beneficiaries."
        icon={Users}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beneficiaries"
        description="People and businesses you send money to."
        actions={
          <Button onClick={openAdd} className="bg-teal text-white hover:bg-teal/90">
            <Plus className="size-4" />
            Add beneficiary
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={stats.total} icon={Users} accent="teal" />
        <StatCard label="Internal" value={stats.internal} icon={Building2} accent="turquoise" />
        <StatCard label="External" value={stats.external} icon={Send} accent="ocean" />
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search nickname, name, account…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="internal">Internal</TabsTrigger>
            <TabsTrigger value="external">External</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={search || tab !== "all" ? "No beneficiaries match" : "No beneficiaries yet"}
            description={
              search || tab !== "all"
                ? "Try a different search term or filter."
                : "Add a beneficiary to send money in one tap next time."
            }
            icon={Users}
            action={
              <Button onClick={openAdd} variant="outline" size="sm">
                <Plus className="size-4" />
                Add beneficiary
              </Button>
            }
          />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <BeneficiaryCard
              key={b.id}
              beneficiary={b}
              onSend={() => sendMoney(b)}
              onDelete={() => openDelete(b)}
            />
          ))}
        </div>
      )}

      {/* Add beneficiary dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add a beneficiary</DialogTitle>
            <DialogDescription>
              Save a recipient so you can send money to them in one tap next time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-nick">Nickname</Label>
              <Input
                id="add-nick"
                placeholder="e.g. Mum, Landlord"
                value={addForm.nickname}
                onChange={(e) => setAddForm((f) => ({ ...f, nickname: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add-acct">Account number</Label>
                <Input
                  id="add-acct"
                  inputMode="numeric"
                  placeholder="0123456789"
                  value={addForm.accountNumber}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      accountNumber: e.target.value.replace(/[^\d]/g, ""),
                    }))
                  }
                  maxLength={10}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-name">Account name</Label>
                <Input
                  id="add-name"
                  placeholder="Recipient full name"
                  value={addForm.accountName}
                  onChange={(e) => setAddForm((f) => ({ ...f, accountName: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-bank">Bank</Label>
              <Select
                value={addForm.bankName}
                onValueChange={(v) => setAddForm((f) => ({ ...f, bankName: v }))}
              >
                <SelectTrigger id="add-bank" className="w-full">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {BANK_OPTIONS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                      {bank === "OceanSky Bank" && (
                        <span className="ml-2 text-xs text-muted-foreground">(internal)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <RadioGroup
                className="grid grid-cols-2 gap-2"
                value={addForm.type}
                onValueChange={(v) => setAddForm((f) => ({ ...f, type: v as BeneficiaryType }))}
              >
                <label
                  htmlFor="type-internal"
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    addForm.type === "internal"
                      ? "border-teal bg-teal/5 text-teal"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <RadioGroupItem id="type-internal" value="internal" />
                  <span>Internal (OceanSky)</span>
                </label>
                <label
                  htmlFor="type-external"
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    addForm.type === "external"
                      ? "border-teal bg-teal/5 text-teal"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <RadioGroupItem id="type-external" value="external" />
                  <span>External (other bank)</span>
                </label>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Internal transfers to OceanSky accounts are instant and free.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={submitting}
              className="bg-teal text-white hover:bg-teal/90"
            >
              {submitting ? "Saving…" : "Save beneficiary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete beneficiary?"
        description="This action cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        variant="danger"
      >
        {deleteTarget && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <p className="font-medium">{deleteTarget.nickname}</p>
            <p className="text-xs text-muted-foreground">
              {deleteTarget.accountName} · {maskAccountNumber(deleteTarget.accountNumber)} ·{" "}
              {deleteTarget.bankName}
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// BeneficiaryCard — single beneficiary tile
// ----------------------------------------------------------------------------
function BeneficiaryCard({
  beneficiary: b,
  onSend,
  onDelete,
}: {
  beneficiary: Beneficiary;
  onSend: () => void;
  onDelete: () => void;
}) {
  const tint = avatarTint(b.nickname + b.id);
  const lastUsed = b.lastUsedAt ? timeAgo(b.lastUsedAt) : "Never used";

  return (
    <div className="group relative flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Top row: avatar + identity */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold",
            tint.bg,
            tint.fg
          )}
        >
          {initialsOf(b.nickname || b.accountName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{b.nickname}</p>
          <p className="truncate text-xs text-muted-foreground">{b.accountName}</p>
        </div>
      </div>

      {/* Account details */}
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Account</span>
          <span className="font-mono tabular-nums">{maskAccountNumber(b.accountNumber)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Bank</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              b.type === "internal"
                ? "bg-teal/10 text-teal border-teal/25"
                : "bg-ocean/10 text-ocean border-ocean/25"
            )}
          >
            {b.bankName}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Last used</span>
          <span className="text-xs text-muted-foreground">{lastUsed}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="default"
          className="flex-1 bg-teal text-white hover:bg-teal/90"
          onClick={onSend}
        >
          <Send className="size-3.5" />
          Send money
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-9 text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete ${b.nickname}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
