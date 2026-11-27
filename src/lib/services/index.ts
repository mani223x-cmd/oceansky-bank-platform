// ============================================================================
// OceanSky Bank — Service Layer (Mock Implementation)
// ----------------------------------------------------------------------------
// This is a MOCK service layer. Every method simulates a backend call with a
// small artificial delay and operates on the in-memory mock dataset at
// /src/lib/mock.
//
// REPLACING WITH A REAL BACKEND:
//   Each exported function here corresponds to a future REST/GraphQL endpoint.
//   The function signatures are stable contracts — to swap in a real backend,
//   replace the body of each function with a `fetch("/api/...")` call without
//   touching the calling UI components. See ARCHITECTURE.md for the mapping.
// ============================================================================
import { v4 as uuid } from "uuid";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  MOCK_ACCOUNTS,
  MOCK_ADMIN_USERS,
  MOCK_AUDIT_LOGS,
  MOCK_BANK_SETTINGS,
  MOCK_BENEFICIARIES,
  MOCK_BILL_PAYMENTS,
  MOCK_BILLERS,
  MOCK_CAMPAIGNS,
  MOCK_CARD_TXNS,
  MOCK_CARDS,
  MOCK_CHAT_MESSAGES,
  MOCK_FAQS,
  MOCK_NOTIFICATIONS,
  MOCK_NOTIFICATION_PREFS,
  MOCK_RISK_CASES,
  MOCK_STATEMENTS,
  MOCK_TICKETS,
  MOCK_TRANSACTIONS,
  MOCK_USER_SESSIONS,
  MOCK_USERS,
  nextId,
} from "@/lib/mock";
import type {
  Account,
  AdminUser,
  AppNotification,
  AuditLogEntry,
  BankCard,
  BankSettings,
  Beneficiary,
  BillPayment,
  Biller,
  Campaign,
  CardTransaction,
  ChatMessage,
  CreditAccountPayload,
  CreditAccountResult,
  AdminAccountSummary,
  FAQItem,
  NotificationPreferences,
  RiskCase,
  RiskLevel,
  ServiceResult,
  Statement,
  SupportTicket,
  Transaction,
  TransferRequest,
  TransferResult,
  User,
  UserSession,
} from "@/lib/types";

// In-memory mutable store (so customer/admin actions persist across screens)
const db = {
  users: [...MOCK_USERS],
  accounts: [...MOCK_ACCOUNTS],
  transactions: [...MOCK_TRANSACTIONS],
  beneficiaries: [...MOCK_BENEFICIARIES],
  cards: [...MOCK_CARDS],
  cardTxns: [...MOCK_CARD_TXNS],
  billers: [...MOCK_BILLERS],
  billPayments: [...MOCK_BILL_PAYMENTS],
  notifications: [...MOCK_NOTIFICATIONS],
  notificationPrefs: [...MOCK_NOTIFICATION_PREFS],
  tickets: [...MOCK_TICKETS],
  messages: [...MOCK_CHAT_MESSAGES],
  faqs: [...MOCK_FAQS],
  statements: [...MOCK_STATEMENTS],
  campaigns: [...MOCK_CAMPAIGNS],
  admins: [...MOCK_ADMIN_USERS],
  riskCases: [...MOCK_RISK_CASES],
  auditLogs: [...MOCK_AUDIT_LOGS],
  settings: { ...MOCK_BANK_SETTINGS },
  sessions: [...MOCK_USER_SESSIONS],
};

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}
function err<T>(error: string, code?: string): ServiceResult<T> {
  return { ok: false, error, code };
}

