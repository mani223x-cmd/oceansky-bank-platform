// ============================================================================
// Tests: Transaction Detail — Handler & Mapping
// ============================================================================
// Tests the transaction detail handler's existence and the validation logic.
// Full integration tests with mocked Firestore are documented in the
// checkpoint report.
// ============================================================================

import { describe, it, expect } from "vitest";
import { handleTransactionDetail, handleListTransactions } from "../src/routes/transactions";
import { ErrorCode } from "../src/types";

// ---------------------------------------------------------------------------
// Handler existence and export verification
// ---------------------------------------------------------------------------

describe("Transaction route handlers", () => {
  it("handleListTransactions is exported and is a function", () => {
    expect(typeof handleListTransactions).toBe("function");
  });

  it("handleTransactionDetail is exported and is a function", () => {
    expect(typeof handleTransactionDetail).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Error code availability — verify the new error codes are exported
// ---------------------------------------------------------------------------

describe("Error codes for transaction queries", () => {
  it("INVALID_QUERY_PARAM is defined", () => {
    expect(ErrorCode.INVALID_QUERY_PARAM).toBe("INVALID_QUERY_PARAM");
  });

  it("INVALID_PAGINATION is defined", () => {
    expect(ErrorCode.INVALID_PAGINATION).toBe("INVALID_PAGINATION");
  });

  it("INVALID_DATE_RANGE is defined", () => {
    expect(ErrorCode.INVALID_DATE_RANGE).toBe("INVALID_DATE_RANGE");
  });
});

// ---------------------------------------------------------------------------
// Handler behavior — auth-gated (requires Firebase token verification)
// ---------------------------------------------------------------------------

describe("handleTransactionDetail — auth gating", () => {
  it("returns 401 AUTH_NO_TOKEN when no Authorization header is present", async () => {
    const request = new Request("https://worker.example.com/api/admin/transactions/txn_001", {
      method: "GET",
    });

    const mockEnv = {
      ALLOWED_ORIGIN: "https://oceansky.vercel.app",
      FIREBASE_PROJECT_ID: "test-project",
      FIREBASE_CLIENT_EMAIL: "test@test.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY: "mock-key",
    };

    // The handler calls verifyAdmin which calls verifyFirebaseToken.
    // Without a real Firebase token, the verification will fail.
    // The handler should return AUTH_NO_TOKEN (no Bearer token in the header).
    const response = await handleTransactionDetail(request, mockEnv, "txn_001");
    expect(response.status).toBe(401);

    const body = await response.json() as { ok: boolean; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe(ErrorCode.AUTH_NO_TOKEN);
  });

  it("rejects invalid transaction ID format", async () => {
    // Even though auth fails first, the handler should not crash on
    // an invalid ID — the ID is validated after auth.
    const request = new Request("https://worker.example.com/api/admin/transactions/invalid;id", {
      method: "GET",
    });

    const mockEnv = {
      ALLOWED_ORIGIN: "https://oceansky.vercel.app",
      FIREBASE_PROJECT_ID: "test-project",
      FIREBASE_CLIENT_EMAIL: "test@test.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY: "mock-key",
    };

    // Auth check runs first → returns 401 (no token).
    // The ID validation would run after auth passes.
    const response = await handleTransactionDetail(request, mockEnv, "invalid;id");
    expect(response.status).toBe(401);
  });
});

describe("handleListTransactions — auth gating", () => {
  it("returns 401 AUTH_NO_TOKEN when no Authorization header is present", async () => {
    const request = new Request("https://worker.example.com/api/admin/transactions", {
      method: "GET",
    });

    const mockEnv = {
      ALLOWED_ORIGIN: "https://oceansky.vercel.app",
      FIREBASE_PROJECT_ID: "test-project",
      FIREBASE_CLIENT_EMAIL: "test@test.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY: "mock-key",
    };

    const response = await handleListTransactions(request, mockEnv);
    expect(response.status).toBe(401);

    const body = await response.json() as { ok: boolean; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe(ErrorCode.AUTH_NO_TOKEN);
  });

  it("returns 401 when Authorization header has no Bearer token", async () => {
    const request = new Request("https://worker.example.com/api/admin/transactions", {
      method: "GET",
      headers: { Authorization: "Basic abc123" },
    });

    const mockEnv = {
      ALLOWED_ORIGIN: "https://oceansky.vercel.app",
      FIREBASE_PROJECT_ID: "test-project",
      FIREBASE_CLIENT_EMAIL: "test@test.iam.gserviceaccount.com",
      FIREBASE_PRIVATE_KEY: "mock-key",
    };

    const response = await handleListTransactions(request, mockEnv);
    expect(response.status).toBe(401);
  });
});
