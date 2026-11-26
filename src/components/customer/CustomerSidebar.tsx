"use client";

import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  CreditCard,
  Receipt,
  Zap,
  Users,
  FileText,
  Bell,
  Headset,
  Gift,
  User,
  Shield,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import { initials } from "@/lib/format";
import type { UserTier } from "@/lib/types";

import { Logo } from "@/components/shared/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// ----------------------------------------------------------------------------
// Nav config — three sections: MAIN, MORE, ACCOUNT
// ----------------------------------------------------------------------------
interface NavItem {
  label: string;
  route: string;
  icon: LucideIcon;
}

const MAIN_ITEMS: NavItem[] = [
  { label: "Dashboard", route: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", route: "/accounts", icon: Wallet },
  { label: "Transactions", route: "/transactions", icon: ArrowLeftRight },
  { label: "Transfers", route: "/transfers", icon: ArrowLeftRight },
  { label: "Cards", route: "/cards", icon: CreditCard },
  { label: "Bills & Payments", route: "/bills", icon: Receipt },
];

const MORE_ITEMS: NavItem[] = [
  { label: "Beneficiaries", route: "/beneficiaries", icon: Users },
  { label: "Statements", route: "/statements", icon: FileText },
  { label: "Notifications", route: "/notifications", icon: Bell },
  { label: "Support", route: "/support", icon: Headset },
  { label: "Offers", route: "/campaigns", icon: Gift },
];

const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Profile", route: "/profile", icon: User },
  { label: "Security", route: "/profile/security", icon: Shield },
  { label: "Settings", route: "/profile/preferences", icon: Settings },
];

const ALL_ITEMS: NavItem[] = [...MAIN_ITEMS, ...MORE_ITEMS, ...ACCOUNT_ITEMS];

// ----------------------------------------------------------------------------
// Tier badge — soft tinted pill. `dark` variant tunes contrast for sidebar use.
// ----------------------------------------------------------------------------
function tierBadgeClass(tier: UserTier, dark: boolean): string {
  if (dark) {
    switch (tier) {
      case "premium":
        return "bg-teal/20 text-teal-light border-teal/30";
      case "private":
        return "bg-amber-400/20 text-amber-200 border-amber-400/30";
      default:
        return "bg-white/10 text-white/80 border-white/15";
    }
  }
  switch (tier) {
    case "premium":
      return "bg-teal/10 text-teal border-teal/30";
    case "private":
      return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

function tierLabel(tier: UserTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

// ----------------------------------------------------------------------------
// Sidebar inner content — shared by desktop aside and mobile sheet body.
// ----------------------------------------------------------------------------
function SidebarInner({ mobile }: { mobile: boolean }) {
  const path = useRouterStore((s) => s.path);
  const go = useRouterStore((s) => s.go);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);

  // Strip a leading "/" so "/dashboard" matches the parsed hash "dashboard".
  const normalized = path.replace(/^\//, "").trim();

  // Active if exact match OR (sub-route of `route` AND no other nav item is a
  // more specific match — prevents Profile & Security highlighting together).
  function isActive(route: string): boolean {
    const r = route.replace(/^\//, "");
    if (normalized === r) return true;
    if (r && normalized.startsWith(r + "/")) {
      const hasMoreSpecificChild = ALL_ITEMS.some(
        (n) => n.route !== route && n.route.replace(/^\//, "").startsWith(r + "/")
      );
      return !hasMoreSpecificChild;
    }
    return false;
  }

  function handleNavigate(route: string) {
    go(route);
    if (mobile) setSidebarOpen(false);
  }

  function handleSignOut() {
    reset();
    if (mobile) setSidebarOpen(false);
    go("/login");
  }

  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const tier = user?.tier ?? "standard";

  function renderSection(title: string, items: NavItem[]) {
    return (
      <div className="space-y-1">
        <p className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
          {title}
        </p>
        {items.map((item) => {
          const active = isActive(item.route);
          const Icon = item.icon;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => handleNavigate(item.route)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground"
                )}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {/* Top: logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <Logo variant="light" size="md" />
      </div>
      <Separator className="bg-sidebar-border" />

      {/* Middle: scrollable nav */}
      <ScrollArea className="flex-1">
        <nav className="px-3 py-3 space-y-4">
          {renderSection("Main", MAIN_ITEMS)}
          {renderSection("More", MORE_ITEMS)}
          {renderSection("Account", ACCOUNT_ITEMS)}
        </nav>
      </ScrollArea>

      {/* Bottom: user card + sign out */}
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/40 p-3">
          <Avatar className="size-9 ring-1 ring-white/15">
            {user?.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={`${firstName} ${lastName}`} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-teal to-ocean text-white text-xs font-semibold">
              {initials(firstName, lastName) || "OS"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {firstName} {lastName}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge
                className={cn(
                  "px-1.5 py-0 text-[10px] font-semibold capitalize",
                  tierBadgeClass(tier, true)
                )}
              >
                {tierLabel(tier)}
              </Badge>
              <span className="truncate text-[11px] text-sidebar-foreground/55">
                {user?.email}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start gap-2",
            "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          )}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Public component
//   mobile = false (default): sticky desktop aside, hidden below lg
//   mobile = true:  bare content for the caller to drop inside a <Sheet>
// ----------------------------------------------------------------------------
export function CustomerSidebar({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <SidebarInner mobile />
      </div>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <SidebarInner mobile={false} />
    </aside>
  );
}