// ----------------------------------------------------------------------------
// AUTH SERVICE
// ----------------------------------------------------------------------------
export const authService = {
  async login(email: string, _password: string): Promise<ServiceResult<{ userId: string; otpRequired: boolean; otpDestination: string; otpChallengeId: string; otpCode: string }>> {
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!user) return err("No account found with this email.", "AUTH_NO_USER");
    if (user.status === "locked") return err("Your account is locked. Please contact support.", "AUTH_LOCKED");
    const challenge = {
      userId: user.id,
      otpRequired: true,
      otpDestination: user.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
      otpChallengeId: nextId("otp"),
      otpCode: String(Math.floor(100000 + Math.random() * 900000)),
    };
    return delay(ok(challenge));
  },

  async verifyOtp(challenge: { userId: string; otpCode: string }): Promise<ServiceResult<{ userId: string; token: string; scope: "customer" }>> {
    const user = db.users.find((u) => u.id === challenge.userId);
    if (!user) return err("Invalid challenge.", "AUTH_INVALID_CHALLENGE");
    if (challenge.otpCode.length !== 6) return err("OTP must be 6 digits.", "AUTH_OTP_LEN");
    // Mock accepts any 6-digit OTP, but for dev we expose the generated code
    // via console for convenience.
    user.lastLoginAt = new Date().toISOString();
    return delay(ok({ userId: user.id, token: `mock_${uuid()}`, scope: "customer" as const }));
  },

  async register(payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<ServiceResult<{ userId: string; otpRequired: boolean; otpDestination: string; otpChallengeId: string; otpCode: string }>> {
    if (db.users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())) {
      return err("An account with this email already exists.", "AUTH_EMAIL_TAKEN");
    }
    const newUser: User = {
      id: nextId("usr"),
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      status: "pending",
      tier: "standard",
      createdAt: new Date().toISOString(),
      kycVerified: false,
      nationality: "United States",
    };
    db.users.push(newUser);
    // Create a starter account
    const account: Account = {
      id: nextId("acc"),
      userId: newUser.id,
      accountNumber: String(Math.floor(1000000000 + Math.random() * 8999999999)),
      accountType: "savings",
      currency: "USD",
      balance: 0,
      availableBalance: 0,
      status: "active",
      openedAt: new Date().toISOString(),
      interestRatePct: 4.0,
    };
    db.accounts.push(account);
    return delay(ok({
      userId: newUser.id,
      otpRequired: true,
      otpDestination: payload.email.replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
      otpChallengeId: nextId("otp"),
      otpCode: String(Math.floor(100000 + Math.random() * 900000)),
    }));
  },

  async forgotPassword(email: string): Promise<ServiceResult<{ sent: boolean; destination: string }>> {
    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const dest = email.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
    if (!user) return delay(ok({ sent: false, destination: dest })); // don't leak existence
    return delay(ok({ sent: true, destination: dest }));
  },

  async adminLogin(email: string, _password: string): Promise<ServiceResult<{ adminId: string; token: string; scope: "admin" }>> {
    const admin = db.admins.find((a) => a.email.toLowerCase() === email.toLowerCase().trim());
    if (!admin) return err("No admin account found.", "ADM_NO_USER");
    if (admin.status !== "active") return err("Admin account suspended.", "ADM_SUSPENDED");
    admin.lastActiveAt = new Date().toISOString();
    return delay(ok({ adminId: admin.id, token: `mock_admin_${uuid()}`, scope: "admin" as const }));
  },

  async logout(): Promise<ServiceResult<{ ok: true }>> {
    return delay(ok({ ok: true as const }));
  },
};

// ----------------------------------------------------------------------------
// USER / PROFILE SERVICE
// ----------------------------------------------------------------------------
export const userService = {
  async getById(id: string): Promise<ServiceResult<User>> {
    const user = db.users.find((u) => u.id === id);
    if (!user) return err("User not found.");
    return delay(ok(user));
  },
  async update(id: string, patch: Partial<User>): Promise<ServiceResult<User>> {
    const user = db.users.find((u) => u.id === id);
    if (!user) return err("User not found.");
    Object.assign(user, patch);
    return delay(ok(user));
  },
  async getSessions(userId: string): Promise<ServiceResult<UserSession[]>> {
    return delay(ok(db.sessions.filter((s) => s.userId === userId)));
  },
  async revokeSession(sessionId: string): Promise<ServiceResult<{ ok: true }>> {
    const idx = db.sessions.findIndex((s) => s.id === sessionId);
    if (idx >= 0) db.sessions.splice(idx, 1);
    return delay(ok({ ok: true as const }));
  },
  async getNotificationPrefs(userId: string): Promise<ServiceResult<NotificationPreferences>> {
    const prefs = db.notificationPrefs.find((p) => p.userId === userId) ?? {
      userId,
      channels: { push: true, email: true, sms: false },
      categories: { transaction: true, security: true, promo: true, system: true, support: true },
    };
    return delay(ok(prefs));
  },
  async updateNotificationPrefs(userId: string, prefs: NotificationPreferences): Promise<ServiceResult<NotificationPreferences>> {
    const idx = db.notificationPrefs.findIndex((p) => p.userId === userId);
    if (idx >= 0) db.notificationPrefs[idx] = prefs;
    else db.notificationPrefs.push(prefs);
    return delay(ok(prefs));
  },
};

// ----------------------------------------------------------------------------
// ACCOUNTS SERVICE
// ----------------------------------------------------------------------------
export const accountService = {
  async listByUser(userId: string): Promise<ServiceResult<Account[]>> {
    return delay(ok(db.accounts.filter((a) => a.userId === userId)));
  },
  async getById(id: string): Promise<ServiceResult<Account>> {
    const acc = db.accounts.find((a) => a.id === id);
    if (!acc) return err("Account not found.");
    return delay(ok(acc));
  },
  async activity(accountId: string, limit = 8): Promise<ServiceResult<Transaction[]>> {
    return delay(ok(
      db.transactions
        .filter((t) => t.accountId === accountId)
        .slice(0, limit)
    ));
  },
};

