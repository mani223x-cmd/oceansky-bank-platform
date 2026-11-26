"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// UI shell store: sidebar open / closed state, command palette, balance
// visibility toggle (eye icon), dismissed campaign IDs.
interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  // Balance visibility — applies to dashboard, accounts, cards, etc.
  balanceVisible: boolean;
  toggleBalanceVisible: () => void;
  setBalanceVisible: (v: boolean) => void;
  // Dismissed campaign IDs (for dismissible promotional ads).
  dismissedCampaigns: string[];
  dismissCampaign: (id: string) => void;
  isCampaignDismissed: (id: string) => boolean;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      commandOpen: false,
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      balanceVisible: true,
      toggleBalanceVisible: () => set((s) => ({ balanceVisible: !s.balanceVisible })),
      setBalanceVisible: (balanceVisible) => set({ balanceVisible }),
      dismissedCampaigns: [],
      dismissCampaign: (id) =>
        set((s) =>
          s.dismissedCampaigns.includes(id)
            ? s
            : { dismissedCampaigns: [...s.dismissedCampaigns, id] }
        ),
      isCampaignDismissed: (id) => get().dismissedCampaigns.includes(id),
    }),
    {
      name: "oceansky-ui",
      partialize: (s) => ({
        balanceVisible: s.balanceVisible,
        dismissedCampaigns: s.dismissedCampaigns,
      }),
    }
  )
);
