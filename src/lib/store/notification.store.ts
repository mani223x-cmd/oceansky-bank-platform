"use client";
import { create } from "zustand";
import type { AppNotification } from "@/lib/types";

// In-memory notification cache for the active user. Refreshed on login.
interface NotificationState {
  items: AppNotification[];
  setItems: (items: AppNotification[]) => void;
  add: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  unreadCount: () => number;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  setItems: (items) => set({ items }),
  add: (n) => set((s) => ({ items: [n, ...s.items] })),
  markRead: (id) =>
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllRead: () =>
    set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
  unreadCount: () => get().items.filter((n) => !n.read).length,
  clear: () => set({ items: [] }),
}));