// ----------------------------------------------------------------------------
// TRANSACTIONS SERVICE
// ----------------------------------------------------------------------------
export const transactionService = {
  async listByUser(userId: string, filters?: {
    accountId?: string;
    type?: string;
    status?: string;
    search?: string;
    from?: string;
    to?: string;
  }): Promise<ServiceResult<Transaction[]>> {
    let items = db.transactions.filter((t) => t.userId === userId);
    if (filters?.accountId) items = items.filter((t) => t.accountId === filters.accountId);
    if (filters?.type && filters.type !== "all") items = items.filter((t) => t.type === filters.type);
    if (filters?.status && filters.status !== "all") items = items.filter((t) => t.status === filters.status);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      items = items.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.counterparty || "").toLowerCase().includes(q)
      );
    }
    if (filters?.from) items = items.filter((t) => new Date(t.createdAt) >= new Date(filters.from!));
    if (filters?.to) items = items.filter((t) => new Date(t.createdAt) <= new Date(filters.to!));
    return delay(ok(items));
  },
  async getById(id: string): Promise<ServiceResult<Transaction>> {
    const t = db.transactions.find((x) => x.id === id);
    if (!t) return err("Transaction not found.");
    return delay(ok(t));
  },
};

// ----------------------------------------------------------------------------
// TRANSFERS SERVICE
// ----------------------------------------------------------------------------
export const transferService = {
  async preview(req: TransferRequest): Promise<ServiceResult<{ fee: number; totalDebit: number; estimatedArrival: string }>> {
    const fee = req.toBankName === "OceanSky Bank"
      ? 0
      : Math.max(52.5, req.amount * db.settings.transferFeePct);
    return delay(ok({
      fee,
      totalDebit: req.amount + fee,
      estimatedArrival: req.toBankName === "OceanSky Bank" ? "Instant" : "Within 10 minutes",
    }));
  },

  async execute(req: TransferRequest, userId: string): Promise<ServiceResult<TransferResult>> {
    const account = db.accounts.find((a) => a.id === req.fromAccountId);
    if (!account) return err("Source account not found.", "TR_NO_SOURCE");
    if (account.status !== "active") return err("Source account is not active.", "TR_ACCOUNT_INACTIVE");
    const fee = req.toBankName === "OceanSky Bank" ? 0 : Math.max(52.5, req.amount * db.settings.transferFeePct);
    const totalDebit = req.amount + fee;
    if (account.availableBalance < totalDebit) {
      return err("Insufficient available balance for this transfer.", "TR_INSUFFICIENT");
    }
    account.balance -= totalDebit;
    account.availableBalance -= totalDebit;

    const reference = `OSB-${String(db.transactions.length + 1).padStart(7, "0")}`;
    const txn: Transaction = {
      id: nextId("txn"),
      reference,
      accountId: account.id,
      userId,
      type: "transfer_out",
      direction: "out",
      amount: req.amount,
      currency: req.currency,
      description: req.description || `Transfer to ${req.toAccountName}`,
      counterparty: req.toAccountName,
      counterpartyAccount: req.toAccountNumber,
      counterpartyBank: req.toBankName,
      category: "transfer",
      status: "success",
      fee,
      createdAt: new Date().toISOString(),
    };
    db.transactions.unshift(txn);

    if (req.saveBeneficiary && req.beneficiaryNickname) {
      const beneficiary: Beneficiary = {
        id: nextId("ben"),
        userId,
        nickname: req.beneficiaryNickname,
        accountName: req.toAccountName,
        accountNumber: req.toAccountNumber,
        bankName: req.toBankName,
        type: req.toBankName === "OceanSky Bank" ? "internal" : "external",
        currency: req.currency,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        avatarColor: "teal",
      };
      db.beneficiaries.push(beneficiary);
    }

    return delay(ok({
      reference,
      status: "success",
      amount: req.amount,
      fee,
      totalDebit,
      createdAt: txn.createdAt,
      receiptId: `rct_${txn.id}`,
    }));
  },
};

