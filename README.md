# OceanSky Bank — Modern Digital Banking Application

OceanSky Bank is a complete, premium, modern digital banking application
built with Next.js 16, TypeScript, Tailwind CSS 4 and shadcn/ui. It contains a
full customer portal and a separate administrative portal — every page, form,
modal and workflow described below is implemented and interactive.

The application presents a US-oriented banking experience with USD as the
default currency and EUR as a selectable alternative. Currency switching is
fully functional and cascades across balances, transactions, charts, fees and
receipts throughout both portals.

> **Internal note for developers.** The application is backed by an in-memory
> simulated service layer at `/src/lib/services`. Internal/developer-facing
> comments and the `ARCHITECTURE.md`/`DELIVERY.md` documents honestly describe
> the simulated services so that engineers can plan the real-backend
> integration. Customer-facing UI text, however, never exposes the
> application as a mock, demo or prototype.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Demo Credentials](#demo-credentials)
6. [Routing](#routing)
7. [Currency Switching](#currency-switching)
8. [Balance Privacy Toggle](#balance-privacy-toggle)
9. [Advertisement & Campaign System](#advertisement--campaign-system)
10. [Scripts](#scripts)
11. [Deployment](#deployment)
12. [Replacing the Simulated Backend](#replacing-the-simulated-backend)
13. [License](#license)

---

## Features

### Customer Portal

- **Authentication & Onboarding**
  - Login with email + password
  - Registration with full validation
  - Six-digit OTP verification with 60-second resend countdown
  - Forgot-password flow with masked-destination confirmation
  - Logout and session persistence
- **Dashboard**
  - Total balance across accounts with **eye/eye-off privacy toggle**
  - Today's spend, monthly inflow, active cards, pending transactions
  - Income vs spending area chart (last 7 days)
  - Spending-by-category donut chart
  - Recent transactions list
  - Credit-card previews
  - Active promotional campaign banner (dismissible)
- **Accounts**
  - Account list with type filters
  - Per-account details with hero card, quick actions
  - Account activity (last 50 transactions)
  - "Open new account" request workflow
- **Transactions**
  - Search, account/type/status filters, date-range filter
  - Stats summary (count, total credits, total debits)
  - Detail modal with receipt
  - "Load more" pagination
  - CSV export
- **Transfers**
  - Internal and external transfers (US bank routing)
  - From-account picker, bank picker, beneficiary picker
  - Live fee + total debit preview
  - Confirmation modal
  - Receipt on success
  - Save-as-beneficiary toggle
- **Beneficiaries**
  - Add, list, search, filter, delete beneficiaries
  - Internal vs external
  - Send-money shortcut
- **Cards**
  - Credit-card visualizations (gradient, brand, masked PAN)
  - Lock / unlock
  - Channel toggles (online, contactless, ATM, POS)
  - Daily / monthly limit editor with spending progress
  - Card activity history
  - Freeze / report-lost / request-replacement
  - Request new card
- **Bills & Payments**
  - Wireless carriers (Verizon, AT&T, T-Mobile, US Cellular)
  - Data plans
  - Electricity (PG&E, Duke Energy)
  - Cable TV (Xfinity, DIRECTV)
  - Internet (Xfinity)
  - Dynamic biller fields
  - Amount input with quick amounts and plan parsing
  - Confirm → pay → receipt flow
  - Payment history
- **Statements**
  - Generate statements (PDF / CSV / Excel)
  - Account + date range selection
  - Opening/closing balances, totals
  - Download workflow
  - Recent statements table
- **Profile**
  - Personal info, address, account tier, preferences
  - Tier upgrade flow with benefits comparison
- **Security Centre**
  - Security score
  - Change password, transaction PIN
  - 2FA, biometric, login alerts toggles
  - Active sessions with revoke
- **Preferences**
  - **Display currency selector (USD / EUR)** — fully functional, cascades across the app
  - Notification channels (push/email/SMS)
  - Notification categories
  - Display and privacy settings
- **Notifications**
  - Inbox with filters (All/Unread/Transaction/Security/Promo/Support)
  - Mark read / mark all read
  - Per-type icons, unread indicators, action URLs
- **Support**
  - Live chat with typing indicator
  - Conversation history (tickets)
  - New ticket creation
  - Escalate ticket
  - FAQ accordion
  - Thumbs-up / thumbs-down feedback
- **Offers & Campaigns**
  - Active campaigns targeted by tier
  - **Dismissible promotional banners** (persisted across sessions)
  - Referral program card with code and stats

### Admin Portal

- **Authentication** — separate admin login
- **Operations Dashboard** — stats, charts (volume, customer growth, account distribution), top customers, recent audit activity, quick actions
- **Customer Management** — searchable/filterable list, profile drill-down with tabs (Accounts, Transactions, Cards, Support Tickets, Audit Trail), freeze/suspend/activate
- **Accounts Management** — full account list with filters, details Sheet
- **Transactions Management** — full transaction list with filters, receipt modal
- **Cards & Payments Management** — card list with channel toggles, limits, lock/unlock
- **Fraud & Risk Review** — flagged cases with risk scores, approve/block/escalate, notes, assign analyst
- **Live Support Inbox** — three-pane ticket/chat/details, assign/resolve/escalate
- **Notifications** — broadcast composer with audience targeting, templates, recent broadcasts
- **Campaigns** — full CRUD with scheduling, audience targeting, metrics, accent colors; campaigns created here appear in the customer portal
- **Staff & Roles** — staff list, role/permission reference, profile Sheet with permissions tree and recent activity
- **Audit Logs** — searchable, filterable, detail dialog with metadata
- **Bank Settings** — General / Fees & Limits / Security / Maintenance tabs, maintenance-mode banner

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 with custom OceanSky theme tokens |
| UI components | shadcn/ui (New York) + Lucide icons |
| Charts | Recharts |
| State | Zustand (auth, router, UI, notifications, currency) |
| Forms | react-hook-form + zod (where helpful); controlled components elsewhere |
| Notifications | sonner + custom toaster |
| Date handling | date-fns |
| Persistence | `zustand/persist` (auth, UI prefs, currency) + in-memory service store |

No external backend, no database, no third-party auth provider required to
run the application.

---

## Getting Started

### Prerequisites

- Node.js 18.18+ (or Bun 1.1+)
- npm, pnpm, yarn or bun

### Install & Run

```bash
# 1. Install dependencies
npm install        # or: bun install / pnpm install / yarn install

# 2. Start the dev server
npm run dev        # or: bun run dev

# 3. Open the app
# Local:   http://localhost:3000
# Sandbox: use the Preview Panel (do not visit localhost from outside the dev box)
```

The dev server runs on port 3000. The first compile takes a few seconds;
subsequent navigations are instant.

### Production Build

```bash
npm run build
npm run start
```

---

## Project Structure

```
oceansky-bank/
├── src/
│   ├── app/
│   │   ├── globals.css          # OceanSky theme tokens (teal/turquoise)
│   │   ├── layout.tsx           # Root layout + ThemeProvider + Toaster
│   │   └── page.tsx             # Single visible route — renders <OceanSkyApp />
│   ├── components/
│   │   ├── OceanSkyApp.tsx      # Root router: customer vs admin vs auth
│   │   ├── shared/              # Logo, PageHeader, StatCard, SectionCard,
│   │   │                        # OTPInput, AmountInput, ReceiptModal,
│   │   │                        # ConfirmDialog, DataTable, EmptyState,
│   │   │                        # ThemeProvider, BalanceDisplay (eye toggle),
│   │   │                        # CampaignBanner (dismissible ads)
│   │   ├── customer/
│   │   │   ├── CustomerApp.tsx  # Customer shell (sidebar + topbar + main)
│   │   │   ├── CustomerSidebar.tsx
│   │   │   ├── CustomerTopbar.tsx
│   │   │   ├── auth/            # Login, Register, OTPVerify, ForgotPassword
│   │   │   ├── dashboard/       # Dashboard (with balance eye toggle)
│   │   │   ├── accounts/        # Accounts + AccountDetails
│   │   │   ├── transactions/    # Transactions
│   │   │   ├── statements/      # Statements
│   │   │   ├── transfers/       # Transfers + Beneficiaries
│   │   │   ├── cards/           # Cards
│   │   │   ├── bills/           # Bills & Payments (US billers)
│   │   │   ├── profile/         # Profile, Security, Preferences (currency)
│   │   │   ├── notifications/   # Notifications
│   │   │   ├── support/         # Support chat + tickets + FAQ
│   │   │   └── campaigns/       # Offers & Campaigns
│   │   └── admin/
│   │       ├── AdminApp.tsx     # Admin shell
│   │       ├── AdminSidebar.tsx
│   │       ├── AdminTopbar.tsx
│   │       └── admin/           # AdminLogin, Dashboard, Customers,
│   │                             # CustomerProfile, Accounts, Transactions,
│   │                             # Cards, RiskReview, SupportInbox,
│   │                             # Notifications, Campaigns, Staff,
│   │                             # AuditLogs, Settings
│   ├── lib/
│   │   ├── types/index.ts       # All domain TypeScript types
│   │   ├── mock/index.ts        # US-based fictional dataset
│   │   ├── services/index.ts    # Service layer (auth, account, transfer,
│   │   │                        # card, bill, notification, support,
│   │   │                        # statement, campaign, admin)
│   │   ├── store/
│   │   │   ├── auth.store.ts    # Customer + admin session state (persisted)
│   │   │   ├── ui.store.ts      # Sidebar, balance visibility, dismissed campaigns
│   │   │   ├── currency.store.ts # Display currency (USD/EUR) + FX rates
│   │   │   └── notification.store.ts
│   │   ├── router/index.ts      # Custom hash-based router
│   │   ├── format/index.ts      # formatMoney, formatMoneyDisplay (with FX
│   │   │                        # conversion), formatDate, mask helpers
│   │   └── utils.ts             # cn() classnames helper
│   └── hooks/                   # use-toast, use-mobile
├── prisma/                      # Prisma schema (optional, unused by services)
├── public/                      # logo.svg, robots.txt
├── README.md                    # This file
├── DELIVERY.md                  # Feature inventory + known issues + future work
├── ARCHITECTURE.md              # Architecture + service-layer replacement guide
├── .env.example                 # Environment variables for future real backend
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── components.json              # shadcn/ui config
```

---

## Demo Credentials

### Customer Portal

```
Email:    olivia.bennett@oceansky.bank
Password: password123  (any non-empty password works)
OTP:      any 6 digits will verify
```

Additional customer accounts (any password works):

| Email | Tier | Notes |
| --- | --- | --- |
| `marcus.reed@oceansky.bank` | Standard | Mid-balance customer |
| `sophia.chen@oceansky.bank` | Private | High net worth |
| `daniel.foster@oceansky.bank` | Standard | Pending KYC |

### Admin Portal

```
URL:      http://localhost:3000/#/admin/login
Email:    daniel.okoro@oceansky.bank
Password: admin123  (any non-empty password works)
```

Other admin users (any password works):

| Email | Role |
| --- | --- |
| `susan.hayes@oceansky.bank` | Operations Manager |
| `victor.bauer@oceansky.bank` | Risk Analyst |
| `sarah.mitchell@oceansky.bank` | Support Agent |
| `grace.anderson@oceansky.bank` | Compliance Officer |

---

## Routing

OceanSky uses a **hash-based router** so the entire application runs from a
single Next.js route (`/`). The router parses `window.location.hash` into a
`{ portal, view, params }` shape and the `OceanSkyApp` root component switches
on it.

| Hash | Portal | View |
| --- | --- | --- |
| `#/login` | auth | Login |
| `#/register` | auth | Register |
| `#/otp` | auth | OTPVerify |
| `#/forgot-password` | auth | ForgotPassword |
| `#/dashboard` | customer | Dashboard |
| `#/accounts` | customer | Accounts |
| `#/accounts/{id}` | customer | AccountDetails |
| `#/transactions` | customer | Transactions |
| `#/transfers` | customer | Transfers |
| `#/beneficiaries` | customer | Beneficiaries |
| `#/cards` | customer | Cards |
| `#/bills` | customer | Bills |
| `#/statements` | customer | Statements |
| `#/profile` | customer | Profile |
| `#/profile/security` | customer | Security |
| `#/profile/preferences` | customer | Preferences |
| `#/notifications` | customer | Notifications |
| `#/support` | customer | Support |
| `#/campaigns` | customer | Campaigns |
| `#/admin/login` | admin | AdminLogin |
| `#/admin/dashboard` | admin | Dashboard |
| `#/admin/customers` | admin | Customers |
| `#/admin/customers/{id}` | admin | CustomerProfile |
| `#/admin/accounts` | admin | Accounts |
| `#/admin/transactions` | admin | Transactions |
| `#/admin/cards` | admin | Cards |
| `#/admin/risk` | admin | RiskReview |
| `#/admin/support` | admin | SupportInbox |
| `#/admin/notifications` | admin | Notifications |
| `#/admin/campaigns` | admin | Campaigns |
| `#/admin/staff` | admin | Staff |
| `#/admin/audit` | admin | AuditLogs |
| `#/admin/settings` | admin | Settings |

Navigation in code: `useRouterStore((s) => s.go)("/transfers")`.

---

## Currency Switching

The customer portal supports **USD** and **EUR** as display currencies. The
selection is driven by `useCurrencyStore` (persisted to `localStorage`).

- Change the display currency under **Profile → Preferences → Display → Display currency**.
- All monetary values across the customer and admin portals re-render in the
  selected currency, converted from the source currency using the static FX
  table in `src/lib/store/currency.store.ts`.
- The conversion helper is `formatMoneyDisplay(amount, sourceCurrency)` in
  `src/lib/format/index.ts`. Components call this instead of `formatMoney`
  so a currency change cascades automatically.

When a real FX service is available, replace the `FX_RATES` constant with a
fetch from `/api/fx/rates`.

---

## Balance Privacy Toggle

The customer dashboard's total balance — and other prominent balance
displays — include an **eye/eye-off toggle** that hides the value (showing
`••••••`) when clicked. The toggle is global: hiding the balance on the
dashboard also hides it on account cards and other sensitive displays.

Implementation:

- `useUIStore.balanceVisible` (persisted) holds the global state.
- `useUIStore.toggleBalanceVisible()` flips it.
- `<BalanceDisplay amount={...} sourceCurrency={...} size="xl" />` is the
  reusable component (in `src/components/shared/BalanceDisplay.tsx`).

---

## Advertisement & Campaign System

The promotional / campaign system is fully wired between the customer portal
and the admin portal:

- **Customer-facing**: the dashboard renders a dismissible featured campaign
  banner; the Offers page lists all active campaigns as cards. Dismissed
  campaigns stay dismissed across sessions (persisted in `useUIStore`).
- **Admin**: the admin Campaigns page (`#/admin/campaigns`) supports full CRUD
  — create, edit, duplicate, pause/resume, delete, schedule, audience
  targeting, accent colors, and metrics tracking.
- **Shared component**: `<CampaignBanner campaign={...} variant="full" | "compact" | "inline" />`
  in `src/components/shared/CampaignBanner.tsx` renders the banner with the
  gradient, CTA, and dismiss button. Variants allow placement on the
  dashboard (`full`), in grids (`compact`), or inline in sidebars/rows
  (`inline`).

Campaigns created in the admin portal appear in the customer portal's
dashboard and Offers page in real time (subject to `status`, `audience`, and
`startsAt`/`endsAt` window).

---

## Scripts

```bash
npm run dev         # Start dev server on port 3000
npm run build       # Production build
npm run start       # Start production server (after build)
npm run lint        # ESLint (Next.js + custom rules)
npm run db:push     # Push Prisma schema to SQLite (unused by services)
npm run db:generate # Generate Prisma client
```

---

## Deployment

OceanSky is a standard Next.js 16 App Router project. Deploy to any
Node.js-capable host:

### Vercel (recommended)

1. Import the repository into Vercel.
2. Framework preset: **Next.js**.
3. Build command: `next build` (default).
4. Output: handled automatically.
5. No environment variables are required for the build. When you wire a real
   backend, set the variables from `.env.example`.

### Self-hosted (Docker)

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Make sure `output: "standalone"` is set in `next.config.ts` (it is).

---

## Replacing the Simulated Backend

The service layer lives in `src/lib/services/index.ts`. Every exported
function is a stable contract with a future REST/GraphQL endpoint. To swap in
a real backend:

1. Open `src/lib/services/index.ts`.
2. Replace the body of each function with a `fetch`/`axios` call to your API.
3. Keep the function signature and return type (`ServiceResult<T>`) intact so
   no UI component needs to change.
4. Replace the `FX_RATES` constant in `src/lib/store/currency.store.ts` with a
   live FX API call.

See `ARCHITECTURE.md` for the full endpoint mapping and step-by-step guide.

---

## License

This project is delivered as a buildable source code package. All names,
accounts, cards, transactions and other data are fictional and intended only
for development and demonstration.
