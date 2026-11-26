"use client";
import { Menu, Bell, ChevronDown, LogOut, CornerUpLeft, Shield } from "lucide-react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials, timeAgo } from "@/lib/format";
import type { AdminRole } from "@/lib/types";

const VIEW_TITLES: Record<string, string> = {
  dashboard: "Operations Dashboard",
  analytics: "Analytics & Insights",
  customers: "Customer Management",
  accounts: "Accounts Overview",
  transactions: "Transactions Monitor",
  cards: "Card Management",
  risk: "Risk & Fraud Review",
  support: "Support Inbox",
  notifications: "Notifications Centre",
  campaigns: "Campaigns & Offers",
  staff: "Staff & Roles",
  audit: "Audit Logs",
  settings: "Bank Settings",
};

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  operations_manager: "Operations Manager",
  risk_analyst: "Risk Analyst",
  support_agent: "Support Agent",
  compliance_officer: "Compliance Officer",
  read_only: "Read Only",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  engineering: "Engineering",
  operations: "Operations",
  risk: "Risk & Compliance",
  support: "Customer Support",
  compliance: "Compliance",
  executive: "Executive",
};

export function AdminTopbar() {
  const view = useRouterStore((s) => s.view);
  const go = useRouterStore((s) => s.go);
  const admin = useAuthStore((s) => s.admin);
  const token = useAuthStore((s) => s.token);
  const reset = useAuthStore((s) => s.reset);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const hasCustomerSession = Boolean(token);
  const pageTitle = VIEW_TITLES[view] || "Operations Portal";
  const adminInitials = admin ? initials(admin.firstName, admin.lastName) : "ST";

  function handleSignOut() {
    reset();
    go("/admin/login");
  }

  function switchToCustomer() {
    go(hasCustomerSession ? "/dashboard" : "/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Mobile hamburger */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden -ml-2"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu className="size-5" />
      </Button>

      {/* Page title */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
          {pageTitle}
        </h1>
        <p className="hidden text-xs text-muted-foreground sm:block">
          OceanSky Operations Portal
        </p>
      </div>

      {/* Live indicator */}
      <div className="hidden items-center gap-2 rounded-full border bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 md:flex dark:bg-emerald-950/40 dark:text-emerald-300">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        System operational
      </div>

      {/* Notification bell */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label="Notifications"
        onClick={() => go("/admin/notifications")}
      >
        <Bell className="size-5" />
        <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-teal px-1 text-[10px] font-semibold text-white">
          3
        </span>
      </Button>

      {/* Admin avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-2 px-1.5 sm:px-2 h-10"
            aria-label="Admin account menu"
          >
            <Avatar className="size-8 ring-1 ring-teal/30">
              <AvatarFallback className="bg-teal/15 text-teal text-xs font-semibold">
                {adminInitials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-none">
                {admin ? `${admin.firstName} ${admin.lastName}` : "Unknown"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {admin ? ROLE_LABELS[admin.role] : ""}
              </p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="text-sm font-semibold">
              {admin ? `${admin.firstName} ${admin.lastName}` : "Unknown"}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {admin ? admin.email : ""}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Role</span>
              <Badge
                variant="secondary"
                className="bg-teal/10 text-teal capitalize text-[10px]"
              >
                {admin ? ROLE_LABELS[admin.role] : "—"}
              </Badge>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Department</span>
              <span className="font-medium">
                {admin ? DEPARTMENT_LABELS[admin.department] || admin.department : "—"}
              </span>
            </div>
            {admin?.lastActiveAt && (
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Last active</span>
                <span className="font-medium">{timeAgo(admin.lastActiveAt)}</span>
              </div>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              switchToCustomer();
            }}
            className="cursor-pointer"
          >
            <CornerUpLeft className="size-4 mr-2" />
            {hasCustomerSession ? "Switch to customer portal" : "Exit to customer sign in"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              go("/admin/audit");
            }}
            className="cursor-pointer"
          >
            <Shield className="size-4 mr-2" />
            View audit trail
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleSignOut();
            }}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="size-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