// ----------------------------------------------------------------------------
// BENEFICIARIES SERVICE
// ----------------------------------------------------------------------------
export const beneficiaryService = {
  async listByUser(userId: string): Promise<ServiceResult<Beneficiary[]>> {
    return delay(ok(db.beneficiaries.filter((b) => b.userId === userId)));
  },
  async create(b: Omit<Beneficiary, "id" | "createdAt">): Promise<ServiceResult<Beneficiary>> {
    const ben: Beneficiary = { ...b, id: nextId("ben"), createdAt: new Date().toISOString() };
    db.beneficiaries.push(ben);
    return delay(ok(ben));
  },
  async remove(id: string): Promise<ServiceResult<{ ok: true }>> {
    const idx = db.beneficiaries.findIndex((b) => b.id === id);
    if (idx >= 0) db.beneficiaries.splice(idx, 1);
    return delay(ok({ ok: true as const }));
  },
};

// ----------------------------------------------------------------------------
// CARDS SERVICE
// ----------------------------------------------------------------------------
export const cardService = {
  async listByUser(userId: string): Promise<ServiceResult<BankCard[]>> {
    return delay(ok(db.cards.filter((c) => c.userId === userId)));
  },
  async getById(id: string): Promise<ServiceResult<BankCard>> {
    const c = db.cards.find((x) => x.id === id);
    if (!c) return err("Card not found.");
    return delay(ok(c));
  },
  async toggleLock(id: string, lock: boolean): Promise<ServiceResult<BankCard>> {
    const c = db.cards.find((x) => x.id === id);
    if (!c) return err("Card not found.");
    c.status = lock ? "locked" : "active";
    c.onlineEnabled = !lock;
    c.contactlessEnabled = !lock;
    c.atmEnabled = !lock;
    c.posEnabled = !lock;
    return delay(ok(c));
  },
  async updateLimits(id: string, daily: number, monthly: number): Promise<ServiceResult<BankCard>> {
    const c = db.cards.find((x) => x.id === id);
    if (!c) return err("Card not found.");
    c.dailyLimit = daily;
    c.monthlyLimit = monthly;
    return delay(ok(c));
  },
  async toggleChannel(id: string, channel: "online" | "contactless" | "atm" | "pos", enabled: boolean): Promise<ServiceResult<BankCard>> {
    const c = db.cards.find((x) => x.id === id);
    if (!c) return err("Card not found.");
    if (channel === "online") c.onlineEnabled = enabled;
    if (channel === "contactless") c.contactlessEnabled = enabled;
    if (channel === "atm") c.atmEnabled = enabled;
    if (channel === "pos") c.posEnabled = enabled;
    return delay(ok(c));
  },
  async transactions(cardId: string): Promise<ServiceResult<CardTransaction[]>> {
    return delay(ok(db.cardTxns.filter((t) => t.cardId === cardId)));
  },
};

// ----------------------------------------------------------------------------
// BILLS SERVICE
// ----------------------------------------------------------------------------
export const billService = {
  async listBillers(category?: string): Promise<ServiceResult<Biller[]>> {
    let list = db.billers;
    if (category && category !== "all") list = list.filter((b) => b.category === category);
    return delay(ok(list));
  },
  async getBiller(id: string): Promise<ServiceResult<Biller>> {
    const b = db.billers.find((x) => x.id === id);
    if (!b) return err("Biller not found.");
    return delay(ok(b));
  },
  async payBill(payload: {
    userId: string;
    accountId: string;
    billerId: string;
    amount: number;
    customerReference: string;
  }): Promise<ServiceResult<BillPayment>> {
    const account = db.accounts.find((a) => a.id === payload.accountId);
    if (!account) return err("Account not found.");
    if (account.availableBalance < payload.amount) return err("Insufficient balance.");
    const biller = db.billers.find((b) => b.id === payload.billerId)!;
    account.balance -= payload.amount;
    account.availableBalance -= payload.amount;
    const reference = `BLP-${String(700_000 + db.billPayments.length + 1)}`;
    const payment: BillPayment = {
      id: nextId("blp"),
      userId: payload.userId,
      accountId: payload.accountId,
      billerId: payload.billerId,
      billerName: biller.name,
      category: biller.category,
      amount: payload.amount,
      currency: account.currency,
      customerReference: payload.customerReference,
      status: "success",
      reference,
      createdAt: new Date().toISOString(),
    };
    db.billPayments.unshift(payment);
    db.transactions.unshift({
      id: nextId("txn"),
      reference,
      accountId: account.id,
      userId: payload.userId,
      type: biller.category === "airtime" ? "airtime" : biller.category === "data" ? "data" : "bill_payment",
      direction: "out",
      amount: payload.amount,
      currency: account.currency,
      description: `${biller.name} — ${payload.customerReference}`,
      counterparty: biller.name,
      category: biller.category,
      status: "success",
      fee: 0,
      createdAt: new Date().toISOString(),
    });
    return delay(ok(payment));
  },
  async listPayments(userId: string): Promise<ServiceResult<BillPayment[]>> {
    return delay(ok(db.billPayments.filter((p) => p.userId === userId)));
  },
};

