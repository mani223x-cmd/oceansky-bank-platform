"use client";
import { useEffect, useMemo, useState } from "react";
import {
  UserCog,
  Users,
  Activity,
  Building2,
  ShieldCheck,
  KeyRound,
  Eye,
  Power,
  Snowflake,
  MoreHorizontal,
  CheckCircle2,
  Lock,
  Send,
  CircleSlash,
} from "lucide-react";
import { services } from "@/lib/services";
import { MOCK_AUDIT_LOGS } from "@/lib/mock";
import type { AdminUser, AdminRole, AuditLogEntry } from "@/lib/types";
import { useAuthStore } from "@/lib/store/auth.store";
import { timeAgo, initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import {
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Department = AdminUser["department"];

const DEPARTMENT_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "engineering", label: "Engineering" },
  { value: "operations", label: "Operations" },
  { value: "risk", label: "Risk" },
  { value: "support", label: "Support" },
  { value: "compliance", label: "Compliance" },
  { value: "executive", label: "Executive" },
];

const ROLE_BADGE: Record<AdminRole, string> = {
  super_admin: "bg-teal/15 text-teal",
  operations_manager: "bg-ocean/15 text-ocean",
  risk_analyst: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  support_agent: "bg-muted text-muted-foreground",
  compliance_officer: "bg-turquoise/20 text-[oklch(0.45_0.13_180)]",
  read_only: "bg-muted text-muted-foreground",
};

const DEPARTMENT_BADGE: Record<Department, string> = {
  engineering: "bg-teal/15 text-teal",
  operations: "bg-ocean/15 text-ocean",
  risk: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  support: "bg-muted text-muted-foreground",
  compliance: "bg-turquoise/20 text-[oklch(0.45_0.13_180)]",
  executive: "bg-zinc-700/15 text-zinc-700 dark:text-zinc-300",
};

