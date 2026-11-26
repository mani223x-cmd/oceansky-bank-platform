// ============================================================================
// OceanSky Bank — Mock Data Seed
// ----------------------------------------------------------------------------
// All data below is fictional. Names, account numbers, cards, transactions,
// merchants and balances are generated for the application's internal
// simulated service layer only. No real banking data is used.
// ============================================================================
import { v4 as uuid } from "uuid";
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
  FAQItem,
  NotificationPreferences,
  RiskCase,
  Statement,
  SupportTicket,
  Transaction,
  User,
  UserSession,
} from "@/lib/types";

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400_000).toISOString();
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600_000).toISOString();
const minsAgo = (n: number) => new Date(now.getTime() - n * 60_000).toISOString();

// ----------------------------------------------------------------------------
// Customer users
// ----------------------------------------------------------------------------
export const MOCK_USERS: User[] = [
  {
    id: "usr_001",
    firstName: "Olivia",
    lastName: "Bennett",
    email: "olivia.bennett@oceansky.bank",
    phone: "+1 (415) 555-0182",
    status: "active",
    tier: "premium",
    createdAt: daysAgo(420),
    lastLoginAt: minsAgo(8),
    kycVerified: true,
    nationality: "United States",
    occupation: "Software Engineer",
    address: {
      line1: "1200 Market Street",
      line2: "Apt 4B",
      city: "San Francisco",
      state: "CA",
      postalCode: "94102",
      country: "United States",
    },
  },
  {
    id: "usr_002",
    firstName: "Marcus",
    lastName: "Reed",
    email: "marcus.reed@oceansky.bank",
    phone: "+1 (212) 555-0143",
    status: "active",
    tier: "standard",
    createdAt: daysAgo(220),
    lastLoginAt: hoursAgo(3),
    kycVerified: true,
    nationality: "United States",
    occupation: "Operations Manager",
    address: {
      line1: "350 Fifth Avenue",
      city: "New York",
      state: "NY",
      postalCode: "10118",
      country: "United States",
    },
  },
  {
    id: "usr_003",
    firstName: "Sophia",
    lastName: "Chen",
    email: "sophia.chen@oceansky.bank",
    phone: "+1 (312) 555-0177",
    status: "active",
    tier: "private",
    createdAt: daysAgo(720),
    lastLoginAt: hoursAgo(20),
    kycVerified: true,
    nationality: "United States",
    occupation: "Physician",
    address: {
      line1: "875 North Michigan Avenue",
      city: "Chicago",
      state: "IL",
      postalCode: "60611",
      country: "United States",
    },
  },
  {
    id: "usr_004",
    firstName: "Daniel",
    lastName: "Foster",
    email: "daniel.foster@oceansky.bank",
    phone: "+1 (206) 555-0198",
    status: "pending",
    tier: "standard",
    createdAt: daysAgo(2),
    kycVerified: false,
    nationality: "United States",
    occupation: "Graduate Student",
    address: {
      line1: "400 Pine Street",
      city: "Seattle",
      state: "WA",
      postalCode: "98101",
      country: "United States",
    },
  },
];

