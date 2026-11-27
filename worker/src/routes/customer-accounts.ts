// ============================================================================
// Route: GET /api/admin/customers/:customerId/accounts
// ----------------------------------------------------------------------------
// Returns all accounts belonging to a specific customer. This endpoint is
// called by the admin portal when an admin selects a customer to credit —
// the admin needs to see the customer's accounts to choose which one to
// credit.
//
// On the client side, Firestore security rules would block this read because
// the accounts have `ownerUid != request.auth.uid` (the admin is not the
// account owner). The Worker bypasses rules using the service account, but
// enforces its own authorization: only verified admins can call this.
//
// AUTHORIZATION:
//   - Authorization: Bearer <Firebase ID token> (required)
//   - The token's `admin` custom claim must be true.
//
// RESPONSE:
//   200 { ok: true, data: [{ id, accountNumber, accountType, currency, balance, ... }] }
//   401 { ok: false, error, code: "AUTH_NO_TOKEN" | "AUTH_INVALID_TOKEN" }
//   403 { ok: false, error, code: "AUTH_NOT_ADMIN" }
//   422 { ok: false, error, code: "INVALID_CUSTOMER" }
// ============================================================================

import type { Env } from "../types";
import { ErrorCode } from "../types";
import { ok, fail } from "../response";
import { FirestoreClient } from "../firestore-rest";
import { verifyAdmin } from "./credit-account";

interface AccountSummary {
  id: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  balance: number;
  availableBalance: number;
  status: string;
  nickname?: string;
  openedAt: string;
}

export async function handleCustomerAccounts(
  request: Request,
  env: Env,
  customerId: string
): Promise<Response> {
  // 1. Verify admin authorization.
  const authResult = await verifyAdmin(request, env);
  if ("response" in authResult) return authResult.response;

  // 2. Validate customerId.
  if (!customerId || typeof customerId !== "string") {
    return fail(
      "A valid customer ID is required.",
      ErrorCode.INVALID_CUSTOMER,
      422,
      env.ALLOWED_ORIGIN
    );
  }

  // 3. Query the customer's accounts from Firestore.
  const firestore = new FirestoreClient(
    env.FIREBASE_PROJECT_ID,
    env.FIREBASE_CLIENT_EMAIL,
    env.FIREBASE_PRIVATE_KEY
  );

  try {
    const accounts = await firestore.queryByField(
      "bank/data/accounts",
      "ownerUid",
      "==",
      customerId
    );

    // Map to the summary shape expected by the frontend.
    const summary: AccountSummary[] = accounts.map((acc) => ({
      id: acc.id,
      accountNumber: (acc.data.accountNumber as string) || "",
      accountType: (acc.data.accountType as string) || "savings",
      currency: (acc.data.currency as string) || "USD",
      balance: (acc.data.balance as number) || 0,
      availableBalance: (acc.data.availableBalance as number) || 0,
      status: (acc.data.status as string) || "active",
      nickname: acc.data.nickname as string | undefined,
      openedAt: (acc.data.openedAt as string) || "",
    }));

    return ok(summary, 200, env.ALLOWED_ORIGIN);
  } catch (err) {
    console.error("Customer accounts query failed:", err);
    return fail(
      "Unable to retrieve customer accounts.",
      ErrorCode.FIRESTORE_ERROR,
      500,
      env.ALLOWED_ORIGIN
    );
  }
}
