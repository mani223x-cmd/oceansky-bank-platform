"use client";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Landmark,
  ArrowLeftRight,
  CreditCard,
  Banknote,
  ShieldAlert,
  Headset,
  Bell,
  Megaphone,
  UserCog,
  ScrollText,
  Settings,
  LogOut,
  CornerUpLeft,
  type LucideIcon,
} from "lucide-react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { Logo } from "@/components/shared/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { initials, timeAgo } from "@/lib/format";
import type { AdminRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
      { label: "Analytics", icon: TrendingUp, path: "/admin/analytics" },
    ],
  },
  {
    title: "Banking",
    items: [
      { label: "Customers", icon: Users, path: "/admin/customers" },
      { label: "Accounts", icon: Landmark, path: "/admin/accounts" },
      { label: "Transactions", icon: ArrowLeftRight, path: "/admin/transactions" },
      { label: "Cards", icon: CreditCard, path: "/admin/cards" },
      { label: "Credit Account", icon: Banknote, path: "/admin/credit-account" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Risk Review", icon: ShieldAlert, path: "/admin/risk" },
      { label: "Support Inbox", icon: Headset, path: "/admin/support" },
      { label: "Notifications", icon: Bell, path: "/admin/notifications" },
      { label: "Campaigns", icon: Megaphone, path: "/admin/campaigns" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Staff & Roles", icon: UserCog, path: "/admin/staff" },
      { label: "Audit Logs", icon: ScrollText, path: "/admin/audit" },
      { label: "Settings", icon: Settings, path: "/admin/settings" },
    ],
  },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  operations_manager: "Ops Manager",
  risk_analyst: "Risk Analyst",
  support_agent: "Support Agent",
  compliance_officer: "Compliance",
  read_only: "Read Only",
};

export function AdminSidebar({ mobile = false }: { mobile?: boolean }) {
  const view = useRouterStore((s) => s.view);
  const go = useRouterStore((s) => s.go);
  const admin = useAuthStore((s) => s.admin);
  const token = useAuthStore((s) => s.token);
  const reset = useAuthStore((s) => s.reset);

  const hasCustomerSession = Boolean(token);
  const adminInitials = admin ? initials(admin.firstName, admin.lastName) : "ST";
  const roleLabel = admin ? ROLE_LABELS[admin.role] : "Staff";

  function handleSignOut() {
    reset();
    go("/admin/login");
  }

  function exitToCustomer() {
    go(hasCustomerSession ? "/dashboard" : "/login");
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground",
        mobile ? "w-full" : "w-72"
      )}
    >
      {/* Brand */}
      <div className="flex flex-col gap-2 px-5 pt-5 pb-4">
        <Logo variant="light" size="md" />
        <Badge
          variant="outline"
          className="w-fit border-teal/40 bg-teal/10 text-teal-light uppercase tracking-wider text-[10px] py-0.5"
        >
          Admin Portal
        </Badge>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const itemView = item.path.replace(/^\/admin\//, "");
                  const active = view === itemView;
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <button
                        type="button"
                        onClick={() => go(item.path)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            active
                              ? "text-teal-light"
                              : "text-sidebar-foreground/60 group-hover:text-teal-light"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-light" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Footer — admin user card */}
      <div className="px-3 py-4 space-y-3">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/40 px-3 py-2.5">
          <Avatar className="size-9 ring-1 ring-teal/30">
            <AvatarFallback className="bg-teal/20 text-teal-light text-xs font-semibold">
              {adminInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {admin ? `${admin.firstName} ${admin.lastName}` : "Unknown"}
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">
              {roleLabel}
              {admin?.lastActiveAt ? ` · ${timeAgo(admin.lastActiveAt)}` : ""}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={exitToCustomer}
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <CornerUpLeft className="size-4 mr-2" />
          {hasCustomerSession ? "Exit to customer portal" : "Exit to customer sign in"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-destructive/20 hover:text-red-200"
        >
          <LogOut className="size-4 mr-2" />
          Sign out
        </Button>
      </div>
    </div>
  );
}