// ----------------------------------------------------------------------------
// Accounts (each customer has at least one account)
// ----------------------------------------------------------------------------
export const MOCK_ACCOUNTS: Account[] = [
  {
    id: "acc_001",
    userId: "usr_001",
    accountNumber: "0123456789",
    accountType: "savings",
    nickname: "Everyday Savings",
    currency: "USD",
    balance: 24_532.80,
    availableBalance: 24_482.80,
    status: "active",
    openedAt: daysAgo(420),
    interestRatePct: 4.5,
  },
  {
    id: "acc_002",
    userId: "usr_001",
    accountNumber: "0123456790",
    accountType: "checking",
    nickname: "Salary Checking",
    currency: "USD",
    balance: 18_729.00,
    availableBalance: 18_729.00,
    status: "active",
    openedAt: daysAgo(380),
  },
  {
    id: "acc_003",
    userId: "usr_001",
    accountNumber: "0123456791",
    accountType: "domiciliary",
    nickname: "EUR Domiciliary",
    currency: "EUR",
    balance: 4_820.00,
    availableBalance: 4_820.00,
    status: "active",
    openedAt: daysAgo(180),
  },
  {
    id: "acc_004",
    userId: "usr_002",
    accountNumber: "0987654321",
    accountType: "savings",
    currency: "USD",
    balance: 2_864.00,
    availableBalance: 2_814.00,
    status: "active",
    openedAt: daysAgo(220),
    interestRatePct: 4.0,
  },
  {
    id: "acc_005",
    userId: "usr_002",
    accountNumber: "0987654322",
    accountType: "checking",
    currency: "USD",
    balance: 1_205.00,
    availableBalance: 1_205.00,
    status: "active",
    openedAt: daysAgo(120),
  },
  {
    id: "acc_006",
    userId: "usr_003",
    accountNumber: "0555112233",
    accountType: "savings",
    currency: "USD",
    balance: 182_400.00,
    availableBalance: 182_200.00,
    status: "active",
    openedAt: daysAgo(720),
    interestRatePct: 6.0,
  },
  {
    id: "acc_007",
    userId: "usr_003",
    accountNumber: "0555112234",
    accountType: "fixed_deposit",
    nickname: "12-Month CD",
    currency: "USD",
    balance: 100_000.00,
    availableBalance: 0,
    status: "active",
    openedAt: daysAgo(300),
    interestRatePct: 9.5,
  },
];

// ----------------------------------------------------------------------------
// Transactions — generated across all accounts
// ----------------------------------------------------------------------------
const merchants = [
  "Whole Foods Market", "Amazon", "Target", "Chevron", "Shell",
  "Chipotle", "Uber", "Lyft", "Netflix", "Comcast", "Internal Transfer",
  "Payroll — TechFlow Inc.", "Amazon Web Services", "Google Workspace", "Notion Labs",
  "Blue Bottle Coffee", "AMC Theatres", "Marriott", "Sweetgreen",
  "Best Buy", "Apple Store", "Microsoft 365", "iCloud Storage", "Spotify",
];

const categories = ["groceries", "transport", "subscriptions", "dining", "shopping", "payroll", "utilities", "transfer", "entertainment"];

function makeTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  let idx = 0;
  for (const acc of MOCK_ACCOUNTS) {
    const user = MOCK_USERS.find((u) => u.id === acc.userId)!;
    const count = acc.accountType === "fixed_deposit" ? 3 : 28 + Math.floor(Math.random() * 12);
    for (let i = 0; i < count; i++) {
      const isCredit = Math.random() > 0.65;
      const amount =
        isCredit
          ? 500 + Math.floor(Math.random() * 12_000)
          : 15 + Math.floor(Math.random() * 1_800);
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const isPayroll = merchant.includes("Payroll");
      const type = isPayroll ? "salary" : isCredit ? "transfer_in" : "card_payment";
      txns.push({
        id: `txn_${String(idx).padStart(5, "0")}`,
        reference: `OSB-${String(idx).padStart(7, "0")}-${acc.accountNumber.slice(-4)}`,
        accountId: acc.id,
        userId: user.id,
        type,
        direction: isCredit ? "in" : "out",
        amount,
        currency: acc.currency,
        description: isPayroll ? "Bi-weekly payroll — TechFlow Inc." : merchant,
        counterparty: isCredit ? "TechFlow Inc. Payroll" : merchant,
        category,
        status: Math.random() > 0.96 ? "pending" : "success",
        fee: isCredit ? 0 : Math.random() > 0.7 ? 2.50 : 0,
        createdAt: daysAgo(Math.floor(Math.random() * 90)),
        valueDate: daysAgo(Math.floor(Math.random() * 90)),
      });
      idx++;
    }
  }
  return txns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const MOCK_TRANSACTIONS: Transaction[] = makeTransactions();

