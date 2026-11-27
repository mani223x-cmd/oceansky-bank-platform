"use client";

import { useEffect } from "react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { useUIStore } from "@/lib/store/ui.store";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AdminDashboard } from "@/components/admin/admin/Dashboard";
import { AdminCustomers } from "@/components/admin/admin/Customers";
import { AdminCustomerProfile } from "@/components/admin/admin/CustomerProfile";
import { AdminAccounts } from "@/components/admin/admin/Accounts";
import { AdminTransactions } from "@/components/admin/admin/Transactions";
import { AdminCards } from "@/components/admin/admin/Cards";
import { AdminRiskReview } from "@/components/admin/admin/RiskReview";
import { AdminSupportInbox } from "@/components/admin/admin/SupportInbox";
import { AdminNotifications } from "@/components/admin/admin/Notifications";
import { AdminCampaigns } from "@/components/admin/admin/Campaigns";
import { AdminStaff } from "@/components/admin/admin/Staff";
import { AdminAuditLogs } from "@/components/admin/admin/AuditLogs";
import { AdminSettings } from "@/components/admin/admin/Settings";
import { AdminCreditAccount } from "@/components/admin/admin/CreditAccount";

export function AdminApp() {
  const { view, params, go } = useRouterStore();
  const admin = useAuthStore((s) => s.admin);
  const adminToken = useAuthStore((s) => s.adminToken);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  useEffect(() => {
    if (!admin || !adminToken) {
      go("/admin/login");
      return;
    }
  }, [admin, adminToken, go]);

  if (!admin || !adminToken) {
    return null;
  }

  const ViewComponent = renderAdminView(view, params);

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <AdminSidebar />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <AdminSidebar mobile />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <AdminTopbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">
          <div className="mx-auto max-w-7xl">{ViewComponent}</div>
        </main>
        <footer className="border-t px-6 py-4 text-xs text-muted-foreground mt-auto">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} OceanSky Bank — Operations Portal.</p>
            <p className="flex items-center gap-3">
              <a href="#/admin/dashboard" className="hover:text-foreground">Dashboard</a>
              <a href="#/admin/audit" className="hover:text-foreground">Audit</a>
              <a href="#/admin/settings" className="hover:text-foreground">Settings</a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function renderAdminView(view: string, params: string[]) {
  switch (view) {
    case "dashboard":
    case "analytics":
    case "":
      return <AdminDashboard />;
    case "customers":
      return params[0] ? <AdminCustomerProfile /> : <AdminCustomers />;
    case "accounts":
      return <AdminAccounts />;
    case "transactions":
      return <AdminTransactions />;
    case "cards":
      return <AdminCards />;
    case "risk":
      return <AdminRiskReview />;
    case "support":
      return <AdminSupportInbox />;
    case "notifications":
      return <AdminNotifications />;
    case "campaigns":
      return <AdminCampaigns />;
    case "staff":
      return <AdminStaff />;
    case "audit":
      return <AdminAuditLogs />;
    case "settings":
      return <AdminSettings />;
    case "credit-account":
      return <AdminCreditAccount />;
    default:
      return <AdminDashboard />;
  }
}