// ----------------------------------------------------------------------------
// NOTIFICATIONS SERVICE
// ----------------------------------------------------------------------------
export const notificationService = {
  async listByUser(userId: string): Promise<ServiceResult<AppNotification[]>> {
    return delay(ok(db.notifications.filter((n) => n.userId === userId)));
  },
  async markRead(id: string): Promise<ServiceResult<{ ok: true }>> {
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    return delay(ok({ ok: true as const }), 80);
  },
  async markAllRead(userId: string): Promise<ServiceResult<{ ok: true }>> {
    db.notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
    return delay(ok({ ok: true as const }), 150);
  },
};

// ----------------------------------------------------------------------------
// SUPPORT SERVICE
// ----------------------------------------------------------------------------
export const supportService = {
  async listTicketsByUser(userId: string): Promise<ServiceResult<SupportTicket[]>> {
    return delay(ok(db.tickets.filter((t) => t.userId === userId)));
  },
  async getTicket(id: string): Promise<ServiceResult<SupportTicket>> {
    const t = db.tickets.find((x) => x.id === id);
    if (!t) return err("Ticket not found.");
    return delay(ok(t));
  },
  async listMessages(ticketId: string): Promise<ServiceResult<ChatMessage[]>> {
    return delay(ok(db.messages.filter((m) => m.ticketId === ticketId)));
  },
  async sendMessage(ticketId: string, body: string, sender: "customer" | "agent" | "system", senderName: string): Promise<ServiceResult<ChatMessage>> {
    const msg: ChatMessage = {
      id: nextId("msg"),
      ticketId,
      sender,
      senderName,
      body,
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    db.messages.push(msg);
    const ticket = db.tickets.find((t) => t.id === ticketId);
    if (ticket) {
      ticket.updatedAt = msg.createdAt;
      if (sender === "customer") {
        ticket.status = "pending_agent";
        ticket.unreadByAgent = true;
        ticket.unreadByCustomer = false;
      } else if (sender === "agent") {
        ticket.status = "pending_customer";
        ticket.unreadByCustomer = true;
        ticket.unreadByAgent = false;
      }
    }
    return delay(ok(msg), 200);
  },
  async createTicket(payload: { userId: string; subject: string; category: string; priority?: "low" | "medium" | "high" }): Promise<ServiceResult<SupportTicket>> {
    const ticket: SupportTicket = {
      id: nextId("tkt"),
      userId: payload.userId,
      subject: payload.subject,
      category: payload.category,
      status: "open",
      priority: payload.priority || "medium",
      assignedAgentId: db.admins.find((a) => a.role === "support_agent")?.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unreadByAgent: true,
      unreadByCustomer: false,
    };
    db.tickets.unshift(ticket);
    // Auto greeting message
    db.messages.push({
      id: nextId("msg"),
      ticketId: ticket.id,
      sender: "system",
      senderName: "OceanSky Support",
      body: `Thank you for contacting OceanSky Support. Your ticket has been created. An agent will respond shortly.`,
      createdAt: new Date().toISOString(),
      status: "delivered",
    });
    return delay(ok(ticket));
  },
  async listFAQs(): Promise<ServiceResult<FAQItem[]>> {
    return delay(ok(db.faqs));
  },
  async escalate(ticketId: string, reason: string): Promise<ServiceResult<SupportTicket>> {
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) return err("Ticket not found.");
    t.status = "escalated";
    t.priority = "high";
    t.updatedAt = new Date().toISOString();
    db.messages.push({
      id: nextId("msg"),
      ticketId,
      sender: "system",
      senderName: "OceanSky Support",
      body: `Ticket escalated. Reason: ${reason}. A senior agent will take over shortly.`,
      createdAt: new Date().toISOString(),
      status: "delivered",
    });
    return delay(ok(t));
  },
  // ---- Admin side ----
  async listAllTickets(): Promise<ServiceResult<SupportTicket[]>> {
    return delay(ok(db.tickets));
  },
  async assignTicket(ticketId: string, agentId: string): Promise<ServiceResult<SupportTicket>> {
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) return err("Ticket not found.");
    t.assignedAgentId = agentId;
    t.status = "pending_agent";
    t.updatedAt = new Date().toISOString();
    return delay(ok(t));
  },
  async resolveTicket(ticketId: string): Promise<ServiceResult<SupportTicket>> {
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) return err("Ticket not found.");
    t.status = "resolved";
    t.updatedAt = new Date().toISOString();
    t.unreadByCustomer = true;
    return delay(ok(t));
  },
};