// ----------------------------------------------------------------------------
// Beneficiaries
// ----------------------------------------------------------------------------
export const MOCK_BENEFICIARIES: Beneficiary[] = [
  {
    id: "ben_001",
    userId: "usr_001",
    nickname: "Mom",
    accountName: "Patricia Bennett",
    accountNumber: "8821459003",
    bankName: "OceanSky Bank",
    type: "internal",
    currency: "USD",
    createdAt: daysAgo(120),
    lastUsedAt: daysAgo(5),
    avatarColor: "teal",
  },
  {
    id: "ben_002",
    userId: "usr_001",
    nickname: "Landlord — SF",
    accountName: "Market Street Properties LLC",
    accountNumber: "7799112233",
    bankName: "Chase",
    bankCode: "021000021",
    type: "external",
    currency: "USD",
    createdAt: daysAgo(80),
    lastUsedAt: daysAgo(2),
    avatarColor: "ocean",
  },
  {
    id: "ben_003",
    userId: "usr_001",
    nickname: "Alex Freelance",
    accountName: "Alex Ramirez",
    accountNumber: "6612345500",
    bankName: "Bank of America",
    bankCode: "026009593",
    type: "external",
    currency: "USD",
    createdAt: daysAgo(30),
    lastUsedAt: daysAgo(7),
    avatarColor: "sand",
  },
  {
    id: "ben_004",
    userId: "usr_002",
    nickname: "Spouse — Savings",
    accountName: "Emma Reed",
    accountNumber: "0987654321",
    bankName: "OceanSky Bank",
    type: "internal",
    currency: "USD",
    createdAt: daysAgo(60),
    lastUsedAt: daysAgo(1),
    avatarColor: "teal",
  },
];

// ----------------------------------------------------------------------------
// Cards
// ----------------------------------------------------------------------------
export const MOCK_CARDS: BankCard[] = [
  {
    id: "card_001",
    userId: "usr_001",
    accountId: "acc_001",
    type: "physical",
    brand: "mastercard",
    maskedPan: "•••• •••• •••• 4321",
    expiryMonth: "08",
    expiryYear: "28",
    cvvMasked: "•••",
    holderName: "OLIVIA BENNETT",
    status: "active",
    color: "teal",
    dailyLimit: 5_000,
    monthlyLimit: 30_000,
    spendingThisMonth: 4_125,
    onlineEnabled: true,
    contactlessEnabled: true,
    atmEnabled: true,
    posEnabled: true,
    createdAt: daysAgo(420),
  },
  {
    id: "card_002",
    userId: "usr_001",
    accountId: "acc_002",
    type: "virtual",
    brand: "visa",
    maskedPan: "•••• •••• •••• 7788",
    expiryMonth: "11",
    expiryYear: "27",
    cvvMasked: "•••",
    holderName: "OLIVIA BENNETT",
    status: "active",
    color: "ocean",
    dailyLimit: 2_000,
    monthlyLimit: 10_000,
    spendingThisMonth: 884,
    onlineEnabled: true,
    contactlessEnabled: false,
    atmEnabled: false,
    posEnabled: true,
    createdAt: daysAgo(120),
  },
  {
    id: "card_003",
    userId: "usr_002",
    accountId: "acc_004",
    type: "physical",
    brand: "visa",
    maskedPan: "•••• •••• •••• 1234",
    expiryMonth: "03",
    expiryYear: "29",
    cvvMasked: "•••",
    holderName: "MARCUS REED",
    status: "active",
    color: "sand",
    dailyLimit: 1_500,
    monthlyLimit: 8_000,
    spendingThisMonth: 1_420,
    onlineEnabled: true,
    contactlessEnabled: true,
    atmEnabled: true,
    posEnabled: true,
    createdAt: daysAgo(220),
  },
  {
    id: "card_004",
    userId: "usr_003",
    accountId: "acc_006",
    type: "physical",
    brand: "mastercard",
    maskedPan: "•••• •••• •••• 9090",
    expiryMonth: "07",
    expiryYear: "30",
    cvvMasked: "•••",
    holderName: "SOPHIA CHEN",
    status: "locked",
    color: "graphite",
    dailyLimit: 10_000,
    monthlyLimit: 80_000,
    spendingThisMonth: 12_400,
    onlineEnabled: false,
    contactlessEnabled: false,
    atmEnabled: false,
    posEnabled: false,
    createdAt: daysAgo(500),
  },
];

