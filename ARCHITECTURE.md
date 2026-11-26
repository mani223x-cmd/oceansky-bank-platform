# OceanSky Bank — Architecture

This document explains the structure of OceanSky Bank, the service layer
contract, the routing model, the currency-switching mechanism, the balance
privacy toggle, and exactly how to replace the simulated backend with a real
one without redesigning the UI.

> **Honesty note for engineers.** The service layer at
> `/src/lib/services/index.ts` is an in-memory simulated backend. Internal
> code comments and this document use the words "simulated" / "mock" so
> engineers can plan real-backend integration. Customer-facing UI text never
> uses these terms — the application presents itself as a production banking
> experience.

---

## 1. High-level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Next.js 16 App Router                          │
│                  /src/app/page.tsx (single route)                  │
└───────────────────────────────┬────────────────────────────────────┘
                                │ renders
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                   <OceanSkyApp />  (root router)                   │
│         src/components/OceanSkyApp.tsx                             │
│   Reads useRouterStore (hash) and decides:                         │
│     - auth view  → Login / Register / OTP / Forgot                 │
│     - customer   → <CustomerApp/>  (auth-gated)                    │
│     - admin      → <AdminApp/>     (admin-auth-gated)              │
└───────────────────────────────┬────────────────────────────────────┘
                ┌───────────────┴───────────────┐
                ▼                               ▼
   ┌────────────────────────┐       ┌────────────────────────┐
   │   CustomerApp          │       │   AdminApp              │
   │ - Sidebar / Topbar     │       │ - Sidebar / Topbar      │
   │ - renderCustomerView() │       │ - renderAdminView()     │
   │ - 14 view components   │       │ - 13 view components    │
   └───────────┬────────────┘       └────────────┬────────────┘
               │ uses                             │ uses
               ▼                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │            Service Layer (src/lib/services/)                │
   │  auth, user, account, transaction, transfer, beneficiary,   │
   │  card, bill, notification, support, statement, campaign,    │
   │  admin                                                      │
   │                                                             │
   │  Every function returns Promise<ServiceResult<T>>           │
   │  Currently implemented with an in-memory mock DB.           │
   └───────────┬────────────────────────────────────┬────────────┘
               │ reads / writes                     │ seeds
               ▼                                    ▼
   ┌────────────────────────┐       ┌────────────────────────────┐
   │  Mock in-memory DB     │       │  Mock seed dataset         │
   │  (mutable copies of    │       │  (src/lib/mock/index.ts)   │
   │   the seed data)       │       │  Users, accounts, txns,    │
   │                        │       │  cards, billers, ...       │
   └────────────────────────┘       └────────────────────────────┘
