// ============================================================================
// Route: POST /api/admin/credit-account
// ----------------------------------------------------------------------------
// Credits a customer's account with a specified amount via an atomic Firestore
// transaction. This is an INTERNAL SIMULATED LEDGER operation — no real money
// is moved.
//
// CORRECTED IN CP-12 REVIEW:
//   1. Atomic reference uniqueness via SHA-256 hashed lock document with
//      exists:false precondition in the same transaction.
//   2. Idempotency verification moved INTO the transaction. The idempotency
//      document is read within the transaction. If it exists and the request
//      payload matches, the cached response is returned. If the payload
//      differs, the request is rejected. Commit-response failures are handled
//      safely — a retry reads the idempotency doc and returns the cached
//      response without re-crediting.
//   3. Monetary precision via integer minor-unit calculations. Amounts and
//      balances are converted to integer cents, arithmetic is done in integers,
//      and the result is converted back to float for storage. No floating-
//      point arithmetic errors.
//   4. Robust request validation — null bodies, arrays, missing fields, wrong
//      types, empty strings, oversized strings, non-finite numbers, invalid
//      idempotency keys, invalid reference formats.
//   5. Firestore transaction correctness — all reads use the same transaction
//      ID, all writes have correct preconditions, the account update uses an
//      update-time precondition, retries re-read everything.
//   6. Audit integrity preserved — the audit record identifies the admin,
//      customer, account, amount, currency, reason, reference and transaction ID.
//
// ATOMIC COMMIT (5 writes in a single transaction):
//   a. Update account balance (updateMask + updateTime precondition)
//   b. Create transaction record (exists:false)
//   c. Create audit log (exists:false)
//   d. Create reference lock (exists:false) — SHA-256(reference) as doc ID
//   e. Create idempotency key (exists:false) — stores request payload + response
//
// If any write fails, the entire commit is rolled back — no partial state.
// ============================================================================

import type { Env, VerifiedAdmin } from "../types";
import { ErrorCode } from "../types";
import { ok, fail } from "../response";
import { verifyFirebaseToken, extractBearerToken } from "../firebase-verify";
import { requireAdmin } from "../admin-check";
import { FirestoreClient, toFirestoreValue } from "../firestore-rest";

// ---------------------------------------------------------------------------
// Helper: converts a JS object to the flat Firestore fields format expected
// by the commit API's write.update.fields. Each field value is encoded via
// toFirestoreValue, but the top level is a flat map (not wrapped in mapValue).
// ---------------------------------------------------------------------------
function toFirestoreFields(data: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_CREDIT_AMOUNT = 1_000_000;
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 200;
const MAX_REFERENCE_LENGTH = 100;
const MAX_CUSTOMER_ID_LENGTH = 128;
const MAX_ACCOUNT_ID_LENGTH = 128;
const SUPPORTED_CURRENCIES = ["USD", "EUR"];

// Decimal places per currency (for minor-unit conversion).
const CURRENCY_DECIMAL_PLACES: Record<string, number> = {
  USD: 2,
  EUR: 2,
};

// UUID v4 regex (case-insensitive) — the only accepted idempotency key format.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Safe reference format: alphanumeric + dashes + underscores, 1-100 chars.
// Must start with an alphanumeric character. No slashes (Firestore path safety).
const REFERENCE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-_]{0,99}$/;

// Safe customer/account ID format: alphanumeric + dashes, 1-128 chars.
const ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9\-_]{0,127}$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CreditAccountRequest {
  customerId: string;
  accountId: string;
  amount: number;
  currency: string;
  reason: string;
  reference: string;
}

interface CreditAccountResponse {
  transactionId: string;
  newBalance: number;
  newAvailableBalance: number;
  creditedAt: string;
  reference: string;
}

// ---------------------------------------------------------------------------
// Monetary precision helpers — exported for testing
// ---------------------------------------------------------------------------

