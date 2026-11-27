// ============================================================================
// Routes: Admin Transaction History & Ledger Audit Viewer (CP-13)
// ----------------------------------------------------------------------------
// GET /api/admin/transactions
//   Lists transactions with pagination, search, and filters.
//   Query params: page, pageSize, search, type, status, fromDate, toDate
//
// GET /api/admin/transactions/:transactionId
//   Returns a single transaction detail + related audit log entries.
//
// Both endpoints are READ-ONLY. No writes are performed.
//
// SECURITY:
//   - Firebase ID token verified cryptographically.
//   - Admin custom claim checked from the verified token.
//   - No sensitive data (service account keys, private tokens) is exposed.
//   - Query parameters are validated to prevent injection.
//   - Firestore queries are bounded (limit + orderBy) to prevent unbounded reads.
// ============================================================================

import type { Env } from "../types";
import { ErrorCode } from "../types";
import { ok, fail } from "../response";
import { FirestoreClient } from "../firestore-rest";
import { verifyAdmin } from "./credit-account";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

// Safe transaction type values — only these are accepted as filter parameters.
const VALID_TYPES = [
  "credit", "debit", "transfer_in", "transfer_out",
  "bill_payment", "airtime", "data", "card_payment",
  "fee", "interest", "salary", "refund", "admin_credit",
];

const VALID_STATUSES = ["success", "pending", "failed", "reversed"];

// Safe ID format — alphanumeric + dashes/underscores, 1-128 chars.
const SAFE_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-_]{0,127}$/;

// Safe search format — alphanumeric + dashes/underscores, 1-100 chars.
// Prevents injection and unsafe Firestore query values.
const SAFE_SEARCH_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-_]{0,99}$/;

// ISO date format (YYYY-MM-DD or full ISO 8601).
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/;

// ---------------------------------------------------------------------------
// Response types — these are the shapes returned to the frontend.
// Sensitive fields (idempotencyKey, referenceLockId, admin internal details)
// are included in the transaction detail for admin visibility but the
// service account credentials are NEVER exposed.
// ---------------------------------------------------------------------------

interface TransactionSummary {
  id: string;
  reference: string;
  type: string;
  direction: string;
  amount: number;
  currency: string;
  status: string;
  category: string;
  description: string;
  counterparty: string;
  ownerUid: string;
  accountId: string;
  createdAt: string;
  fee: number;
}

interface TransactionDetail extends TransactionSummary {
  metadata?: Record<string, unknown>;
  valueDate?: string;
  counterpartyAccount?: string;
  counterpartyBank?: string;
}