export const MOCK_CARD_TXNS: CardTransaction[] = MOCK_CARDS.flatMap((card) => {
  const samples = [
    { merchant: "Whole Foods Market", category: "groceries", amount: 234.00, location: "San Francisco, CA" },
    { merchant: "Netflix", category: "subscriptions", amount: 22.99, location: "Online" },
    { merchant: "Chevron", category: "transport", amount: 65.00, location: "San Francisco, CA" },
    { merchant: "Amazon Web Services", category: "subscriptions", amount: 184.00, location: "Online" },
    { merchant: "Sweetgreen", category: "dining", amount: 18.50, location: "San Francisco, CA" },
    { merchant: "Uber", category: "transport", amount: 24.20, location: "San Francisco, CA" },
    { merchant: "iCloud Storage", category: "subscriptions", amount: 9.99, location: "Online" },
    { merchant: "AMC Theatres", category: "entertainment", amount: 32.00, location: "San Francisco, CA" },
  ];
  return samples.slice(0, 4 + Math.floor(Math.random() * 4)).map((s, i) => ({
    id: `ctx_${card.id}_${i}`,
    cardId: card.id,
    merchant: s.merchant,
    category: s.category,
    amount: s.amount,
    currency: "USD",
    status: "success" as const,
    location: s.location,
    createdAt: daysAgo(i * 3 + 1),
  }));
});

// ----------------------------------------------------------------------------
// Billers & payments — US billers
// ----------------------------------------------------------------------------
export const MOCK_BILLERS: Biller[] = [
  {
    id: "blr_airtime_verizon",
    category: "airtime",
    name: "Verizon Wireless",
    fields: [
      { key: "phone", label: "Phone Number", type: "tel", placeholder: "(415) 555-0100", required: true },
    ],
  },
  {
    id: "blr_airtime_att",
    category: "airtime",
    name: "AT&T Mobility",
    fields: [
      { key: "phone", label: "Phone Number", type: "tel", placeholder: "(212) 555-0100", required: true },
    ],
  },
  {
    id: "blr_airtime_tmobile",
    category: "airtime",
    name: "T-Mobile",
    fields: [
      { key: "phone", label: "Phone Number", type: "tel", placeholder: "(312) 555-0100", required: true },
    ],
  },
  {
    id: "blr_airtime_uscellular",
    category: "airtime",
    name: "US Cellular",
    fields: [
      { key: "phone", label: "Phone Number", type: "tel", placeholder: "(206) 555-0100", required: true },
    ],
  },
  {
    id: "blr_data_verizon",
    category: "data",
    name: "Verizon Data Plans",
    fields: [
      { key: "phone", label: "Phone Number", type: "tel", placeholder: "(415) 555-0100", required: true },
      { key: "bundle", label: "Plan", type: "select", options: ["5GB — $25", "15GB — $45", "Unlimited — $75"], required: true },
    ],
  },
  {
    id: "blr_data_att",
    category: "data",
    name: "AT&T Data",
    fields: [
      { key: "phone", label: "Phone Number", type: "tel", required: true },
      { key: "bundle", label: "Plan", type: "select", options: ["10GB — $30", "30GB — $55", "Unlimited — $85"], required: true },
    ],
  },
  {
    id: "blr_electric_pge",
    category: "electricity",
    name: "Pacific Gas & Electric (PG&E)",
    fields: [
      { key: "meter", label: "Account Number", type: "text", placeholder: "1234567890", required: true },
      { key: "type", label: "Service Type", type: "select", options: ["Residential", "Commercial"], required: true },
    ],
  },
  {
    id: "blr_electric_duke",
    category: "electricity",
    name: "Duke Energy",
    fields: [
      { key: "meter", label: "Account Number", type: "text", required: true },
      { key: "type", label: "Service Type", type: "select", options: ["Residential", "Commercial"], required: true },
    ],
  },
  {
    id: "blr_cable_comcast",
    category: "cable_tv",
    name: "Xfinity (Comcast)",
    fields: [
      { key: "iuc", label: "Account Number", type: "text", required: true },
      { key: "plan", label: "Plan", type: "select", options: ["Popular — $80", "Ultimate — $100", "Premier — $140"], required: true },
    ],
  },
  {
    id: "blr_cable_directv",
    category: "cable_tv",
    name: "DIRECTV",
    fields: [
      { key: "iuc", label: "Account Number", type: "text", required: true },
      { key: "plan", label: "Plan", type: "select", options: ["Entertainment — $70", "Choice — $95", "Premier — $155"], required: true },
    ],
  },
  {
    id: "blr_internet_comcast",
    category: "internet",
    name: "Xfinity Internet",
    fields: [
      { key: "account", label: "Account Number", type: "text", required: true },
      { key: "plan", label: "Plan", type: "select", options: ["200 Mbps — $40", "400 Mbps — $60", "Gigabit — $80"], required: true },
    ],
  },
];