```

The UI is **strictly separated** from the business logic. No view component
mutates the mock DB directly — they all call service functions.

---

## 2. Routing

OceanSky uses a hash-based router (`src/lib/router/index.ts`). The router
parses `window.location.hash` into:

```ts
interface RouteState {
  path: string;        // "admin/customers/usr_001"
  portal: "customer" | "admin" | "auth";
  view: string;        // "customers"
  params: string[];    // ["usr_001"]
  go: (to: string) => void;
  goView: (view: string) => void;
  init: () => () => void;  // subscribes to hashchange
}
```

The router is a Zustand store. To navigate in code:

```ts
import { useRouterStore } from "@/lib/router";
const go = useRouterStore((s) => s.go);
go("/transfers");        // → sets window.location.hash to "#/transfers"
go("/admin/dashboard");
```

Hash routing was chosen because the application must run from a single
visible Next.js route (`/`). All "pages" are rendered by switching on the
hash inside `<OceanSkyApp />`.

---

## 3. State Management

Five Zustand stores:

| Store | File | Purpose |
| --- | --- | --- |
| `useAuthStore` | `src/lib/store/auth.store.ts` | Customer session (`user`, `token`, `pendingChallenge`) and admin session (`admin`, `adminToken`). Persisted to `localStorage` via `zustand/persist`. |
| `useUIStore` | `src/lib/store/ui.store.ts` | Sidebar open/close, command palette, **balance visibility toggle** (`balanceVisible`), **dismissed campaign IDs** (`dismissedCampaigns`). Persisted. |
| `useCurrencyStore` | `src/lib/store/currency.store.ts` | **Display currency** (`USD` or `EUR`) + static `FX_RATES` table. Persisted. Drives all monetary formatting via `formatMoneyDisplay`. |
| `useNotificationStore` | `src/lib/store/notification.store.ts` | In-memory cache of the current user's notifications, with `add`, `markRead`, `markAllRead`, `unreadCount`. |
| `useRouterStore` | `src/lib/router/index.ts` | Hash router state (see above). |

No TanStack Query is used today — every service call is fired in `useEffect`
or in event handlers. When replacing the simulated services with a real
backend, TanStack Query can be dropped in around the same service functions
for caching, refetching, etc., without touching components.

### 3a. Currency Switching

The customer portal supports USD and EUR as display currencies. The flow:

1. `useCurrencyStore.currency` holds the selected display currency
   (`"USD"` or `"EUR"`). Default is `"USD"`. Persisted to `localStorage`.
2. `FX_RATES` in the same file is a static table pegged to USD:
   `{ USD: 1, EUR: 0.92 }`.
3. `formatMoneyDisplay(amount, sourceCurrency)` in `src/lib/format/index.ts`
   converts from the source currency to the display currency using
   `convertCurrency(amount, from, to)`, then formats with `Intl.NumberFormat`.
4. Components call `formatMoneyDisplay(amount, account.currency)` instead of
   `formatMoney(amount, currency)`. When the store's `currency` changes, every
   component re-renders with the new currency because Zustand subscriptions
   fire.
5. The currency selector lives in **Profile → Preferences → Display → Display
   currency** and calls `useCurrencyStore.setCurrency(value)`.

When a real FX service is available, replace the `FX_RATES` constant with a
fetch from `/api/fx/rates` and cache the result.

### 3b. Balance Privacy Toggle

The customer dashboard's total balance — and other prominent balance
displays — include an eye/eye-off toggle that hides the value (showing
`••••••`) when clicked. The toggle is global: hiding the balance on the
dashboard also hides it on account cards and other sensitive displays.

Implementation:

- `useUIStore.balanceVisible` (persisted) holds the global state.
- `useUIStore.toggleBalanceVisible()` flips it.
- `<BalanceDisplay amount={...} sourceCurrency={...} size="xl" />` is the
  reusable component (in `src/components/shared/BalanceDisplay.tsx`). It
  renders the formatted amount + the eye button in one unit.
- For gradient backgrounds where `BalanceDisplay`'s default foreground color
  clashes, components fall back to `formatMoneyDisplay` + a manual
  `<button>` calling `toggleBalanceVisible` with the `Eye`/`EyeOff` icons.

### 3c. Campaign / Advertisement System

Campaigns flow from the admin portal to the customer portal:

1. Admin creates a campaign in `#/admin/campaigns` via
   `adminService.createCampaign`. The campaign is stored in the in-memory
   `db.campaigns` array.
2. The customer portal's dashboard and Offers page call
   `campaignService.listForUser(user.tier)` which filters by `status`,
   `audience`, and the `startsAt`/`endsAt` window.
3. The shared `<CampaignBanner campaign={c} variant="full" | "compact" | "inline" />`
   component (`src/components/shared/CampaignBanner.tsx`) renders the banner
   with a gradient (by `accentColor`), the CTA button (which routes to
   `ctaUrl`), and a dismiss (X) button.
4. Dismissal is persisted: `useUIStore.dismissCampaign(id)` adds the ID to
   `dismissedCampaigns` (persisted to `localStorage`). The
   `CampaignBanner` component returns `null` if
   `isCampaignDismissed(campaign.id)` is true.

---

## 4. Service Layer Contract

Every service function returns `Promise<ServiceResult<T>>`:

```ts
interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}
```

Calling pattern in components:

```ts
const res = await services.transfer.execute(req, user.id);
if (!res.ok || !res.data) {
  toast({ title: res.error || "Transfer failed", variant: "destructive" });
  return;
}
// use res.data
```

This envelope stays the same whether the implementation is mock or real —
the only difference is the body of the function.

### Service catalogue

