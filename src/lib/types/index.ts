// ============================================================================
// OceanSky Bank — Domain Types
// ----------------------------------------------------------------------------
// Centralised TypeScript types for the entire OceanSky Bank application.
// Mock-only: these structures describe the simulated domain entities that
// live in /src/lib/mock and are served via /src/lib/services. When a real
// backend replaces the mock services, these types should remain valid.
// ============================================================================

export type ID = string;
export type ISODate = string; // ISO 8601 string

// ----------------------------------------------------------------------------
// Users & Authentication
// ----------------------------------------------------------------------------
export type UserStatus = "active" | "locked" | "dormant" | "pending";

export interface User {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  status: UserStatus;
  tier: "standard" | "premium" | "private";
  createdAt: ISODate;
  lastLoginAt?: ISODate;
  kycVerified: boolean;
  nationality: string;
  occupation?: string;
  address?: Address;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface AuthSession {
  userId: ID;
  token: string;
  issuedAt: ISODate;
  expiresAt: ISODate;
  scope: "customer" | "admin";
}

export interface OTPChallenge {
  challengeId: ID;
  channel: "email" | "sms";
  destination: string; // masked email/phone
  code: string; // mock only — exposed for dev visibility
  expiresAt: ISODate;
  attemptsRemaining: number;
}

export interface AdminUser {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminRole;
  department: "engineering" | "operations" | "risk" | "support" | "compliance" | "executive";
  status: "active" | "suspended";
  lastActiveAt?: ISODate;
  permissions: string[];
}

export type AdminRole =
  | "super_admin"
  | "operations_manager"
  | "risk_analyst"
  | "support_agent"
  | "compliance_officer"
  | "read_only";

// ----------------------------------------------------------------------------
// Accounts & Balances
// ----------------------------------------------------------------------------
export type AccountType = "savings" | "current" | "fixed_deposit" | "domiciliary" | "joint";

export interface Account {
  id: ID;
  userId: ID;
  accountNumber: string; // 10-digit masked display string
  accountType: AccountType;
  nickname?: string;
  currency: string; // ISO 4217
  balance: number;
  availableBalance: number;
  status: "active" | "frozen" | "closed";
  openedAt: ISODate;
  interestRatePct?: number;
}

// ----------------------------------------------------------------------------
// Transactions
// ----------------------------------------------------------------------------
export type TxnType =
  | "credit"
  | "debit"
  | "transfer_in"
  | "transfer_out"
  | "bill_payment"
  | "airtime"
  | "data"
  | "card_payment"
  | "fee"
  | "interest"
  | "salary"
  | "refund"
  | "admin_credit";

export type TxnStatus = "success" | "pending" | "failed" | "reversed";

export interface Transaction {
  id: ID;
  reference: string;
  accountId: ID;
  userId: ID;
  type: TxnType;
  direction: "in" | "out";
  amount: number;
  currency: string;
  description: string;
  counterparty?: string;
  counterpartyAccount?: string;
  counterpartyBank?: string;
  category: string;
  status: TxnStatus;
  fee?: number;
  createdAt: ISODate;
  valueDate?: ISODate;
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Beneficiaries & Transfers
// ----------------------------------------------------------------------------
export type BeneficiaryType = "internal" | "external";

export interface Beneficiary {
  id: ID;
  userId: ID;
  nickname: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode?: string;
  type: BeneficiaryType;
  currency: string;
  createdAt: ISODate;
  lastUsedAt?: ISODate;
  avatarColor?: string;
}

export interface TransferRequest {
  fromAccountId: ID;
  toAccountNumber: string;
  toAccountName: string;
  toBankName: string;
  amount: number;
  currency: string;
  description: string;
  saveBeneficiary: boolean;
  beneficiaryNickname?: string;
  scheduleFor?: ISODate;
}

export interface TransferResult {
  reference: string;
  status: TxnStatus;
  amount: number;
  fee: number;
  totalDebit: number;
  createdAt: ISODate;
  receiptId: ID;
}

// ----------------------------------------------------------------------------
// Cards
// ----------------------------------------------------------------------------
export type CardType = "virtual" | "physical";
export type CardBrand = "visa" | "mastercard" | "verve";
export type CardStatus = "active" | "locked" | "frozen" | "expired" | "blocked";

export interface BankCard {
  id: ID;
  userId: ID;
  accountId: ID;
  type: CardType;
  brand: CardBrand;
  maskedPan: string; // •••• 4321
  expiryMonth: string; // MM
  expiryYear: string; // YY
  cvvMasked: string; // •••
  holderName: string;
  status: CardStatus;
  color: "teal" | "ocean" | "sand" | "graphite";
  dailyLimit: number;
  monthlyLimit: number;
  spendingThisMonth: number;
  onlineEnabled: boolean;
  contactlessEnabled: boolean;
  atmEnabled: boolean;
  posEnabled: boolean;
  createdAt: ISODate;
}

export interface CardTransaction {
  id: ID;
  cardId: ID;
  merchant: string;
  category: string;
  amount: number;
  currency: string;
  status: TxnStatus;
  location?: string;
  createdAt: ISODate;
}

// ----------------------------------------------------------------------------
// Bills & Payments
// ----------------------------------------------------------------------------
export type BillCategory = "airtime" | "data" | "electricity" | "cable_tv" | "internet" | "water" | "betting" | "education";

export interface Biller {
  id: ID;
  category: BillCategory;
  name: string;
  logo?: string;
  fields: BillerField[];
}

export interface BillerField {
  key: string;
  label: string;
  type: "text" | "select" | "tel";
  placeholder?: string;
  options?: string[];
  required: boolean;
}

export interface BillPayment {
  id: ID;
  userId: ID;
  accountId: ID;
  billerId: ID;
  billerName: string;
  category: BillCategory;
  amount: number;
  currency: string;
  customerReference: string;
  status: TxnStatus;
  reference: string;
  createdAt: ISODate;
}

// ----------------------------------------------------------------------------
// Notifications
// ----------------------------------------------------------------------------
export type NotificationType =
  | "transaction"
  | "security"
  | "promo"
  | "system"
  | "support"
  | "card"
  | "transfer";

export interface AppNotification {
  id: ID;
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: ISODate;
  actionUrl?: string;
  actionLabel?: string;
}

export interface NotificationPreferences {
  userId: ID;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  categories: {
    transaction: boolean;
    security: boolean;
    promo: boolean;
    system: boolean;
    support: boolean;
  };
}

// ----------------------------------------------------------------------------
// Customer Support
// ----------------------------------------------------------------------------
export type TicketStatus = "open" | "pending_agent" | "pending_customer" | "escalated" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface SupportTicket {
  id: ID;
  userId: ID;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedAgentId?: ID;
  createdAt: ISODate;
  updatedAt: ISODate;
  unreadByCustomer: boolean;
  unreadByAgent: boolean;
}

export interface ChatMessage {
  id: ID;
  ticketId: ID;
  sender: "customer" | "agent" | "system";
  senderName: string;
  body: string;
  createdAt: ISODate;
  status: "sent" | "delivered" | "read";
}

export interface FAQItem {
  id: ID;
  category: string;
  question: string;
  answer: string;
}

// ----------------------------------------------------------------------------
// Statements
// ----------------------------------------------------------------------------
export interface Statement {
  id: ID;
  userId: ID;
  accountId: ID;
  startDate: ISODate;
  endDate: ISODate;
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  generatedAt: ISODate;
  format: "pdf" | "csv" | "excel";
  downloadUrl?: string;
}

// ----------------------------------------------------------------------------
// Campaigns & Promotions
// ----------------------------------------------------------------------------
export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "ended";

export interface Campaign {
  id: ID;
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  status: CampaignStatus;
  audience: "all" | "premium" | "standard" | "private";
  startsAt: ISODate;
  endsAt: ISODate;
  imageUrl?: string;
  accentColor: string;
  metrics?: {
    impressions: number;
    clicks: number;
    conversions: number;
  };
}

// ----------------------------------------------------------------------------
// Admin — Risk/Fraud
// ----------------------------------------------------------------------------
export type RiskFlag = "high_amount" | "unusual_location" | "velocity" | "new_beneficiary" | "off_hours" | "structured_pattern";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskCase {
  id: ID;
  transactionId: ID;
  userId: ID;
  userName: string;
  amount: number;
  currency: string;
  reason: RiskFlag;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  status: "open" | "reviewing" | "approved" | "blocked" | "escalated";
  assignedTo?: ID;
  createdAt: ISODate;
  notes?: string[];
}

// ----------------------------------------------------------------------------
// Admin — Audit Log
// ----------------------------------------------------------------------------
export interface AuditLogEntry {
  id: ID;
  actorType: "admin" | "system" | "customer";
  actorId: ID;
  actorName: string;
  action: string;
  resource: string;
  resourceId?: ID;
  metadata?: Record<string, unknown>;
  ipAddress: string;
  createdAt: ISODate;
}

// ----------------------------------------------------------------------------
// Admin — Bank Settings
// ----------------------------------------------------------------------------
export interface BankSettings {
  bankName: string;
  bankCode: string;
  swiftCode: string;
  supportEmail: string;
  supportPhone: string;
  baseCurrency: string;
  transferFeeFlat: number;
  transferFeePct: number;
  dailyTransferLimit: number;
  otpExpiryMinutes: number;
  maintenanceMode: boolean;
}

// ----------------------------------------------------------------------------
// Sessions (security centre)
// ----------------------------------------------------------------------------
export interface UserSession {
  id: ID;
  userId: ID;
  device: string;
  browser: string;
  ipAddress: string;
  location: string;
  current: boolean;
  lastActiveAt: ISODate;
}

// ----------------------------------------------------------------------------
// Generic service envelope
// ----------------------------------------------------------------------------
export interface ServiceResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ----------------------------------------------------------------------------
// Admin Credit Account (CP-12)
// ----------------------------------------------------------------------------
// These types are used by the adminService.creditAccount method which calls
// the Cloudflare Worker endpoint POST /api/admin/credit-account.
// The Worker performs the atomic Firestore transaction server-side.

export interface CreditAccountPayload {
  customerId: string;
  accountId: string;
  amount: number;
  currency: string; // "USD" | "EUR" — must match the account's currency
  reason: string;   // 5–200 characters
  reference: string; // unique transaction reference
}

export interface CreditAccountResult {
  transactionId: string;
  newBalance: number;
  newAvailableBalance: number;
  creditedAt: ISODate;
  reference: string;
}

// Account summary returned by the Worker's GET /api/admin/customers/:id/accounts
// endpoint. Used by the Credit Account UI to list a customer's accounts.
export interface AdminAccountSummary {
  id: string;
  accountNumber: string;
  accountType: AccountType;
  currency: string;
  balance: number;
  availableBalance: number;
  status: "active" | "frozen" | "closed";
  nickname?: string;
  openedAt: ISODate;
}