export const MOCK_BILL_PAYMENTS: BillPayment[] = [
  {
    id: "blp_001",
    userId: "usr_001",
    accountId: "acc_001",
    billerId: "blr_airtime_verizon",
    billerName: "Verizon Wireless",
    category: "airtime",
    amount: 50.00,
    currency: "USD",
    customerReference: "+1 (415) 555-0182",
    status: "success",
    reference: "BLP-700001",
    createdAt: daysAgo(3),
  },
  {
    id: "blp_002",
    userId: "usr_001",
    accountId: "acc_001",
    billerId: "blr_cable_comcast",
    billerName: "Xfinity (Comcast)",
    category: "cable_tv",
    amount: 100.00,
    currency: "USD",
    customerReference: "881234567890",
    status: "success",
    reference: "BLP-700002",
    createdAt: daysAgo(10),
  },
  {
    id: "blp_003",
    userId: "usr_001",
    accountId: "acc_001",
    billerId: "blr_electric_pge",
    billerName: "Pacific Gas & Electric (PG&E)",
    category: "electricity",
    amount: 185.40,
    currency: "USD",
    customerReference: "0123456789",
    status: "success",
    reference: "BLP-700003",
    createdAt: daysAgo(15),
  },
];

// ----------------------------------------------------------------------------
// Notifications
// ----------------------------------------------------------------------------
export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "ntf_001",
    userId: "usr_001",
    type: "transaction",
    title: "Credit Alert: $4,250.00",
    body: "Your payroll from TechFlow Inc. has been credited to Salary Checking (••6790).",
    read: false,
    createdAt: hoursAgo(2),
    actionUrl: "#/transactions",
    actionLabel: "View transaction",
  },
  {
    id: "ntf_002",
    userId: "usr_001",
    type: "security",
    title: "New sign-in from Chrome / San Francisco",
    body: "A new device signed in to your OceanSky account. If this was you, no action is needed.",
    read: false,
    createdAt: hoursAgo(8),
    actionUrl: "#/profile/security",
    actionLabel: "Review sessions",
  },
  {
    id: "ntf_003",
    userId: "usr_001",
    type: "promo",
    title: "OceanSky Premium — zero transfer fees this week",
    body: "Enjoy zero transfer fees on all internal transfers until Sunday, 11:59 PM PT.",
    read: true,
    createdAt: daysAgo(1),
    actionUrl: "#/campaigns",
    actionLabel: "See offer",
  },
  {
    id: "ntf_004",
    userId: "usr_001",
    type: "card",
    title: "Card transaction declined",
    body: "Your card ••4321 was declined at Amazon Web Services for $1,200. Daily online limit reached.",
    read: false,
    createdAt: daysAgo(2),
    actionUrl: "#/cards",
    actionLabel: "Manage card",
  },
  {
    id: "ntf_005",
    userId: "usr_001",
    type: "support",
    title: "Support agent replied",
    body: "A support agent has replied to your ticket #T-40021 regarding statement download.",
    read: false,
    createdAt: daysAgo(3),
    actionUrl: "#/support",
    actionLabel: "Open chat",
  },
];

export const MOCK_NOTIFICATION_PREFS: NotificationPreferences[] = [
  {
    userId: "usr_001",
    channels: { push: true, email: true, sms: false },
    categories: { transaction: true, security: true, promo: false, system: true, support: true },
  },
];

