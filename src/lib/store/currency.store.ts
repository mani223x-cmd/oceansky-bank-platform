"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// ----------------------------------------------------------------------------
// Display currency store
// ----------------------------------------------------------------------------
// Holds the customer's preferred display currency (USD or EUR). All monetary
// values across the customer and admin portals are rendered in this currency,
// converted from their source currency using the static FX table below.
//
// Rates are pegged to USD = 1 and are intentionally round numbers for
// readability. When a real FX service is integrated, replace FX_RATES with
// a fetch from `/api/fx/rates`.
// ----------------------------------------------------------------------------

export type CurrencyCode = "USD" | "EUR";

export const FX_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
};

interface CurrencyState {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: "USD",
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: "oceansky-currency",
    }
  )
);
