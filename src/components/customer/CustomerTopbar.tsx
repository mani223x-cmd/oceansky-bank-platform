"use client";

import { useState } from "react";
import {
  Menu,
  Search,
  ArrowRight,
  Bell,
  Headset,
  User,
  Shield,
  Settings,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Wallet,
  CreditCard,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import { useNotificationStore } from "@/lib/store/notification.store";
import { initials } from "@/lib/format";
import type { UserTier } from "@/lib/types";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ----------------------------------------------------------------------------
// Tier badge for the light topbar dropdown
// ----------------------------------------------------------------------------
function tierBadgeClass(tier: UserTier): string {
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
// Quick-link entries shown when the search field is focused
// ----------------------------------------------------------------------------
interface QuickLink {
  label: string;
  route: string;
  icon: LucideIcon;
  hint: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: "Dashboard", route: "/dashboard", icon: LayoutDashboard, hint: "Overview" },
  { label: "Accounts", route: "/accounts", icon: Wallet, hint: "Balances" },
  { label: "Cards", route: "/cards", icon: CreditCard, hint: "Manage cards" },
  { label: "Beneficiaries", route: "/beneficiaries", icon: Users, hint: "Saved payees" },
  { label: "Support", route: "/support", icon: Headset, hint: "Get help" },
];

// ----------------------------------------------------------------------------
// Topbar
// ----------------------------------------------------------------------------
export function CustomerTopbar() {
  const go = useRouterStore((s) => s.go);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);

  // unreadCount is a derived selector — subscribe to its computed value
  const unread = useNotificationStore((s) => s.unreadCount());

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const tier = user?.tier ?? "standard";

  function handleQuickLink(route: string) {
    setSearchOpen(false);
    setQuery("");
    go(route);
  }

  function handleSignOut() {
    reset();
    go("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* Mobile: hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
          onClick={() => toggleSidebar()}
        >
          <Menu className="size-5" />
        </Button>

        {/* Search — hidden on very small screens */}
        <div className="hidden sm:block sm:w-56 md:w-72 lg:w-96">
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search transactions, payees…"
                  className="h-9 pl-9 pr-3"
                  aria-label="Search"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-72 p-0"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quick links
              </div>
              <div className="max-h-72 overflow-y-auto pb-1">
                {QUICK_LINKS.filter((q) =>
                  query
                    ? q.label.toLowerCase().includes(query.toLowerCase()) ||
                      q.hint.toLowerCase().includes(query.toLowerCase())
                    : true
                ).map((q) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={q.route}
                      type="button"
                      onClick={() => handleQuickLink(q.route)}
                      className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <Icon className="size-4 text-teal" />
                      <span className="flex-1 font-medium">{q.label}</span>
                      <span className="text-xs text-muted-foreground">{q.hint}</span>
                    </button>
                  );
                })}
                {query &&
                  !QUICK_LINKS.some(
                    (q) =>
                      q.label.toLowerCase().includes(query.toLowerCase()) ||
                      q.hint.toLowerCase().includes(query.toLowerCase())
                  ) && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No matches for &ldquo;{query}&rdquo;
                    </div>
                  )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Button
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => go("/transfers")}
          >
            Quick transfer
            <ArrowRight className="size-4" />
          </Button>

          {/* Notifications bell with unread badge */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
            onClick={() => go("/notifications")}
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-teal px-1 text-[10px] font-bold text-white ring-2 ring-background">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>

          {/* Help */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Help & support"
            onClick={() => go("/support")}
          >
            <Headset className="size-5" />
          </Button>

          {/* User avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Open user menu"
              >
                <Avatar className="size-9 ring-1 ring-border">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={`${firstName} ${lastName}`} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-teal to-ocean text-xs font-semibold text-white">
                    {initials(firstName, lastName) || "OS"}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex items-center gap-3 py-2">
                <Avatar className="size-9 ring-1 ring-border">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={`${firstName} ${lastName}`} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-teal to-ocean text-xs font-semibold text-white">
                    {initials(firstName, lastName) || "OS"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {firstName} {lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  <div className="mt-1">
                    <Badge
                      className={cn(
                        "px-1.5 py-0 text-[10px] font-semibold capitalize",
                        tierBadgeClass(tier)
                      )}
                    >
                      {tierLabel(tier)}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => go("/profile")}>
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => go("/profile/security")}>
                <Shield className="size-4" />
                Security
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => go("/profile/preferences")}>
                <Settings className="size-4" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