// ----------------------------------------------------------------------------
// STATEMENTS SERVICE
// ----------------------------------------------------------------------------
export const statementService = {
  async listByUser(userId: string): Promise<ServiceResult<Statement[]>> {
    return delay(ok(db.statements.filter((s) => s.userId === userId)));
  },
  async generate(payload: {
    userId: string;
    accountId: string;
    startDate: string;
    endDate: string;
    format: "pdf" | "csv" | "excel";
  }): Promise<ServiceResult<Statement>> {
    const acc = db.accounts.find((a) => a.id === payload.accountId);
    if (!acc) return err("Account not found.");
    const txns = db.transactions.filter((t) => t.accountId === payload.accountId);
    const inRange = txns.filter((t) => {
      const d = new Date(t.createdAt);
      return d >= new Date(payload.startDate) && d <= new Date(payload.endDate);
    });
    const credits = inRange.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
    const debits = inRange.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
    const stmt: Statement = {
      id: nextId("stmt"),
      userId: payload.userId,
      accountId: payload.accountId,
      startDate: payload.startDate,
      endDate: payload.endDate,
      openingBalance: acc.balance - credits + debits,
      closingBalance: acc.balance,
      totalCredits: credits,
      totalDebits: debits,
      transactionCount: inRange.length,
      generatedAt: new Date().toISOString(),
      format: payload.format,
      downloadUrl: `mock://statements/${payload.format}`,
    };
    db.statements.unshift(stmt);
    return delay(ok(stmt), 700);
  },
};

// ----------------------------------------------------------------------------
// CAMPAIGNS SERVICE (customer-facing)
// ----------------------------------------------------------------------------
export const campaignService = {
  async listForUser(userTier: "standard" | "premium" | "private"): Promise<ServiceResult<Campaign[]>> {
    const now = new Date();
    const list = db.campaigns.filter((c) => {
      if (c.status !== "active" && c.status !== "scheduled") return false;
      if (c.audience !== "all" && c.audience !== userTier) return false;
      return new Date(c.startsAt) <= now && new Date(c.endsAt) >= now;
    });
    return delay(ok(list));
  },
};

