"use client";

import { useEffect } from "react";
import { useRouterStore } from "@/lib/router";
import { useAuthStore } from "@/lib/store/auth.store";
import { CustomerApp } from "@/components/customer/CustomerApp";
import { AdminApp } from "@/components/admin/AdminApp";
import { Login } from "@/components/customer/auth/Login";
import { Register } from "@/components/customer/auth/Register";
import { OTPVerify } from "@/components/customer/auth/OTPVerify";
import { ForgotPassword } from "@/components/customer/auth/ForgotPassword";
import { AdminLogin } from "@/components/admin/admin/AdminLogin";

/**
 * Root component for the OceanSky Bank application.
 * Reads the hash router state and decides which portal/view to render.
 *
 * Routing rules:
 *   #/login                -> customer login
 *   #/register             -> customer register
 *   #/otp                  -> OTP verification
 *   #/forgot-password      -> forgot password
 *   #/dashboard            -> customer portal (auth-gated)
 *   #/admin/login          -> admin login
 *   #/admin/dashboard      -> admin portal (auth-gated)
 */
export function OceanSkyApp() {
  const { portal, view, init, go } = useRouterStore();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const admin = useAuthStore((s) => s.admin);
  const adminToken = useAuthStore((s) => s.adminToken);

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, [init]);

  // Default route when hash is empty
  useEffect(() => {
    if (typeof window !== "undefined" && !window.location.hash) {
      window.location.hash = "#/login";
    }
  }, []);

  // ----- Public auth views (no session required) -----
  if (portal === "auth" || (portal === "customer" && isAuthView(view))) {
    if (portal === "auth") {
      // No hash at all — render login as the entry.
      return <Login />;
    }
    switch (view) {
      case "login":
        return <Login />;
      case "register":
        return <Register />;
      case "otp":
        return <OTPVerify />;
      case "forgot-password":
        return <ForgotPassword />;
      default:
        return <Login />;
    }
  }

  // ----- Admin portal -----
  if (portal === "admin") {
    if (view === "login") {
      if (admin && adminToken) {
        go("/admin/dashboard");
        return null;
      }
      return <AdminLogin />;
    }
    if (!admin || !adminToken) {
      return <AdminLogin />;
    }
    return <AdminApp />;
  }

  // ----- Customer portal -----
  if (portal === "customer") {
    if (!user || !token) {
      // If they're trying to hit a customer view but not logged in,
      // send them to login.
      if (!isAuthView(view)) {
        return <Login />;
      }
    } else {
      return <CustomerApp />;
    }
  }

  // Fallback
  return <Login />;
}

function isAuthView(view: string): boolean {
  return ["login", "register", "otp", "forgot-password", ""].includes(view);
}