// ----------------------------------------------------------------------------
// Support
// ----------------------------------------------------------------------------
export const MOCK_TICKETS: SupportTicket[] = [
  {
    id: "tkt_40021",
    userId: "usr_001",
    subject: "Cannot download August statement",
    category: "statements",
    status: "pending_customer",
    priority: "medium",
    assignedAgentId: "adm_004",
    createdAt: daysAgo(3),
    updatedAt: hoursAgo(5),
    unreadByCustomer: false,
    unreadByAgent: false,
  },
  {
    id: "tkt_40022",
    userId: "usr_002",
    subject: "Card declined at POS",
    category: "cards",
    status: "open",
    priority: "high",
    assignedAgentId: "adm_004",
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(1),
    unreadByCustomer: true,
    unreadByAgent: true,
  },
  {
    id: "tkt_40023",
    userId: "usr_003",
    subject: "Transfer limit increase request",
    category: "transfers",
    status: "escalated",
    priority: "high",
    assignedAgentId: "adm_003",
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(2),
    unreadByCustomer: false,
    unreadByAgent: true,
  },
];

export const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "msg_001",
    ticketId: "tkt_40021",
    sender: "customer",
    senderName: "Olivia Bennett",
    body: "Hi, I keep getting an error when I try to download my August statement. It just says 'failed'.",
    createdAt: daysAgo(3),
    status: "read",
  },
  {
    id: "msg_002",
    ticketId: "tkt_40021",
    sender: "agent",
    senderName: "Sarah Mitchell",
    body: "Hello Olivia, apologies for the inconvenience. I can see the error on our side — our PDF service was briefly unavailable. I have regenerated the statement for you. Could you please try downloading again?",
    createdAt: daysAgo(3),
    status: "read",
  },
  {
    id: "msg_003",
    ticketId: "tkt_40021",
    sender: "customer",
    senderName: "Olivia Bennett",
    body: "Thanks, working now. Sorry for the bother.",
    createdAt: hoursAgo(8),
    status: "read",
  },
  {
    id: "msg_004",
    ticketId: "tkt_40021",
    sender: "agent",
    senderName: "Sarah Mitchell",
    body: "Not a problem at all. Is there anything else I can help you with today?",
    createdAt: hoursAgo(5),
    status: "delivered",
  },
];

export const MOCK_FAQS: FAQItem[] = [
  { id: "faq_1", category: "Transfers", question: "How long do internal transfers take?", answer: "Internal transfers between OceanSky accounts are instant and reflect within seconds." },
  { id: "faq_2", category: "Transfers", question: "What is my daily transfer limit?", answer: "Standard accounts: $5,000/day. Premium accounts: $25,000/day. Private Banking: $100,000/day." },
  { id: "faq_3", category: "Cards", question: "How do I lock my card?", answer: "Go to Cards → select the card → toggle 'Lock card'. The card will be instantly blocked for all new transactions." },
  { id: "faq_4", category: "Cards", question: "What should I do if my card is stolen?", answer: "Lock the card immediately from the app, then call our 24/7 support line to report it and request a replacement." },
  { id: "faq_5", category: "Statements", question: "How do I download a statement?", answer: "Visit Statements → New statement, choose the account and date range, then select PDF, CSV or Excel format." },
  { id: "faq_6", category: "Security", question: "How do I enable two-factor authentication?", answer: "Profile → Security Centre → Two-factor authentication → Enable. You will receive OTPs via SMS or email." },
  { id: "faq_7", category: "Bills", question: "Which billers are supported?", answer: "We support major wireless carriers, electricity, cable TV, and internet providers across the United States." },
  { id: "faq_8", category: "Account", question: "How do I upgrade my account tier?", answer: "Profile → Account tier → Request upgrade. Premium requires a minimum balance of $10,000; Private requires $100,000." },
];

// ----------------------------------------------------------------------------
// Statements
// ----------------------------------------------------------------------------
export const MOCK_STATEMENTS: Statement[] = [
  {
    id: "stmt_001",
    userId: "usr_001",
    accountId: "acc_001",
    startDate: daysAgo(60),
    endDate: daysAgo(30),
    openingBalance: 19_800.00,
    closingBalance: 24_105.00,
    totalCredits: 15_000.00,
    totalDebits: 10_695.00,
    transactionCount: 38,
    generatedAt: daysAgo(30),
    format: "pdf",
  },
  {
    id: "stmt_002",
    userId: "usr_001",
    accountId: "acc_002",
    startDate: daysAgo(90),
    endDate: daysAgo(60),
    openingBalance: 15_000.00,
    closingBalance: 17_200.00,
    totalCredits: 15_000.00,
    totalDebits: 12_800.00,
    transactionCount: 41,
    generatedAt: daysAgo(60),
    format: "pdf",
  },
];