// ----------------------------------------------------------------------------
// ADMIN SERVICES
// ----------------------------------------------------------------------------
export const adminService = {
  async dashboardStats(): Promise<ServiceResult<{
    totalCustomers: number;
    activeAccounts: number;
    totalTransactions: number;
    transactionVolume: number;
    openTickets: number;
    openRiskCases: number;
    newSignups7d: number;
    netVolume7d: { date: string; volume: number; txns: number }[];
    customerGrowth: { date: string; count: number }[];
    accountDistribution: { type: string; count: number; value: number }[];
  }>> {
    const totalCustomers = db.users.length;
    const activeAccounts = db.accounts.filter((a) => a.status === "active").length;
    const totalTransactions = db.transactions.length;
    const transactionVolume = db.transactions
      .filter((t) => t.status === "success")
      .reduce((s, t) => s + t.amount, 0);
    const openTickets = db.tickets.filter((t) => ["open", "pending_agent", "pending_customer", "escalated"].includes(t.status)).length;
    const openRiskCases = db.riskCases.filter((r) => ["open", "reviewing", "escalated"].includes(r.status)).length;
    const netVolume7d = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(Date.now() - (6 - i) * 86400_000);
      return {
        date: date.toISOString().slice(0, 10),
        volume: 4_000_000 + Math.floor(Math.random() * 3_500_000),
        txns: 180 + Math.floor(Math.random() * 80),
      };
    });
    const customerGrowth = Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(Date.now() - (6 - i) * 86400_000);
      return {
        date: date.toISOString().slice(0, 10),
        count: totalCustomers - (6 - i) + Math.floor(Math.random() * 4),
      };
    });
    const accountDistribution = ["savings", "current", "fixed_deposit", "domiciliary"].map((type) => {
      const accs = db.accounts.filter((a) => a.accountType === type);
      return { type, count: accs.length, value: accs.reduce((s, a) => s + a.balance, 0) };
    });
    return delay(ok({
      totalCustomers,
      activeAccounts,
      totalTransactions,
      transactionVolume,
      openTickets,
      openRiskCases,
      newSignups7d: 12,
      netVolume7d,
      customerGrowth,
      accountDistribution,
    }));
  },
  async listCustomers(): Promise<ServiceResult<Array<User & { accountCount: number; totalBalance: number; lastLoginAt?: string }>>> {
    const rows = db.users.map((u) => {
      const accs = db.accounts.filter((a) => a.userId === u.id);
      return {
        ...u,
        accountCount: accs.length,
        totalBalance: accs.reduce((s, a) => s + a.balance, 0),
        lastLoginAt: u.lastLoginAt,
      };
    });
    return delay(ok(rows));
  },
  async getCustomer(id: string): Promise<ServiceResult<{
    user: User;
    accounts: Account[];
    recentTransactions: Transaction[];
    cards: BankCard[];
    tickets: SupportTicket[];
  }>> {
    const user = db.users.find((u) => u.id === id);
    if (!user) return err("Customer not found.");
    const accounts = db.accounts.filter((a) => a.userId === id);
    const recentTransactions = db.transactions.filter((t) => t.userId === id).slice(0, 10);
    const cards = db.cards.filter((c) => c.userId === id);
    const tickets = db.tickets.filter((t) => t.userId === id);
    return delay(ok({ user, accounts, recentTransactions, cards, tickets }));
  },
  async toggleCustomerStatus(id: string, status: User["status"]): Promise<ServiceResult<User>> {
    const u = db.users.find((x) => x.id === id);
    if (!u) return err("Customer not found.");
    u.status = status;
    return delay(ok(u));
  },
  async listAccounts(): Promise<ServiceResult<Array<Account & { userName: string }>>> {
    return delay(ok(db.accounts.map((a) => ({
      ...a,
      userName: db.users.find((u) => u.id === a.userId)?.lastName + " " + db.users.find((u) => u.id === a.userId)?.firstName,
    }))));
  },
  async listTransactions(): Promise<ServiceResult<Array<Transaction & { userName: string }>>> {
    return delay(ok(db.transactions.slice(0, 60).map((t) => ({
      ...t,
      userName: (() => {
        const u = db.users.find((x) => x.id === t.userId);
        return u ? `${u.firstName} ${u.lastName}` : "Unknown";
      })(),
    }))));
  },
  async listCards(): Promise<ServiceResult<Array<BankCard & { userName: string; accountNumber: string }>>> {
    return delay(ok(db.cards.map((c) => ({
      ...c,
      userName: (() => {
        const u = db.users.find((x) => x.id === c.userId);
        return u ? `${u.firstName} ${u.lastName}` : "Unknown";
      })(),
      accountNumber: db.accounts.find((a) => a.id === c.accountId)?.accountNumber || "—",
    }))));
  },
  async listRiskCases(): Promise<ServiceResult<RiskCase[]>> {
    return delay(ok(db.riskCases));
  },
  async resolveRiskCase(id: string, action: "approved" | "blocked", note?: string): Promise<ServiceResult<RiskCase>> {
    const r = db.riskCases.find((x) => x.id === id);
    if (!r) return err("Risk case not found.");
    r.status = action;
    if (note) r.notes = [...(r.notes || []), note];
    db.auditLogs.unshift({
      id: nextId("aud"),
      actorType: "admin",
      actorId: "adm_001",
      actorName: "Daniel Okoro",
      action: action === "approved" ? "Approved risk-flagged transaction" : "Blocked risk-flagged transaction",
      resource: "risk_case",
      resourceId: id,
      metadata: { note, riskScore: r.riskScore },
      ipAddress: "10.20.30.40",
      createdAt: new Date().toISOString(),
    });
    return delay(ok(r));
  },
  async listAuditLogs(): Promise<ServiceResult<AuditLogEntry[]>> {
    return delay(ok(db.auditLogs));
  },
  async listStaff(): Promise<ServiceResult<AdminUser[]>> {
    return delay(ok(db.admins));
  },
  async createCampaign(payload: Omit<Campaign, "id">): Promise<ServiceResult<Campaign>> {
    const c: Campaign = { ...payload, id: nextId("cmp") };
    db.campaigns.unshift(c);
    db.auditLogs.unshift({
      id: nextId("aud"),
      actorType: "admin",
      actorId: "adm_001",
      actorName: "Daniel Okoro",
      action: "Created campaign",
      resource: "campaign",
      resourceId: c.id,
      metadata: { title: c.title },
      ipAddress: "10.20.30.40",
      createdAt: new Date().toISOString(),
    });
    return delay(ok(c));
  },
  async updateCampaign(id: string, patch: Partial<Campaign>): Promise<ServiceResult<Campaign>> {
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) return err("Campaign not found.");
    Object.assign(c, patch);
    return delay(ok(c));
  },
  async listCampaigns(): Promise<ServiceResult<Campaign[]>> {
    return delay(ok(db.campaigns));
  },
  async deleteCampaign(id: string): Promise<ServiceResult<{ ok: true }>> {
    const idx = db.campaigns.findIndex((x) => x.id === id);
    if (idx >= 0) db.campaigns.splice(idx, 1);
    return delay(ok({ ok: true as const }));
  },
  async broadcastNotification(payload: { title: string; body: string; type: "transaction" | "security" | "promo" | "system" | "support" | "card" | "transfer"; audience: "all" | "premium" | "standard" | "private" }): Promise<ServiceResult<{ sent: number }>> {
    const targets = payload.audience === "all" ? db.users : db.users.filter((u) => u.tier === payload.audience);
    targets.forEach((u) => {
      db.notifications.unshift({
        id: nextId("ntf"),
        userId: u.id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        read: false,
        createdAt: new Date().toISOString(),
      });
    });
    db.auditLogs.unshift({
      id: nextId("aud"),
      actorType: "admin",
      actorId: "adm_001",
      actorName: "Daniel Okoro",
      action: "Broadcast notification",
      resource: "notifications",
      metadata: { audience: payload.audience, count: targets.length },
      ipAddress: "10.20.30.40",
      createdAt: new Date().toISOString(),
    });
    return delay(ok({ sent: targets.length }));
  },
  async getBankSettings(): Promise<ServiceResult<BankSettings>> {
    return delay(ok(db.settings));
  },
  async updateBankSettings(patch: Partial<BankSettings>): Promise<ServiceResult<BankSettings>> {
    Object.assign(db.settings, patch);
    db.auditLogs.unshift({
      id: nextId("aud"),
      actorType: "admin",
      actorId: "adm_001",
      actorName: "Daniel Okoro",
      action: "Updated bank settings",
      resource: "bank_settings",
      metadata: patch,
      ipAddress: "10.20.30.40",
      createdAt: new Date().toISOString(),
    });
    return delay(ok(db.settings));
  },

  // --------------------------------------------------------------------------
  // CP-12: Admin Credit Account
  // --------------------------------------------------------------------------
  // These methods call the Cloudflare Worker (POST /api/admin/credit-account
  // and GET /api/admin/customers/:id/accounts). The Worker verifies the
  // Firebase ID token, checks the admin custom claim, and performs the atomic
  // Firestore transaction server-side.
  //
  // DEPENDENCY: These methods require:
  //   1. NEXT_PUBLIC_WORKER_URL to be set in Vercel env vars.
  //   2. A real Firebase ID token in useAuthStore.adminToken (set by CP-3
  //      Firebase Auth integration — not yet implemented in the frontend).
  //
  // If either is missing, the methods return a clear error. No fake success.
  // --------------------------------------------------------------------------

  async creditAccount(payload: CreditAccountPayload): Promise<ServiceResult<CreditAccountResult>> {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL;
    if (!workerUrl) {
      return err(
        "The secure processing service is not configured. Set NEXT_PUBLIC_WORKER_URL in the environment variables.",
        "SERVICE_NOT_CONFIGURED"
      );
    }

    // The admin token must be a real Firebase ID token. Currently the auth
    // store holds a mock token — the Worker will reject it. This is the
    // correct behavior: the Worker is the security boundary.
    const adminToken = useAuthStore.getState().adminToken;
    if (!adminToken) {
      return err(
        "Administrator authentication is required for this operation.",
        "AUTH_NOT_READY"
      );
    }

    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await fetch(`${workerUrl}/api/admin/credit-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      return result as ServiceResult<CreditAccountResult>;
    } catch {
      return err(
        "Unable to reach the secure processing service. Please try again.",
        "NETWORK_ERROR"
      );
    }
  },

  async listCustomerAccounts(customerId: string): Promise<ServiceResult<AdminAccountSummary[]>> {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL;
    if (!workerUrl) {
      return err(
        "The secure processing service is not configured.",
        "SERVICE_NOT_CONFIGURED"
      );
    }

    const adminToken = useAuthStore.getState().adminToken;
    if (!adminToken) {
      return err(
        "Administrator authentication is required.",
        "AUTH_NOT_READY"
      );
    }

    try {
      const res = await fetch(
        `${workerUrl}/api/admin/customers/${encodeURIComponent(customerId)}/accounts`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      const result = await res.json();
      return result as ServiceResult<AdminAccountSummary[]>;
    } catch {
      return err(
        "Unable to reach the secure processing service.",
        "NETWORK_ERROR"
      );
    }
  },
};

// Aggregate export
export const services = {
  auth: authService,
  user: userService,
  account: accountService,
  transaction: transactionService,
  transfer: transferService,
  beneficiary: beneficiaryService,
  card: cardService,
  bill: billService,
  notification: notificationService,
  support: supportService,
  statement: statementService,
  campaign: campaignService,
  admin: adminService,
};

export type { RiskLevel };