const ROLE_REFERENCE: {
  role: AdminRole;
  label: string;
  description: string;
  permissions: string[];
}[] = [
  {
    role: "super_admin",
    label: "Super Admin",
    description: "Full unrestricted access to every module and setting.",
    permissions: ["*"],
  },
  {
    role: "operations_manager",
    label: "Operations Manager",
    description: "Day-to-day operations across customers, accounts and transactions.",
    permissions: ["customers.*", "accounts.*", "transactions.*", "settings.read"],
  },
  {
    role: "risk_analyst",
    label: "Risk Analyst",
    description: "Investigates flagged transactions and risk cases.",
    permissions: ["risk.*", "transactions.read", "customers.read"],
  },
  {
    role: "support_agent",
    label: "Support Agent",
    description: "Handles customer support tickets and read-only customer lookup.",
    permissions: ["support.*", "customers.read"],
  },
  {
    role: "compliance_officer",
    label: "Compliance Officer",
    description: "Reviews audit logs and ensures regulatory compliance.",
    permissions: ["audit.*", "customers.read", "transactions.read"],
  },
  {
    role: "read_only",
    label: "Read Only",
    description: "View-only access across operational modules. No write actions.",
    permissions: ["customers.read", "accounts.read", "transactions.read", "settings.read"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isWithinLastHour(iso?: string): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 3_600_000;
}

interface PermGroup {
  namespace: string;
  actions: string[];
}

function groupPermissions(perms: string[]): PermGroup[] {
  const groups: Record<string, string[]> = {};
  const order: string[] = [];
  for (const p of perms) {
    if (p === "*") {
      if (!groups["all"]) {
        groups["all"] = [];
        order.push("all");
      }
      groups["all"].push("*");
      continue;
    }
    const [ns, action] = p.split(".");
    if (!ns) continue;
    if (!groups[ns]) {
      groups[ns] = [];
      order.push(ns);
    }
    if (action) groups[ns].push(action);
  }
  return order.map((namespace) => ({ namespace, actions: groups[namespace] }));
}

function permCount(perms: string[]): number {
  if (perms.includes("*")) return -1; // wildcard = all
  return perms.length;
}

// ---------------------------------------------------------------------------
// Invite dialog
// ---------------------------------------------------------------------------

interface InviteValues {
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRole;
  department: Department;
}

function InviteDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState<InviteValues>({
    firstName: "",
    lastName: "",
    email: "",
    role: "support_agent",
    department: "support",
  });

  function set<K extends keyof InviteValues>(key: K, v: InviteValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  const valid =
    values.firstName.trim() !== "" &&
    values.lastName.trim() !== "" &&
    /\S+@\S+\.\S+/.test(values.email);

  function submit() {
    if (!valid) {
      toast.error("Please complete all fields with a valid email.");
      return;
    }
    toast.success("Invitation sent.", {
      description: `${values.firstName} ${values.lastName} · ${values.role.replace("_", " ")}`,
    });
    setValues({
      firstName: "",
      lastName: "",
      email: "",
      role: "support_agent",
      department: "support",
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite staff member</DialogTitle>
          <DialogDescription>
            Send an invitation to a new administrative user.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-first">First name</Label>
            <Input
              id="inv-first"
              placeholder="Jane"
              value={values.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-last">Last name</Label>
            <Input
              id="inv-last"
              placeholder="Doe"
              value={values.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              placeholder="jane.doe@oceansky.admin"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={values.role}
              onValueChange={(v) => set("role", v as AdminRole)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_REFERENCE.map((r) => (
                  <SelectItem key={r.role} value={r.role}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={values.department}
              onValueChange={(v) => set("department", v as Department)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENT_TABS.filter((t) => t.value !== "all").map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!valid}
            className="bg-teal text-white hover:bg-teal/90"
          >
            <Send className="size-4" /> Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Staff detail sheet
// ---------------------------------------------------------------------------

interface StaffSheetProps {
  staff: AdminUser | null;
  onClose: () => void;
  onSuspend: (s: AdminUser) => void;
  onActivate: (s: AdminUser) => void;
  onResetPassword: (s: AdminUser) => void;
}

function StaffSheet({
  staff,
  onClose,
  onSuspend,
  onActivate,
  onResetPassword,
}: StaffSheetProps) {
  const recentActivity = useMemo<AuditLogEntry[]>(() => {
    if (!staff) return [];
    return MOCK_AUDIT_LOGS.filter((l) => l.actorId === staff.id).slice(0, 5);
  }, [staff]);

  const permGroups = useMemo(
    () => (staff ? groupPermissions(staff.permissions) : []),
    [staff]
  );

  return (
    <Sheet open={staff !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto scrollbar-thin"
      >
        {staff && (
          <>
            <SheetHeader>
              <SheetDescription>Staff profile</SheetDescription>
              <SheetTitle className="sr-only">{staff.firstName} {staff.lastName}</SheetTitle>
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarFallback className="bg-teal/15 text-teal font-semibold">
                    {initials(staff.firstName, staff.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight truncate">
                    {staff.firstName} {staff.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{staff.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge className={cn("text-[10px] capitalize", ROLE_BADGE[staff.role])}>
                      {staff.role.replace("_", " ")}
                    </Badge>
                    <Badge className={cn("text-[10px] capitalize", DEPARTMENT_BADGE[staff.department])}>
                      {staff.department}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-6">
              {/* Profile summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={staff.status} />
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Last active
                  </p>
                  <p className="mt-1 text-xs font-medium">
                    {staff.lastActiveAt ? timeAgo(staff.lastActiveAt) : "Never"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Department
                  </p>
                  <p className="mt-1 text-xs font-medium capitalize">{staff.department}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Permissions
                  </p>
                  <p className="mt-1 text-xs font-medium">
                    {permCount(staff.permissions) === -1
                      ? "All (wildcard)"
                      : `${permCount(staff.permissions)} scoped`}
                  </p>
                </div>
              </div>

              {/* Permissions tree */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Permissions
                </p>
                <Separator className="my-2" />
                <div className="space-y-2.5">
                  {permGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No permissions assigned.</p>
                  ) : (
                    permGroups.map((g) => (
                      <div key={g.namespace} className="rounded-lg border border-border/60 p-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-3.5 text-teal" />
                          <span className="text-sm font-medium capitalize">
                            {g.namespace === "all" ? "All resources" : g.namespace}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {g.actions.map((a) => (
                            <span
                              key={a}
                              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium font-mono"
                            >
                              <CheckCircle2 className="size-2.5 text-emerald-600" />
                              {a === "*" ? "all actions" : a}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent activity
                </p>
                <Separator className="my-2" />
                {recentActivity.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No recent actions logged.</p>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-border/60 p-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium leading-snug">{entry.action}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {timeAgo(entry.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {entry.resource.replace("_", " ")}
                          </Badge>
                          {entry.resourceId && (
                            <span className="font-mono">{entry.resourceId}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <SheetFooter className="border-t p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {staff.status === "active" ? (
                  <Button
                    variant="outline"
                    onClick={() => onSuspend(staff)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Snowflake className="size-4" /> Suspend
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => onActivate(staff)}
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30"
                  >
                    <Power className="size-4" /> Activate
                  </Button>
                )}
                <Button variant="outline" onClick={() => onResetPassword(staff)}>
                  <KeyRound className="size-4" /> Reset password
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminStaff() {
  const admin = useAuthStore((s) => s.admin);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<string>("all");

  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Suspend confirm
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await services.admin.listStaff();
      if (!active) return;
      if (res.ok && res.data) setRows(res.data);
      if (!res.ok) toast.error(res.error || "Failed to load staff.");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (department === "all") return rows;
    return rows.filter((r) => r.department === department);
  }, [rows, department]);

  const stats = useMemo(() => {
    const total = rows.length;
    const activeNow = rows.filter((r) => isWithinLastHour(r.lastActiveAt)).length;
    const byDept: Record<string, number> = {};
    for (const r of rows) {
      byDept[r.department] = (byDept[r.department] || 0) + 1;
    }
    const deptBreakdown = Object.entries(byDept)
      .sort((a, b) => b[1] - a[1])
      .map(([d, n]) => `${d}: ${n}`)
      .join(" · ");
    return { total, activeNow, deptBreakdown };
  }, [rows]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function toggleStatusLocal(s: AdminUser, status: AdminUser["status"]) {
    setRows((prev) => prev.map((r) => (r.id === s.id ? { ...r, status } : r)));
    if (selected?.id === s.id) {
      setSelected({ ...s, status });
    }
  }

  async function confirmSuspend() {
    if (!suspendTarget) return;
    setActionLoading(true);
    // Mock-only suspend (no backend endpoint); apply locally + toast.
    toggleStatusLocal(suspendTarget, "suspended");
    toast.success("Staff account suspended.", {
      description: `${suspendTarget.firstName} ${suspendTarget.lastName}`,
    });
    setActionLoading(false);
    setSuspendTarget(null);
  }

  function handleActivate(s: AdminUser) {
    toggleStatusLocal(s, "active");
    toast.success("Staff account activated.", {
      description: `${s.firstName} ${s.lastName}`,
    });
  }

  function handleResetPassword(s: AdminUser) {
    toast.success("Password reset link sent.", {
      description: `${s.firstName} ${s.lastName} · ${s.email}`,
    });
  }

  // -------------------------------------------------------------------------
  // Columns
  // -------------------------------------------------------------------------

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Staff",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-teal/15 text-teal text-xs font-semibold">
              {initials(row.firstName, row.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.firstName} {row.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <Badge className={cn("text-[10px] capitalize", ROLE_BADGE[row.role])}>
          {row.role.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "department",
      header: "Department",
      render: (row) => (
        <Badge
          variant="outline"
          className={cn("text-[10px] capitalize", DEPARTMENT_BADGE[row.department])}
        >
          {row.department}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "lastActive",
      header: "Last active",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.lastActiveAt ? timeAgo(row.lastActiveAt) : "Never"}
        </span>
      ),
    },
    {
      key: "perms",
      header: "Permissions",
      render: (row) => (
        <span className="text-xs tabular-nums">
          {permCount(row.permissions) === -1 ? "All" : permCount(row.permissions)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setSelected(row);
            }}
          >
            <Eye className="size-3.5" /> View
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                className="size-8 p-0"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => setSelected(row)}>
                <Eye className="size-3.5" /> View profile
              </DropdownMenuItem>
              {row.status === "active" ? (
                <DropdownMenuItem
                  onClick={() => setSuspendTarget(row)}
                  className="text-destructive focus:text-destructive"
                >
                  <Snowflake className="size-3.5" /> Suspend
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleActivate(row)}>
                  <Power className="size-3.5" /> Activate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleResetPassword(row)}>
                <KeyRound className="size-3.5" /> Reset password
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Staff & Roles"
        description="Manage administrative users and permissions."
        actions={
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-teal text-white hover:bg-teal/90"
          >
            <UserCog className="size-4" /> Invite staff
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Staff" value={stats.total} icon={Users} accent="teal" />
        <StatCard
          label="Active Now"
          value={stats.activeNow}
          icon={Activity}
          accent="turquoise"
          footer="Active in last hour"
        />
        <StatCard
          label="By Department"
          value={
            <span className="text-sm font-semibold">{stats.deptBreakdown || "—"}</span>
          }
          icon={Building2}
          accent="ocean"
          footer="Headcount distribution"
        />
      </div>

      {/* Filter tabs */}
      <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
        <Tabs value={department} onValueChange={setDepartment}>
          <TabsList className="flex-wrap">
            {DEPARTMENT_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Staff table */}
      <SectionCard
        title="Staff directory"
        description={`${filtered.length} member${filtered.length === 1 ? "" : "s"}`}
        icon={Users}
        bodyClassName="p-0"
      >
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          onRowClick={(r) => setSelected(r)}
          emptyTitle="No staff found"
          emptyDescription="No administrative users match this department filter."
          emptyIcon={UserCog}
        />
      </SectionCard>

      {/* Roles & permissions reference */}
      <SectionCard
        title="Roles & permissions reference"
        description="Capability matrix for each administrative role"
        icon={ShieldCheck}
        bodyClassName="p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_REFERENCE.map((r) => (
            <div
              key={r.role}
              className="rounded-xl border border-border/60 bg-background p-4"
            >
              <div className="flex items-center justify-between">
                <Badge className={cn("text-[10px] capitalize", ROLE_BADGE[r.role])}>
                  {r.role.replace("_", " ")}
                </Badge>
                {r.permissions.includes("*") && (
                  <Lock className="size-3.5 text-teal" />
                )}
              </div>
              <p className="mt-2 text-sm font-semibold">{r.label}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                {r.description}
              </p>
              <Separator className="my-3" />
              <div className="flex flex-wrap gap-1.5">
                {r.permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Detail sheet */}
      <StaffSheet
        staff={selected}
        onClose={() => setSelected(null)}
        onSuspend={(s) => setSuspendTarget(s)}
        onActivate={handleActivate}
        onResetPassword={handleResetPassword}
      />

      {/* Invite dialog */}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />

      {/* Suspend confirm */}
      <ConfirmDialog
        open={suspendTarget !== null}
        onClose={() => setSuspendTarget(null)}
        onConfirm={confirmSuspend}
        title="Suspend this staff member?"
        description="The user will lose administrative access immediately. They can be reactivated at any time."
        confirmLabel={actionLoading ? "Suspending…" : "Suspend staff"}
        variant="danger"
      >
        {suspendTarget && (
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Staff</span>
              <span className="font-semibold">
                {suspendTarget.firstName} {suspendTarget.lastName}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{suspendTarget.email}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="capitalize">{suspendTarget.role.replace("_", " ")}</span>
            </div>
          </div>
        )}
      </ConfirmDialog>

      {/* Footer note for current admin context */}
      {admin && (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <CircleSlash className="size-3" /> Signed in as{" "}
          <span className="font-medium">
            {admin.firstName} {admin.lastName}
          </span>{" "}
          · {admin.role.replace("_", " ")}
        </p>
      )}
    </div>
  );
}