// ----------------------------------------------------------------------------
// Campaigns
// ----------------------------------------------------------------------------
export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: "cmp_001",
    title: "Zero transfer fees week",
    subtitle: "OceanSky Premium offer",
    description: "Enjoy 0% transfer fees on all internal transfers this week. Upgrade to Premium and save more every month.",
    ctaLabel: "Upgrade to Premium",
    ctaUrl: "#/profile",
    status: "active",
    audience: "all",
    startsAt: daysAgo(2),
    endsAt: daysAgo(-5),
    accentColor: "teal",
    metrics: { impressions: 124_500, clicks: 12_400, conversions: 820 },
  },
  {
    id: "cmp_002",
    title: "Refer a friend, earn $25",
    subtitle: "OceanSky Referral Program",
    description: "Invite your friends to open an OceanSky account. You both earn $25 after their first $500 deposit.",
    ctaLabel: "Invite friends",
    ctaUrl: "#/campaigns",
    status: "active",
    audience: "all",
    startsAt: daysAgo(30),
    endsAt: daysAgo(-30),
    accentColor: "ocean",
    metrics: { impressions: 380_200, clicks: 45_000, conversions: 3_100 },
  },
  {
    id: "cmp_003",
    title: "Private Banking — invitations open",
    subtitle: "Elevate your banking",
    description: "Private Banking clients receive a dedicated relationship manager, preferential FX rates and exclusive investment opportunities.",
    ctaLabel: "Request invitation",
    ctaUrl: "#/profile",
    status: "scheduled",
    audience: "premium",
    startsAt: daysAgo(-7),
    endsAt: daysAgo(-60),
    accentColor: "graphite",
  },
];

// ----------------------------------------------------------------------------
// Admin users & permissions
// ----------------------------------------------------------------------------
export const MOCK_ADMIN_USERS: AdminUser[] = [
  {
    id: "adm_001",
    firstName: "Daniel",
    lastName: "Okoro",
    email: "daniel.okoro@oceansky.bank",
    role: "super_admin",
    department: "executive",
    status: "active",
    lastActiveAt: minsAgo(2),
    permissions: ["*"],
  },
  {
    id: "adm_002",
    firstName: "Susan",
    lastName: "Hayes",
    email: "susan.hayes@oceansky.bank",
    role: "operations_manager",
    department: "operations",
    status: "active",
    lastActiveAt: hoursAgo(1),
    permissions: ["customers.*", "accounts.*", "transactions.*", "settings.read"],
  },
  {
    id: "adm_003",
    firstName: "Victor",
    lastName: "Bauer",
    email: "victor.bauer@oceansky.bank",
    role: "risk_analyst",
    department: "risk",
    status: "active",
    lastActiveAt: minsAgo(15),
    permissions: ["risk.*", "transactions.read", "customers.read"],
  },
  {
    id: "adm_004",
    firstName: "Sarah",
    lastName: "Mitchell",
    email: "sarah.mitchell@oceansky.bank",
    role: "support_agent",
    department: "support",
    status: "active",
    lastActiveAt: minsAgo(1),
    permissions: ["support.*", "customers.read"],
  },
  {
    id: "adm_005",
    firstName: "Grace",
    lastName: "Anderson",
    email: "grace.anderson@oceansky.bank",
    role: "compliance_officer",
    department: "compliance",
    status: "active",
    lastActiveAt: hoursAgo(4),
    permissions: ["audit.*", "customers.read", "transactions.read"],
  },
];

// ----------------------------------------------------------------------------
// Risk cases
// ----------------------------------------------------------------------------
export const MOCK_RISK_CASES: RiskCase[] = [
  {
    id: "rsk_001",
    transactionId: "txn_00042",
    userId: "usr_002",
    userName: "Marcus Reed",
    amount: 15_000,
    currency: "USD",
    reason: "high_amount",
    riskScore: 82,
    riskLevel: "high",
    status: "open",
    assignedTo: "adm_003",
    createdAt: hoursAgo(2),
  },
  {
    id: "rsk_002",
    transactionId: "txn_00058",
    userId: "usr_001",
    userName: "Olivia Bennett",
    amount: 8_800,
    currency: "USD",
    reason: "unusual_location",
    riskScore: 67,
    riskLevel: "medium",
    status: "reviewing",
    assignedTo: "adm_003",
    createdAt: hoursAgo(5),
  },
  {
    id: "rsk_003",
    transactionId: "txn_00071",
    userId: "usr_003",
    userName: "Sophia Chen",
    amount: 42_000,
    currency: "USD",
    reason: "structured_pattern",
    riskScore: 91,
    riskLevel: "critical",
    status: "escalated",
    assignedTo: "adm_003",
    createdAt: hoursAgo(8),
  },
];

