// ============================================================================
// OceanSky Bank — Currency / Number / Date formatting helpers
// ============================================================================
import { format, formatDistanceToNow, parseISO } from "date-fns";

// ----------------------------------------------------------------------------
// Display currency — driven by the currency preference store.
// Components import `getDisplayCurrency()` and `useDisplayCurrency()` so they
// always render in the customer's selected currency, with conversion applied
// from the source currency using the rates below.
// ----------------------------------------------------------------------------

import { useCurrencyStore, type CurrencyCode, FX_RATES } from "@/lib/store/currency.store";

export function formatMoney(
  amount: number,
  currency: CurrencyCode = "USD",
  opts?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...opts,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a money amount, converting from the source currency into the
 * customer's selected display currency.
 *
 *   formatMoneyDisplay(100, "USD")  →  "$100.00"   (when display is USD)
 *   formatMoneyDisplay(100, "USD")  →  "€92.00"    (when display is EUR)
 *
 * Components that display balances, transaction amounts, fees, totals, etc.
 * should use this helper so a currency change in Preferences cascades
 * throughout the app.
 */
export function formatMoneyDisplay(
  amount: number,
  sourceCurrency: CurrencyCode = "USD"
): string {
  const display = useCurrencyStore.getState().currency;
  const converted = convertCurrency(amount, sourceCurrency, display);
  return formatMoney(converted, display);
}

/**
 * Convert an amount from one currency to another using the static FX table
 * in the currency store. Rates are pegged to USD.
 */
export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): number {
  if (from === to) return amount;
  const usdAmount = amount / FX_RATES[from];
  return usdAmount * FX_RATES[to];
}

export function formatMoneyShort(amount: number, currency: CurrencyCode = "USD"): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  if (Math.abs(amount) >= 1_000_000) {
    return `${symbol}${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  }
  return formatMoney(amount, currency);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(iso: string, pattern = "MMM d, yyyy"): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string, pattern = "MMM d, yyyy, h:mm a"): string {
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function maskAccountNumber(num: string): string {
  if (num.length <= 4) return num;
  return `••••${num.slice(-4)}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  return `${phone.slice(0, 3)}•••${phone.slice(-2)}`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const masked = user.length > 2 ? `${user.slice(0, 2)}•••` : "•••";
  return `${masked}@${domain}`;
}

export function initials(first: string, last: string): string {
  return `${(first?.[0] || "").toUpperCase()}${(last?.[0] || "").toUpperCase()}`;
}

export function formatRelativeShort(iso: string): string {
  try {
    const date = parseISO(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d`;
    return format(date, "MMM d");
  } catch {
    return iso;
  }
}

/**
 * Re-export the currency hook for convenience so components can import
 * both formatting helpers and the currency hook from the same module.
 */
export { useCurrencyStore, type CurrencyCode } from "@/lib/store/currency.store";