| Service | File location | Methods |
| --- | --- | --- |
| `authService` | `services/index.ts` | login, verifyOtp, register, forgotPassword, adminLogin, logout |
| `userService` | same | getById, update, getSessions, revokeSession, getNotificationPrefs, updateNotificationPrefs |
| `accountService` | same | listByUser, getById, activity |
| `transactionService` | same | listByUser, getById |
| `transferService` | same | preview, execute |
| `beneficiaryService` | same | listByUser, create, remove |
| `cardService` | same | listByUser, getById, toggleLock, updateLimits, toggleChannel, transactions |
| `billService` | same | listBillers, getBiller, payBill, listPayments |
| `notificationService` | same | listByUser, markRead, markAllRead |
| `supportService` | same | listTicketsByUser, getTicket, listMessages, sendMessage, createTicket, listFAQs, escalate, listAllTickets, assignTicket, resolveTicket |
| `statementService` | same | listByUser, generate |
| `campaignService` | same | listForUser |
| `adminService` | same | dashboardStats, listCustomers, getCustomer, toggleCustomerStatus, listAccounts, listTransactions, listCards, listRiskCases, resolveRiskCase, listAuditLogs, listStaff, createCampaign, updateCampaign, deleteCampaign, listCampaigns, broadcastNotification, getBankSettings, updateBankSettings |

The aggregate `services` object is what components import:

```ts
import { services } from "@/lib/services";
services.card.toggleLock(cardId, true);
```

---

## 5. Mock Data Layer

`src/lib/mock/index.ts` exports frozen seed arrays:

- `MOCK_USERS`, `MOCK_ACCOUNTS`, `MOCK_TRANSACTIONS`, `MOCK_BENEFICIARIES`,
  `MOCK_CARDS`, `MOCK_CARD_TXNS`, `MOCK_BILLERS`, `MOCK_BILL_PAYMENTS`,
  `MOCK_NOTIFICATIONS`, `MOCK_NOTIFICATION_PREFS`, `MOCK_TICKETS`,
  `MOCK_CHAT_MESSAGES`, `MOCK_FAQS`, `MOCK_STATEMENTS`, `MOCK_CAMPAIGNS`,
  `MOCK_ADMIN_USERS`, `MOCK_RISK_CASES`, `MOCK_AUDIT_LOGS`,
  `MOCK_BANK_SETTINGS`, `MOCK_USER_SESSIONS`.

`src/lib/services/index.ts` makes mutable copies of these into a private
`db` object at module load. All service reads and writes operate on `db`, so
customer/admin actions (transfers, card locks, ticket replies, etc.) persist
across screen navigations until the page is refreshed.

For a real backend, the entire `db` object and the mock seed file are
removed; service functions become HTTP calls.

---

## 6. Replacing the Mock Layer

### Strategy