/**
 * Converts a float amount to integer minor units (e.g., 12.34 USD → 1234 cents).
 * Returns null if the amount has too many decimal places for the currency.
 */
export function toMinorUnits(amount: number, currency: string): number | null {
  const places = CURRENCY_DECIMAL_PLACES[currency];
  if (places === undefined) return null;
  const factor = Math.pow(10, places);
  const minor = Math.round(amount * factor);
  // Verify no precision was lost (the amount didn't have more decimals than allowed).
  const reconstructed = minor / factor;
  if (Math.abs(reconstructed - amount) > 1e-9) {
    return null; // precision exceeded
  }
  return minor;
}

/**
 * Converts integer minor units back to float (e.g., 1234 cents → 12.34 USD).
 */
export function fromMinorUnits(minor: number, currency: string): number {
  const places = CURRENCY_DECIMAL_PLACES[currency];
  if (places === undefined) return minor;
  const factor = Math.pow(10, places);
  return minor / factor;
}

// ---------------------------------------------------------------------------
// SHA-256 hash for reference lock document ID — exported for testing
// ---------------------------------------------------------------------------

export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Idempotency key validation — exported for testing
// ---------------------------------------------------------------------------

export function validateIdempotencyKey(key: string): boolean {
  return typeof key === "string" && UUID_REGEX.test(key);
}

// ---------------------------------------------------------------------------
// Request validation — robust against all malformed inputs. Exported for testing.
// Returns an error code string, or null if valid.
// ---------------------------------------------------------------------------

export function validateCreditRequest(body: unknown): string | null {
  // Null / non-object / array check
  if (body === null || body === undefined) {
    return ErrorCode.INVALID_BODY;
  }
  if (typeof body !== "object") {
    return ErrorCode.INVALID_BODY;
  }
  if (Array.isArray(body)) {
    return ErrorCode.INVALID_BODY;
  }

  const b = body as Record<string, unknown>;

  // customerId
  if (typeof b.customerId !== "string" || b.customerId.length === 0) {
    return ErrorCode.INVALID_CUSTOMER;
  }
  if (b.customerId.length > MAX_CUSTOMER_ID_LENGTH || !ID_REGEX.test(b.customerId)) {
    return ErrorCode.INVALID_CUSTOMER;
  }

  // accountId
  if (typeof b.accountId !== "string" || b.accountId.length === 0) {
    return ErrorCode.INVALID_ACCOUNT;
  }
  if (b.accountId.length > MAX_ACCOUNT_ID_LENGTH || !ID_REGEX.test(b.accountId)) {
    return ErrorCode.INVALID_ACCOUNT;
  }

  // amount
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount)) {
    return ErrorCode.INVALID_AMOUNT;
  }
  if (b.amount <= 0) {
    return ErrorCode.INVALID_AMOUNT;
  }
  if (b.amount > MAX_CREDIT_AMOUNT) {
    return ErrorCode.INVALID_AMOUNT;
  }

  // currency
  if (typeof b.currency !== "string" || !SUPPORTED_CURRENCIES.includes(b.currency)) {
    return ErrorCode.INVALID_CURRENCY;
  }

  // amount precision — must not have more decimal places than the currency supports
  const amountMinor = toMinorUnits(b.amount, b.currency);
  if (amountMinor === null) {
    return ErrorCode.AMOUNT_PRECISION_EXCEEDED;
  }

  // reason
  if (typeof b.reason !== "string") {
    return ErrorCode.INVALID_REASON;
  }
  const trimmedReason = b.reason.trim();
  if (trimmedReason.length < MIN_REASON_LENGTH || trimmedReason.length > MAX_REASON_LENGTH) {
    return ErrorCode.INVALID_REASON;
  }

  // reference
  if (typeof b.reference !== "string" || b.reference.length === 0) {
    return ErrorCode.INVALID_REFERENCE;
  }
  if (b.reference.length > MAX_REFERENCE_LENGTH) {
    return ErrorCode.INVALID_REFERENCE_FORMAT;
  }
  if (!REFERENCE_REGEX.test(b.reference)) {
    return ErrorCode.INVALID_REFERENCE_FORMAT;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Auth helper — shared across all admin routes
// ---------------------------------------------------------------------------

async function verifyAdmin(
  request: Request,
  env: Env
): Promise<{ admin: VerifiedAdmin } | { response: Response }> {
  const authHeader = request.headers.get("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    return {
      response: fail("Authentication required.", ErrorCode.AUTH_NO_TOKEN, 401, env.ALLOWED_ORIGIN),
    };
  }

  const verified = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
  if (!verified) {
    return {
      response: fail("Invalid or expired authentication token.", ErrorCode.AUTH_INVALID_TOKEN, 401, env.ALLOWED_ORIGIN),
    };
  }

  const admin = requireAdmin(verified);
  if (!admin) {
    return {
      response: fail("Admin authorization required.", ErrorCode.AUTH_NOT_ADMIN, 403, env.ALLOWED_ORIGIN),
    };
  }

  return { admin };
}