interface AuditEntry {
  id: string;
  actorType: string;
  actorId: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface TransactionListResponse {
  transactions: TransactionSummary[];
  hasMore: boolean;
  nextPageCursor: string | null;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Query parameter validation — exported for testing
// ---------------------------------------------------------------------------

export function validatePaginationParams(
  pageStr: string | null,
  pageSizeStr: string | null
): { page: number; pageSize: number } | { error: string; code: string } {
  const page = pageStr ? parseInt(pageStr, 10) : 1;
  const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : DEFAULT_PAGE_SIZE;

  if (!Number.isFinite(page) || page < 1) {
    return { error: "Page must be a positive integer.", code: ErrorCode.INVALID_PAGINATION };
  }
  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return { error: `Page size must be between 1 and ${MAX_PAGE_SIZE}.`, code: ErrorCode.INVALID_PAGINATION };
  }

  return { page, pageSize };
}

export function validateSearchParam(search: string | null): string | null {
  if (!search) return null;
  if (search.length > MAX_SEARCH_LENGTH) {
    return null; // silently truncate — don't error on long searches
  }
  if (!SAFE_SEARCH_REGEX.test(search)) {
    return null; // invalid format — return null (no search)
  }
  return search;
}

export function validateTypeFilter(type: string | null): string | null {
  if (!type || type === "all") return null;
  if (!VALID_TYPES.includes(type)) return null;
  return type;
}

export function validateStatusFilter(status: string | null): string | null {
  if (!status || status === "all") return null;
  if (!VALID_STATUSES.includes(status)) return null;
  return status;
}

export function validateDateRange(
  fromDate: string | null,
  toDate: string | null
): { from?: string; to?: string } | { error: string; code: string } {
  const result: { from?: string; to?: string } = {};

  if (fromDate) {
    if (!ISO_DATE_REGEX.test(fromDate)) {
      return { error: "Invalid fromDate format. Use YYYY-MM-DD or ISO 8601.", code: ErrorCode.INVALID_DATE_RANGE };
    }
    // Normalize to full ISO if just a date.
    result.from = fromDate.length === 10 ? fromDate + "T00:00:00.000Z" : fromDate;
  }

  if (toDate) {
    if (!ISO_DATE_REGEX.test(toDate)) {
      return { error: "Invalid toDate format. Use YYYY-MM-DD or ISO 8601.", code: ErrorCode.INVALID_DATE_RANGE };
    }
    // Normalize to end of day if just a date.
    result.to = toDate.length === 10 ? toDate + "T23:59:59.999Z" : toDate;
  }

  if (result.from && result.to && result.from > result.to) {
    return { error: "fromDate must be before or equal to toDate.", code: ErrorCode.INVALID_DATE_RANGE };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main handler: GET /api/admin/transactions (list)
// ---------------------------------------------------------------------------

export async function handleListTransactions(
  request: Request,
  env: Env
): Promise<Response> {
  // 1. Verify admin authorization.
  const authResult = await verifyAdmin(request, env);
  if ("response" in authResult) return authResult.response;

  // 2. Parse and validate query parameters.
  const url = new URL(request.url);
  const params = url.searchParams;

  const pagination = validatePaginationParams(
    params.get("page"),
    params.get("pageSize")
  );
  if ("error" in pagination) {
    return fail(pagination.error, pagination.code, 422, env.ALLOWED_ORIGIN);
  }
  const { page, pageSize } = pagination;

  const search = validateSearchParam(params.get("search"));
  const typeFilter = validateTypeFilter(params.get("type"));
  const statusFilter = validateStatusFilter(params.get("status"));

  const dateRange = validateDateRange(
    params.get("fromDate"),
    params.get("toDate")
  );
  if ("error" in dateRange) {
    return fail(dateRange.error, dateRange.code, 422, env.ALLOWED_ORIGIN);
  }

  // 3. Initialize Firestore client.
  const firestore = new FirestoreClient(
    env.FIREBASE_PROJECT_ID,
    env.FIREBASE_CLIENT_EMAIL,
    env.FIREBASE_PRIVATE_KEY
  );

  try {
    // 4. Handle search — try direct document lookup or reference match.
    if (search) {
      const searchResult = await handleSearch(firestore, search, env);
      return searchResult;
    }

    // 5. Build the structured query for paginated listing.
    const filters: Array<{ field: string; op: string; value: unknown }> = [];

    if (typeFilter) {
      filters.push({ field: "type", op: "EQUAL", value: typeFilter });
    }
    if (statusFilter) {
      filters.push({ field: "status", op: "EQUAL", value: statusFilter });
    }
    if (dateRange.from) {
      filters.push({ field: "createdAt", op: "GREATER_THAN_OR_EQUAL", value: dateRange.from });
    }
    if (dateRange.to) {
      filters.push({ field: "createdAt", op: "LESS_THAN_OR_EQUAL", value: dateRange.to });
    }

    // Query pageSize + 1 to determine if there's a next page.
    const queryLimit = pageSize + 1;

    // For cursor-based pagination: if page > 1, we need the cursor from the
    // previous page. The frontend passes the cursor as a base64-encoded
    // string in the "cursor" query parameter.
    const cursorParam = params.get("cursor");
    let startAfter: Array<unknown> | undefined;
    if (cursorParam) {
      try {
        const decoded = atob(cursorParam);
        const cursorValues = JSON.parse(decoded) as Array<unknown>;
        startAfter = cursorValues;
      } catch {
        return fail(
          "Invalid cursor parameter.",
          ErrorCode.INVALID_QUERY_PARAM,
          422,
          env.ALLOWED_ORIGIN
        );
      }
    }

    const docs = await firestore.runStructuredQuery("bank/data/transactions", {
      filters: filters.length > 0 ? filters : undefined,
      orderBy: [{ field: "createdAt", direction: "DESCENDING" }],
      limit: queryLimit,
      startAfter,
    });

    // 6. Determine if there's a next page.
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

    // 7. Build the response.
    const transactions: TransactionSummary[] = pageDocs.map((doc) =>
      mapTransactionSummary(doc.id, doc.data)
    );

    // 8. Build the next page cursor (if there are more results).
    let nextPageCursor: string | null = null;
    if (hasMore && pageDocs.length > 0) {
      const lastDoc = pageDocs[pageDocs.length - 1];
      const lastCreatedAt = lastDoc.data.createdAt as string;
      nextPageCursor = btoa(JSON.stringify([lastCreatedAt]));
    }

    const response: TransactionListResponse = {
      transactions,
      hasMore,
      nextPageCursor,
      page,
      pageSize,
    };

    return ok(response, 200, env.ALLOWED_ORIGIN);
  } catch (err) {
    console.error("Transaction list query failed:", err);
    return fail(
      "Unable to retrieve transactions.",
      ErrorCode.FIRESTORE_ERROR,
      500,
      env.ALLOWED_ORIGIN
    );
  }
}

// ---------------------------------------------------------------------------
// Search handler — tries direct document lookup + reference exact match.
// ---------------------------------------------------------------------------

async function handleSearch(
  firestore: FirestoreClient,
  search: string,
  env: Env
): Promise<Response> {
  // Strategy 1: Try direct document lookup by transaction ID.
  if (SAFE_ID_REGEX.test(search)) {
    const doc = await firestore.getDoc(`bank/data/transactions/${search}`);
    if (doc) {
      const txn = mapTransactionSummary(search, doc);
      const response: TransactionListResponse = {
        transactions: [txn],
        hasMore: false,
        nextPageCursor: null,
        page: 1,
        pageSize: 1,
      };
      return ok(response, 200, env.ALLOWED_ORIGIN);
    }
  }

  // Strategy 2: Query by reference (exact match).
  const refResults = await firestore.runStructuredQuery("bank/data/transactions", {
    filters: [{ field: "reference", op: "EQUAL", value: search }],
    orderBy: [{ field: "createdAt", direction: "DESCENDING" }],
    limit: MAX_PAGE_SIZE,
  });

  if (refResults.length > 0) {
    const transactions = refResults.map((doc) =>
      mapTransactionSummary(doc.id, doc.data)
    );
    const response: TransactionListResponse = {
      transactions,
      hasMore: false,
      nextPageCursor: null,
      page: 1,
      pageSize: transactions.length,
    };
    return ok(response, 200, env.ALLOWED_ORIGIN);
  }

  // Strategy 3: Query by ownerUid (customer ID) exact match.
  if (SAFE_ID_REGEX.test(search)) {
    const ownerResults = await firestore.runStructuredQuery("bank/data/transactions", {
      filters: [{ field: "ownerUid", op: "EQUAL", value: search }],
      orderBy: [{ field: "createdAt", direction: "DESCENDING" }],
      limit: MAX_PAGE_SIZE,
    });

    if (ownerResults.length > 0) {
      const transactions = ownerResults.map((doc) =>
        mapTransactionSummary(doc.id, doc.data)
      );
      const response: TransactionListResponse = {
        transactions,
        hasMore: transactions.length === MAX_PAGE_SIZE,
        nextPageCursor: null,
        page: 1,
        pageSize: transactions.length,
      };
      return ok(response, 200, env.ALLOWED_ORIGIN);
    }
  }

  // No results found.
  const response: TransactionListResponse = {
    transactions: [],
    hasMore: false,
    nextPageCursor: null,
    page: 1,
    pageSize: 0,
  };
  return ok(response, 200, env.ALLOWED_ORIGIN);
}

// ---------------------------------------------------------------------------
// Main handler: GET /api/admin/transactions/:transactionId (detail)
// ---------------------------------------------------------------------------

export async function handleTransactionDetail(
  request: Request,
  env: Env,
  transactionId: string
): Promise<Response> {
  // 1. Verify admin authorization.
  const authResult = await verifyAdmin(request, env);
  if ("response" in authResult) return authResult.response;

  // 2. Validate the transaction ID.
  if (!transactionId || !SAFE_ID_REGEX.test(transactionId)) {
    return fail(
      "Invalid transaction ID.",
      ErrorCode.INVALID_QUERY_PARAM,
      422,
      env.ALLOWED_ORIGIN
    );
  }

  // 3. Initialize Firestore client.
  const firestore = new FirestoreClient(
    env.FIREBASE_PROJECT_ID,
    env.FIREBASE_CLIENT_EMAIL,
    env.FIREBASE_PRIVATE_KEY
  );

  try {
    // 4. Fetch the transaction document.
    const txnData = await firestore.getDoc(`bank/data/transactions/${transactionId}`);

    if (!txnData) {
      return fail(
        "Transaction not found.",
        ErrorCode.NOT_FOUND,
        404,
        env.ALLOWED_ORIGIN
      );
    }

    // 5. Map to the detail response (includes metadata for admin visibility).
    const transaction = mapTransactionDetail(transactionId, txnData);

    // 6. Fetch related audit log entries.
    // The audit logs store metadata.transactionId, so we query by that field.
    let auditEntries: AuditEntry[] = [];
    try {
      const auditResults = await firestore.runStructuredQuery("bank/data/audit_logs", {
        filters: [
          { field: "metadata.transactionId", op: "EQUAL", value: transactionId },
        ],
        orderBy: [{ field: "createdAt", direction: "DESCENDING" }],
        limit: 10,
      });
      auditEntries = auditResults.map((doc) => mapAuditEntry(doc.id, doc.data));
    } catch (auditErr) {
      // Audit retrieval failure is non-fatal — return the transaction
      // with an empty audit list rather than failing the whole request.
      console.error("Audit log query failed:", auditErr);
    }

    // 7. Return the transaction detail + audit entries.
    return ok({ transaction, auditEntries }, 200, env.ALLOWED_ORIGIN);
  } catch (err) {
    console.error("Transaction detail query failed:", err);
    return fail(
      "Unable to retrieve transaction details.",
      ErrorCode.FIRESTORE_ERROR,
      500,
      env.ALLOWED_ORIGIN
    );
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers — convert raw Firestore data to safe response shapes.
// These strip internal Firestore encoding and expose only safe fields.
// ---------------------------------------------------------------------------

function mapTransactionSummary(
  id: string,
  data: Record<string, unknown>
): TransactionSummary {
  return {
    id,
    reference: (data.reference as string) || "",
    type: (data.type as string) || "",
    direction: (data.direction as string) || "",
    amount: (data.amount as number) || 0,
    currency: (data.currency as string) || "USD",
    status: (data.status as string) || "",
    category: (data.category as string) || "",
    description: (data.description as string) || "",
    counterparty: (data.counterparty as string) || "",
    ownerUid: (data.ownerUid as string) || "",
    accountId: (data.accountId as string) || "",
    createdAt: (data.createdAt as string) || "",
    fee: (data.fee as number) || 0,
  };
}

function mapTransactionDetail(
  id: string,
  data: Record<string, unknown>
): TransactionDetail {
  const summary = mapTransactionSummary(id, data);
  return {
    ...summary,
    metadata: data.metadata as Record<string, unknown> | undefined,
    valueDate: data.valueDate as string | undefined,
    counterpartyAccount: data.counterpartyAccount as string | undefined,
    counterpartyBank: data.counterpartyBank as string | undefined,
  };
}

function mapAuditEntry(
  id: string,
  data: Record<string, unknown>
): AuditEntry {
  return {
    id,
    actorType: (data.actorType as string) || "",
    actorId: (data.actorId as string) || "",
    actorName: (data.actorName as string) || "",
    action: (data.action as string) || "",
    resource: (data.resource as string) || "",
    resourceId: (data.resourceId as string) || "",
    createdAt: (data.createdAt as string) || "",
    metadata: data.metadata as Record<string, unknown> | undefined,
  };
}
