"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminUser, User } from "@/lib/types";

// ----------------------------------------------------------------------------
// Auth store — tracks current customer and current admin.
// Uses persist middleware so logins survive page refresh.
// Mock-only: token is a fake `mock_<uuid>` string.
// ----------------------------------------------------------------------------
interface AuthState {
  // customer
  user: User | null;
  token: string | null;
  pendingChallenge: { userId: string; otpChallengeId: string; otpCode: string; destination: string } | null;
  // admin
  admin: AdminUser | null;
  adminToken: string | null;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAdmin: (admin: AdminUser | null) => void;
  setAdminToken: (token: string | null) => void;
  setPendingChallenge: (c: AuthState["pendingChallenge"]) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      pendingChallenge: null,
      admin: null,
      adminToken: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setAdmin: (admin) => set({ admin }),
      setAdminToken: (adminToken) => set({ adminToken }),
      setPendingChallenge: (pendingChallenge) => set({ pendingChallenge }),
      reset: () => set({ user: null, token: null, pendingChallenge: null, admin: null, adminToken: null }),
    }),
    {
      name: "oceansky-auth",
      // Note: tokens here are mock-only. A real implementation should NOT
      // persist raw access tokens in localStorage — replace with httpOnly
      // cookies served from the real backend.
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        admin: s.admin,
        adminToken: s.adminToken,
      }),
    }
  )
);