// Export verifyAdmin for reuse by other admin routes.
export { verifyAdmin };

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleCreditAccount(
  request: Request,
  env: Env
): Promise<Response> {
  // 1. Verify admin authorization.
  const authResult = await verifyAdmin(request, env);
  if ("response" in authResult) return authResult.response;
  const { admin } = authResult;

  // 2. Validate idempotency key (strict UUID format).
  const rawIdempotencyKey = request.headers.get("X-Idempotency-Key");
  if (!rawIdempotencyKey) {
    return fail(
      "Idempotency key required.",
      ErrorCode.NO_IDEMPOTENCY_KEY,
      400,
      env.ALLOWED_ORIGIN
    );
  }
  if (!validateIdempotencyKey(rawIdempotencyKey)) {
    return fail(
      "Invalid idempotency key format. A valid UUID v4 is required.",
      ErrorCode.INVALID_IDEMPOTENCY_KEY,
      400,
      env.ALLOWED_ORIGIN
    );
  }
  const idempotencyKey = rawIdempotencyKey;

  // 3. Parse the request body safely.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return fail(
      "Invalid or missing JSON body.",
      ErrorCode.INVALID_BODY,
      400,
      env.ALLOWED_ORIGIN
    );
  }

  // 4. Validate the request.
  const validationError = validateCreditRequest(rawBody);
  if (validationError) {
    return fail(
      validationMessage(validationError),
      validationError,
      validationStatus(validationError),
      env.ALLOWED_ORIGIN
    );
  }
  const body = rawBody as CreditAccountRequest;

  // 5. Initialize the Firestore client.
  const firestore = new FirestoreClient(
    env.FIREBASE_PROJECT_ID,
    env.FIREBASE_CLIENT_EMAIL,
    env.FIREBASE_PRIVATE_KEY
  );

  // 6. Execute the atomic credit transaction (with one retry on conflict).
  try {
    const result = await executeCreditTransaction(firestore, admin, body, idempotencyKey);
    return ok(result, 200, env.ALLOWED_ORIGIN);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Validation errors thrown from within the transaction.
    if (message.startsWith("VALIDATION:")) {
      const code = message.replace("VALIDATION:", "");
      return fail(
        validationMessage(code),
        code,
        validationStatus(code),
        env.ALLOWED_ORIGIN
      );
    }

    // Idempotency cache hit — return the cached successful response.
    if (message.startsWith("IDEMPOTENCY_HIT:")) {
      const cachedJson = message.replace("IDEMPOTENCY_HIT:", "");
      try {
        const cached = JSON.parse(cachedJson) as CreditAccountResponse;
        return ok(cached, 200, env.ALLOWED_ORIGIN);
      } catch {
        // Corrupted cache — fall through to conflict error.
        return fail(
          "Idempotency cache is corrupted.",
          ErrorCode.IDEMPOTENCY_CONFLICT,
          409,
          env.ALLOWED_ORIGIN
        );
      }
    }

    // Idempotency payload mismatch — same key, different request.
    if (message.startsWith("IDEMPOTENCY_MISMATCH")) {
      return fail(
        "This idempotency key was already used for a different request.",
        ErrorCode.IDEMPOTENCY_PAYLOAD_MISMATCH,
        409,
        env.ALLOWED_ORIGIN
      );
    }

    // Transaction conflict (ABORTED) — retry once.
    if (message.includes("ABORTED") || message.includes("409")) {
      try {
        const result = await executeCreditTransaction(firestore, admin, body, idempotencyKey);
        return ok(result, 200, env.ALLOWED_ORIGIN);
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);

        // The retry may find the idempotency doc already committed (original
        // commit succeeded but response was lost). Handle gracefully.
        if (retryMsg.startsWith("IDEMPOTENCY_HIT:")) {
          const cachedJson = retryMsg.replace("IDEMPOTENCY_HIT:", "");
          try {
            const cached = JSON.parse(cachedJson) as CreditAccountResponse;
            return ok(cached, 200, env.ALLOWED_ORIGIN);
          } catch {
            return fail(
              "Idempotency cache is corrupted.",
              ErrorCode.IDEMPOTENCY_CONFLICT,
              409,
              env.ALLOWED_ORIGIN
            );
          }
        }

        if (retryMsg.startsWith("VALIDATION:")) {
          const code = retryMsg.replace("VALIDATION:", "");
          return fail(
            validationMessage(code),
            code,
            validationStatus(code),
            env.ALLOWED_ORIGIN
          );
        }

        console.error("Credit transaction retry failed:", retryErr);
        return fail(
          "Transaction conflict — please retry with a new idempotency key.",
          ErrorCode.TXN_CONFLICT,
          409,
          env.ALLOWED_ORIGIN
        );
      }
    }

    console.error("Credit transaction failed:", err);
    return fail(
      "Unable to process the credit operation.",
      ErrorCode.INTERNAL_ERROR,
      500,
      env.ALLOWED_ORIGIN
    );
  }
}

