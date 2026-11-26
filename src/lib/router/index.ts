"use client";
import { create } from "zustand";

// ----------------------------------------------------------------------------
// OceanSky Router — lightweight hash router.
// We use a hash-based router because the application lives entirely on the
// single visible Next.js route "/". Hashes like "#dashboard", "#admin", and
// "#admin/customers" are parsed into a route shape that React components can
// switch on.
// ----------------------------------------------------------------------------

export interface RouteState {
  /** full hash string without the leading "#" */
  path: string;
  /** first segment: "customer" | "admin" | "" */
  portal: "customer" | "admin" | "auth";
  /** remaining path within the portal */
  view: string;
  /** additional segments after the view */
  params: string[];
  /** set a new route */
  go: (to: string) => void;
  /** convenience: navigate within current portal */
  goView: (view: string) => void;
  /** subscribe to hashchange */
  init: () => () => void;
}

function parseHash(hash: string): Pick<RouteState, "path" | "portal" | "view" | "params"> {
  const raw = hash.replace(/^#\/?/, "").trim();
  const segments = raw.split("/").filter(Boolean);
  if (segments.length === 0) {
    return { path: "", portal: "auth", view: "", params: [] };
  }
  const first = segments[0];
  if (first === "admin") {
    const view = segments[1] || "dashboard";
    return {
      path: raw,
      portal: "admin",
      view,
      params: segments.slice(2),
    };
  }
  // Everything else is treated as a customer view
  return {
    path: raw,
    portal: "customer",
    view: first,
    params: segments.slice(1),
  };
}

export const useRouterStore = create<RouteState>((set, get) => ({
  ...parseHash(typeof window !== "undefined" ? window.location.hash : ""),
  go: (to) => {
    const clean = to.startsWith("#") ? to : `#${to.startsWith("/") ? "" : "/"}${to}`;
    if (typeof window !== "undefined") {
      window.location.hash = clean;
    }
  },
  goView: (view) => {
    const { portal } = get();
    const base = portal === "admin" ? "/admin" : "";
    get().go(`${base}/${view}`.replace("//", "/"));
  },
  init: () => {
    if (typeof window === "undefined") return () => {};
    const onChange = () => set(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    if (!window.location.hash) {
      window.location.hash = "#/login";
    }
    set(parseHash(window.location.hash));
    return () => window.removeEventListener("hashchange", onChange);
  },
}));

/** Convenience hook to read the current route in a component. */
export function useRoute() {
  return useRouterStore((s) => ({
    path: s.path,
    portal: s.portal,
    view: s.view,
    params: s.params,
    go: s.go,
    goView: s.goView,
  }));
}