1. Keep the function signatures in `src/lib/services/index.ts` intact.
2. Replace the body of each function with `fetch` / `axios`.
3. Wrap responses in the same `ServiceResult<T>` envelope.
4. Remove the `db` object and the mock imports.
5. Configure `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

### Example: before (mock)

```ts
async listByUser(userId: string): Promise<ServiceResult<Account[]>> {
  return delay(ok(db.accounts.filter((a) => a.userId === userId)));
}
```

### Example: after (real)

```ts
async listByUser(userId: string): Promise<ServiceResult<Account[]>> {
  try {
    const res = await fetch(`${API_BASE}/accounts?userId=${userId}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json();
      return err(err.message, err.code);
    }
    const data = await res.json();
    return ok(data.accounts);
  } catch (e) {
    return err("Network error", "NETWORK");
  }
}
```

No UI component needs to change.

### Authentication

The mock persists a fake `mock_<uuid>` token in `localStorage`. For
production:

1. Replace `authService.verifyOtp` to call the real backend, which sets an
   **httpOnly cookie** containing the access token.
2. Remove `token` from `useAuthStore` (keep `user` only).
3. Set `credentials: "include"` on every `fetch` so cookies are sent.
4. Replace `authService.logout` to call `POST /api/auth/logout` to clear the
   server-side cookie.

### File layout for a real backend

When the real backend arrives, the recommended structure is:

```
src/lib/services/
├── index.ts          # still exports the `services` aggregate
├── client.ts         # shared fetch wrapper + error normaliser
├── auth.service.ts
├── account.service.ts
├── transfer.service.ts
├── ...
└── admin.service.ts
```

Splitting the current monolithic `index.ts` into per-domain files is purely
a refactor — the public surface (the `services` object) stays identical.

---

## 7. Real-time Support (optional)

If the support chat needs true real-time push (instead of the current
simulated 2-3s agent reply), use Socket.io as a Next.js mini-service.

### Mini-service template

```
mini-services/support-ws/
├── package.json
└── index.ts    # socket.io server on port 3003
```

`mini-services/support-ws/index.ts`:

```ts
import { Server } from "socket.io";
const io = new Server(3003, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("customer:message", ({ ticketId, body }) => {
    // broadcast to admin agents
    io.emit("admin:message", { ticketId, body, ts: Date.now() });
  });
  socket.on("agent:message", ({ ticketId, body }) => {
    io.emit("customer:message", { ticketId, body, ts: Date.now() });
  });
});
```

### Frontend client

```ts
import { io } from "socket.io-client";
const socket = io("/?XTransformPort=3003"); // uses Caddy gateway
socket.on("customer:message", handler);
socket.emit("agent:message", { ticketId, body });
```

Remember: gateway routing requires `XTransformPort` in the URL query, never
a direct port in the host.

---

## 8. Component Conventions

- All view components are `"use client"`.
- Use shadcn/ui components from `src/components/ui/*` for primitives.
- Use the shared helpers in `src/components/shared/*`:
  - `Logo`, `PageHeader`, `StatCard`, `SectionCard`, `DataTable`,
    `EmptyState`, `ConfirmDialog`, `ReceiptModal`, `AmountInput`,
    `OTPInput`, `ThemeProvider`.
- Use the formatters in `src/lib/format/index.ts`:
  - `formatMoney`, `formatMoneyShort`, `formatNumber`, `formatDate`,
    `formatDateTime`, `timeAgo`, `formatRelativeShort`, `maskAccountNumber`,
    `maskPhone`, `maskEmail`, `initials`.
- Brand colors: `teal`, `teal-dark`, `teal-light`, `turquoise`, `ocean` —
  exposed as Tailwind utilities (`bg-teal`, `text-teal`, etc.) and as CSS
  variables (`var(--teal)`).
- Gradient helpers: `bg-ocean-gradient`, `bg-ocean-gradient-soft`,
  `bg-card-gradient`, `text-gradient-teal`, `glass-card`.
- Indigo and blue are intentionally NOT used as brand colors.

---

## 9. Build & Runtime Notes

- Next.js 16 with Turbopack dev server.
- Tailwind CSS 4 (PostCSS pipeline, no `tailwind.config.ts` content array
  needed — `@theme inline` in `globals.css` wires the tokens).
- TypeScript strict mode. No `any` without explicit annotation.
- ESLint flat config (`eslint.config.mjs`) — Next.js recommended rules.
- The dev server runs on port 3000. The sandbox gateway (Caddyfile) maps
  external HTTPS to internal port 3000.
- `next.config.ts` has `output: "standalone"` for Docker deployment.

---

## 10. File-tree Summary

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── OceanSkyApp.tsx
│   ├── shared/
│   ├── customer/
│   │   ├── CustomerApp.tsx
│   │   ├── CustomerSidebar.tsx
│   │   ├── CustomerTopbar.tsx
│   │   ├── auth/        (Login, Register, OTPVerify, ForgotPassword)
│   │   ├── dashboard/
│   │   ├── accounts/
│   │   ├── transactions/
│   │   ├── statements/
│   │   ├── transfers/
│   │   ├── cards/
│   │   ├── bills/
│   │   ├── profile/
│   │   ├── notifications/
│   │   ├── support/
│   │   └── campaigns/
│   └── admin/
│       ├── AdminApp.tsx
│       ├── AdminSidebar.tsx
│       ├── AdminTopbar.tsx
│       └── admin/       (AdminLogin, Dashboard, Customers, CustomerProfile,
│                         Accounts, Transactions, Cards, RiskReview,
│                         SupportInbox, Notifications, Campaigns, Staff,
│                         AuditLogs, Settings)
├── lib/
│   ├── types/index.ts
│   ├── mock/index.ts
│   ├── services/index.ts
│   ├── store/ (auth, ui, notification)
│   ├── router/index.ts
│   ├── format/index.ts
│   └── utils.ts
└── hooks/ (use-toast, use-mobile)
```

---

End of architecture document.