// ----------------------------------------------------------------------------
// Audit logs
// ----------------------------------------------------------------------------
export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "aud_001",
    actorType: "admin",
    actorId: "adm_001",
    actorName: "Daniel Okoro",
    action: "Updated transfer fee",
    resource: "bank_settings",
    metadata: { transferFeeFlat: 2.50 },
    ipAddress: "10.20.30.40",
    createdAt: hoursAgo(1),
  },
  {
    id: "aud_002",
    actorType: "admin",
    actorId: "adm_004",
    actorName: "Sarah Mitchell",
    action: "Resolved support ticket",
    resource: "support_ticket",
    resourceId: "tkt_40019",
    ipAddress: "10.20.30.51",
    createdAt: hoursAgo(3),
  },
  {
    id: "aud_003",
    actorType: "admin",
    actorId: "adm_003",
    actorName: "Victor Bauer",
    action: "Blocked high-risk transaction",
    resource: "risk_case",
    resourceId: "rsk_002",
    metadata: { reason: "Velocity threshold exceeded" },
    ipAddress: "10.20.30.55",
    createdAt: hoursAgo(6),
  },
  {
    id: "aud_004",
    actorType: "admin",
    actorId: "adm_002",
    actorName: "Susan Hayes",
    action: "Customer account unfrozen",
    resource: "customer",
    resourceId: "usr_004",
    ipAddress: "10.20.30.42",
    createdAt: hoursAgo(10),
  },
  {
    id: "aud_005",
    actorType: "system",
    actorId: "sys",
    actorName: "OceanSky Risk Engine",
    action: "Auto-flagged transaction",
    resource: "transaction",
    resourceId: "txn_00071",
    metadata: { rule: "structured_pattern", score: 91 },
    ipAddress: "127.0.0.1",
    createdAt: hoursAgo(8),
  },
];

// ----------------------------------------------------------------------------
// Bank settings
// ----------------------------------------------------------------------------
export const MOCK_BANK_SETTINGS: BankSettings = {
  bankName: "OceanSky Bank",
  bankCode: "090",
  swiftCode: "OSBKUS33XXX",
  supportEmail: "support@oceansky.bank",
  supportPhone: "+1 (800) 632-6275",
  baseCurrency: "USD",
  transferFeeFlat: 2.50,
  transferFeePct: 0.05,
  dailyTransferLimit: 25_000,
  otpExpiryMinutes: 5,
  maintenanceMode: false,
};

// ----------------------------------------------------------------------------
// Sessions (security centre)
// ----------------------------------------------------------------------------
export const MOCK_USER_SESSIONS: UserSession[] = [
  {
    id: "ses_001",
    userId: "usr_001",
    device: "MacBook Pro 14",
    browser: "Chrome 130",
    ipAddress: "73.131.42.18",
    location: "San Francisco, CA",
    current: true,
    lastActiveAt: minsAgo(2),
  },
  {
    id: "ses_002",
    userId: "usr_001",
    device: "iPhone 15",
    browser: "OceanSky iOS App",
    ipAddress: "73.131.42.55",
    location: "San Francisco, CA",
    current: false,
    lastActiveAt: hoursAgo(20),
  },
  {
    id: "ses_003",
    userId: "usr_001",
    device: "Windows PC",
    browser: "Edge 130",
    ipAddress: "24.62.81.10",
    location: "New York, NY",
    current: false,
    lastActiveAt: daysAgo(4),
  },
];

// Convenience: data generator helpers for new entities
export function nextId(prefix: string): string {
  return `${prefix}_${uuid().slice(0, 8)}`;
}