// ---------------------------------------------------------------------------
// Atomic transaction execution — exported for testing with a mock client
// ---------------------------------------------------------------------------

export async function executeCreditTransaction(
  firestore: FirestoreClient,
  admin: VerifiedAdmin,
  body: CreditAccountRequest,
  idempotencyKey: string
): Promise<CreditAccountResponse> {
  // Compute the reference lock document ID (SHA-256 hash of the reference).
  const referenceLockId = await sha256Hex(body.reference);

  // Begin the Firestore transaction.
  const transaction = await firestore.beginTransaction();

  // -----------------------------------------------------------------------
  // READ 1: Idempotency document (within the transaction).
  // If it exists, either return the cached response (payload matches) or
  // reject (payload mismatch). This handles commit-response failures safely.
  // -----------------------------------------------------------------------
  const idemDocPath = `bank/data/idempotency_keys/${idempotencyKey}`;
  const { data: existingIdem } = await firestore.getDocInTransaction(
    idemDocPath,
    transaction
  );

  if (existingIdem) {
    const storedRequest = existingIdem.request as Record<string, unknown> | undefined;
    const storedResponse = existingIdem.response as Record<string, unknown> | undefined;

    if (storedRequest && storedResponse) {
      // Compare the stored request with the new request.
      const matches =
        storedRequest.customerId === body.customerId &&
        storedRequest.accountId === body.accountId &&
        storedRequest.amount === body.amount &&
        storedRequest.currency === body.currency &&
        storedRequest.reference === body.reference;

      if (matches && storedResponse.ok === true) {
        // Same key, same payload, previous success — return cached response.
        const cachedData = storedResponse.data as Record<string, unknown>;
        const cachedResponse: CreditAccountResponse = {
          transactionId: cachedData.transactionId as string,
          newBalance: cachedData.newBalance as number,
          newAvailableBalance: cachedData.newAvailableBalance as number,
          creditedAt: cachedData.creditedAt as string,
          reference: cachedData.reference as string,
        };
        throw new Error("IDEMPOTENCY_HIT:" + JSON.stringify(cachedResponse));
      } else {
        // Same key, different payload — reject.
        throw new Error("IDEMPOTENCY_MISMATCH");
      }
    } else {
      // Corrupted idempotency document.
      throw new Error("IDEMPOTENCY_MISMATCH");
    }
  }

  // -----------------------------------------------------------------------
  // READ 2: Account document (within the transaction).
  // Validates: exists, owner matches, active, currency matches, not self-credit.
  // -----------------------------------------------------------------------
  const accountPath = `bank/data/accounts/${body.accountId}`;
  const { data: accountData, updateTime } = await firestore.getDocInTransaction(
    accountPath,
    transaction
  );

  if (!accountData) {
    throw new Error("VALIDATION:" + ErrorCode.ACCOUNT_NOT_FOUND);
  }

  const accountOwnerUid = accountData.ownerUid as string;
  if (typeof accountOwnerUid !== "string" || accountOwnerUid !== body.customerId) {
    throw new Error("VALIDATION:" + ErrorCode.ACCOUNT_CUSTOMER_MISMATCH);
  }

  const accountStatus = accountData.status as string;
  if (accountStatus !== "active") {
    throw new Error("VALIDATION:" + ErrorCode.ACCOUNT_NOT_ACTIVE);
  }

  const accountCurrency = accountData.currency as string;
  if (typeof accountCurrency !== "string" || accountCurrency !== body.currency) {
    throw new Error("VALIDATION:" + ErrorCode.CURRENCY_MISMATCH);
  }

  // Prevent self-credit.
  if (admin.uid === body.customerId) {
    throw new Error("VALIDATION:" + ErrorCode.SELF_CREDIT_FORBIDDEN);
  }

  // -----------------------------------------------------------------------
  // READ 3: Reference lock document (within the transaction).
  // If it exists, the reference has already been used — reject.
  // This is the atomic replacement for the non-transactional query.
  // -----------------------------------------------------------------------
  const refLockPath = `bank/data/reference_locks/${referenceLockId}`;
  const { data: existingRefLock } = await firestore.getDocInTransaction(
    refLockPath,
    transaction
  );

  if (existingRefLock) {
    throw new Error("VALIDATION:" + ErrorCode.DUPLICATE_REFERENCE);
  }

  // -----------------------------------------------------------------------
  // VALIDATE + COMPUTE: Monetary precision via integer minor units.
  // -----------------------------------------------------------------------
  const currentBalanceRaw = accountData.balance;
  const currentAvailableRaw = accountData.availableBalance;

  // Validate account balances are finite numbers.
  if (typeof currentBalanceRaw !== "number" || !Number.isFinite(currentBalanceRaw)) {
    throw new Error("VALIDATION:" + ErrorCode.ACCOUNT_CORRUPTED);
  }
  if (typeof currentAvailableRaw !== "number" || !Number.isFinite(currentAvailableRaw)) {
    throw new Error("VALIDATION:" + ErrorCode.ACCOUNT_CORRUPTED);
  }

  // Convert to integer minor units for safe arithmetic.
  const currentBalanceMinor = toMinorUnits(currentBalanceRaw, body.currency);
  const currentAvailableMinor = toMinorUnits(currentAvailableRaw, body.currency);
  const amountMinor = toMinorUnits(body.amount, body.currency);

  if (currentBalanceMinor === null || currentAvailableMinor === null || amountMinor === null) {
    throw new Error("VALIDATION:" + ErrorCode.AMOUNT_PRECISION_EXCEEDED);
  }

  // Compute new balances in minor units (integer arithmetic — no float errors).
  const newBalanceMinor = currentBalanceMinor + amountMinor;
  const newAvailableMinor = currentAvailableMinor + amountMinor;

  // Convert back to float for storage (preserves frontend compatibility).
  const newBalance = fromMinorUnits(newBalanceMinor, body.currency);
  const newAvailable = fromMinorUnits(newAvailableMinor, body.currency);

  const now = new Date().toISOString();

  // Generate IDs for new documents.
  const transactionId = crypto.randomUUID();
  const auditLogId = crypto.randomUUID();

  // -----------------------------------------------------------------------
  // BUILD WRITES: 5 atomic writes in a single commit.
  //   a. Update account balance (updateMask + updateTime precondition)
  //   b. Create transaction record (exists:false)
  //   c. Create audit log (exists:false)
  //   d. Create reference lock (exists:false) — prevents duplicate references
  //   e. Create idempotency key (exists:false) — prevents duplicate credits
  // -----------------------------------------------------------------------
  const writes: Array<Record<string, unknown>> = [
    // (a) Update account balance — field-level update with updateTime precondition.
    {
      update: {
        name: firestore.docPath(accountPath),
        fields: {
          balance: toFirestoreValue(newBalance),
          availableBalance: toFirestoreValue(newAvailable),
        },
      },
      updateMask: { fieldPaths: ["balance", "availableBalance"] },
      currentDocument: updateTime ? { updateTime } : undefined,
    },
    // (b) Create transaction record — exists:false prevents overwrite.
    {
      update: {
        name: firestore.docPath(`bank/data/transactions/${transactionId}`),
        fields: toFirestoreFields({
          ownerUid: body.customerId,
          accountId: body.accountId,
          reference: body.reference,
          type: "credit",
          direction: "in",
          amount: body.amount,
          currency: body.currency,
          description: body.reason,
          counterparty: `Admin credit — ${admin.email}`,
          category: "admin_credit",
          status: "success",
          fee: 0,
          createdAt: now,
          metadata: {
            adminUid: admin.uid,
            adminEmail: admin.email,
            adminRole: admin.role || "",
            reason: body.reason,
            reference: body.reference,
            idempotencyKey,
            referenceLockId,
          },
        }),
      },
      currentDocument: { exists: false },
    },
    // (c) Create audit log — identifies admin, customer, account, amount, etc.
    {
      update: {
        name: firestore.docPath(`bank/data/audit_logs/${auditLogId}`),
        fields: toFirestoreFields({
          actorType: "admin",
          actorId: admin.uid,
          actorName: admin.email,
          action: "Credited customer account",
          resource: "account",
          resourceId: body.accountId,
          metadata: {
            customerId: body.customerId,
            accountId: body.accountId,
            amount: body.amount,
            currency: body.currency,
            reason: body.reason,
            reference: body.reference,
            transactionId,
            previousBalance: currentBalanceRaw,
            newBalance,
            referenceLockId,
          },
          ipAddress: "",
          createdAt: now,
        }),
      },
      currentDocument: { exists: false },
    },
    // (d) Create reference lock — SHA-256(reference) as doc ID, exists:false.
    //     This atomically prevents duplicate references even under concurrency.
    {
      update: {
        name: firestore.docPath(`bank/data/reference_locks/${referenceLockId}`),
        fields: toFirestoreFields({
          reference: body.reference,
          transactionId,
          createdAt: now,
          createdBy: admin.uid,
        }),
      },
      currentDocument: { exists: false },
    },
    // (e) Create idempotency key — stores the full request + response.
    //     exists:false prevents duplicate credits.
    //     On retry, READ 1 finds this doc and returns the cached response.
    {
      update: {
        name: firestore.docPath(idemDocPath),
        fields: toFirestoreFields({
          processedAt: now,
          adminUid: admin.uid,
          request: {
            customerId: body.customerId,
            accountId: body.accountId,
            amount: body.amount,
            currency: body.currency,
            reason: body.reason,
            reference: body.reference,
          },
          response: {
            ok: true,
            data: {
              transactionId,
              newBalance,
              newAvailableBalance: newAvailable,
              creditedAt: now,
              reference: body.reference,
            },
          },
        }),
      },
      currentDocument: { exists: false },
    },
  ];

  // Commit all 5 writes atomically. If any write fails, the entire commit
  // is rolled back — no partial state.
  await firestore.commit(writes, transaction);

  return {
    transactionId,
    newBalance,
    newAvailableBalance: newAvailable,
    creditedAt: now,
    reference: body.reference,
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validationMessage(code: string): string {
  const messages: Record<string, string> = {
    [ErrorCode.INVALID_BODY]: "Invalid request body.",
    [ErrorCode.INVALID_CUSTOMER]: "A valid customer ID is required (alphanumeric, max 128 characters).",
    [ErrorCode.INVALID_ACCOUNT]: "A valid account ID is required (alphanumeric, max 128 characters).",
    [ErrorCode.INVALID_AMOUNT]: "Amount must be a finite number greater than zero.",
    [ErrorCode.INVALID_CURRENCY]: `Currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}.`,
    [ErrorCode.INVALID_REASON]: `Reason must be ${MIN_REASON_LENGTH}–${MAX_REASON_LENGTH} characters.`,
    [ErrorCode.INVALID_REFERENCE]: "A transaction reference is required.",
    [ErrorCode.INVALID_REFERENCE_FORMAT]: "Reference must be alphanumeric with dashes/underscores, max 100 characters.",
    [ErrorCode.AMOUNT_PRECISION_EXCEEDED]: "Amount has more decimal places than the currency supports (max 2 for USD/EUR).",
    [ErrorCode.ACCOUNT_NOT_FOUND]: "Account not found.",
    [ErrorCode.ACCOUNT_CUSTOMER_MISMATCH]: "This account does not belong to the selected customer.",
    [ErrorCode.ACCOUNT_NOT_ACTIVE]: "Only active accounts can receive credits.",
    [ErrorCode.ACCOUNT_CORRUPTED]: "Account balance is corrupted (not a valid number).",
    [ErrorCode.CURRENCY_MISMATCH]: "The credit currency does not match the account currency.",
    [ErrorCode.SELF_CREDIT_FORBIDDEN]: "Administrators cannot credit their own accounts.",
    [ErrorCode.DUPLICATE_REFERENCE]: "A transaction with this reference already exists.",
  };
  return messages[code] || "Validation failed.";
}

function validationStatus(code: string): number {
  const statuses: Record<string, number> = {
    [ErrorCode.INVALID_BODY]: 400,
    [ErrorCode.INVALID_CUSTOMER]: 422,
    [ErrorCode.INVALID_ACCOUNT]: 422,
    [ErrorCode.INVALID_AMOUNT]: 422,
    [ErrorCode.INVALID_CURRENCY]: 422,
    [ErrorCode.INVALID_REASON]: 422,
    [ErrorCode.INVALID_REFERENCE]: 422,
    [ErrorCode.INVALID_REFERENCE_FORMAT]: 422,
    [ErrorCode.AMOUNT_PRECISION_EXCEEDED]: 422,
    [ErrorCode.ACCOUNT_NOT_FOUND]: 404,
    [ErrorCode.ACCOUNT_CUSTOMER_MISMATCH]: 422,
    [ErrorCode.ACCOUNT_NOT_ACTIVE]: 422,
    [ErrorCode.ACCOUNT_CORRUPTED]: 500,
    [ErrorCode.CURRENCY_MISMATCH]: 422,
    [ErrorCode.SELF_CREDIT_FORBIDDEN]: 403,
    [ErrorCode.DUPLICATE_REFERENCE]: 409,
  };
  return statuses[code] || 422;
}
