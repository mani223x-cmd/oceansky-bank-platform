"use client";

import { useEffect } from "react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import { useNotificationStore } from "@/lib/store/notification.store";
import { services } from "@/lib/services";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import { CustomerTopbar } from "@/components/customer/CustomerTopbar";
import { Dashboard } from "@/components/customer/dashboard/Dashboard";
import { Accounts } from "@/components/customer/accounts/Accounts";
import { AccountDetails } from "@/components/customer/accounts/AccountDetails";
import { Transactions } from "@/components/customer/transactions/Transactions";
import { Statements } from "@/components/customer/statements/Statements";
import { Transfers } from "@/components/customer/transfers/Transfers";
import { Beneficiaries } from "@/components/customer/transfers/Beneficiaries";
import { Cards } from "@/components/customer/cards/Cards";
import { Bills } from "@/components/customer/bills/Bills";
import { Profile } from "@/components/customer/profile/Profile";
import { Security } from "@/components/customer/profile/Security";
import { Preferences } from "@/components/customer/profile/Preferences";
import { Notifications } from "@/components/customer/notifications/Notifications";
import { Support } from "@/components/customer/support/Support";
import { Campaigns } from "@/components/customer/campaigns/Campaigns";

export function CustomerApp() {
  const { view, params, go } = useRouterStore();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setNotifications = useNotificationStore((s) => s.setItems);

  useEffect(() => {
    if (!user || !token) {
      go("/login");
      return;
    }
    // Refresh notifications on customer app mount
    services.notification.listByUser(user.id).then((res) => {
      if (res.ok && res.data) setNotifications(res.data);
    });
  }, [user, token, go, setNotifications]);

  if (!user || !token) {
    return null;
  }

  // Map view name to component
  const ViewComponent = renderCustomerView(view, params);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <CustomerSidebar />
      </div>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <CustomerSidebar mobile />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <CustomerTopbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">
          <div className="mx-auto max-w-7xl">{ViewComponent}</div>
        </main>
        <footer className="border-t px-6 py-4 text-xs text-muted-foreground mt-auto">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} OceanSky Bank. All rights reserved.</p>
            <p className="flex items-center gap-3">
              <a href="#/dashboard" className="hover:text-foreground">Dashboard</a>
              <a href="#/support" className="hover:text-foreground">Support</a>
              <a href="#/profile" className="hover:text-foreground">Profile</a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function renderCustomerView(view: string, params: string[]) {
  switch (view) {
    case "dashboard":
    case "":
      return <Dashboard />;
    case "accounts":
      return params[0] ? <AccountDetails /> : <Accounts />;
    case "transactions":
      return <Transactions />;
    case "transfers":
      return <Transfers />;
    case "beneficiaries":
      return <Beneficiaries />;
    case "cards":
      return <Cards />;
    case "bills":
      return <Bills />;
    case "statements":
      return <Statements />;
    case "profile":
      // /profile, /profile/security, /profile/preferences
      if (params[0] === "security") return <Security />;
      if (params[0] === "preferences") return <Preferences />;
      return <Profile />;
    case "notifications":
      return <Notifications />;
    case "support":
      return <Support />;
    case "campaigns":
    case "offers":
      return <Campaigns />;
    default:
      return <Dashboard />;
  }
}
