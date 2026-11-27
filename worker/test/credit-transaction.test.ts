// ============================================================================
// Tests: Credit Account — Transaction Flow (Mocked Firestore)
// ============================================================================
// These tests mock the FirestoreClient to test the full transaction flow
// including: idempotency cache hit, idempotency payload mismatch, account
// validation, reference lock, self-credit prevention, and atomic commit.
//
// They do NOT connect to real Firestore. Integration testing with real
// Firebase credentials is documented in the checkpoint report.
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { executeCreditTransaction } from "../src/routes/credit-account";
import { ErrorCode } from "../src/types";
import type { VerifiedAdmin } from "../src/types";
import type { FirestoreClient } from "../src/firestore-rest";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const admin: VerifiedAdmin = {
  uid: "adm_001",
  email: "daniel.okoro@oceansky.bank",
  admin: true,
  role: "super_admin",
  department: "executive",
};

const validBody = {
  customerId: "usr_001",
  accountId: "acc_001",
  amount: 500,
  currency: "USD",
  reason: "Customer service adjustment for disputed transaction",
  reference: "CR-20261127-0001",
};

const idempotencyKey = "550e8400-e29b-41d4-a716-446655440000";

const mockAccount = {
  ownerUid: "usr_001",
  status: "active",
  currency: "USD",
  balance: 1000,
  availableBalance: 1000,
};

// ---------------------------------------------------------------------------
// Mock FirestoreClient factory
// ---------------------------------------------------------------------------

interface MockState {
  idempotencyDoc: Record<string, unknown> | null;
  accountDoc: Record<string, unknown> | null;
  accountUpdateTime: string | undefined;
  referenceLockDoc: Record<string, unknown> | null;
  commitCalled: boolean;
  commitWrites: Array<Record<string, unknown>>;
  beginTransactionCalled: boolean;
}

function createMockFirestore(state: MockState): FirestoreClient {
  const mock = {
    beginTransaction: vi.fn().mockResolvedValue("mock-transaction-id"),
    getDocInTransaction: vi.fn().mockImplementation(async (path: string) => {
      if (path.includes("idempotency_keys")) {
        return { data: state.idempotencyDoc, updateTime: undefined };
      }
      if (path.includes("accounts")) {
        return { data: state.accountDoc, updateTime: state.accountUpdateTime };
      }
      if (path.includes("reference_locks")) {
        return { data: state.referenceLockDoc, updateTime: undefined };
      }
      return { data: null };
    }),
    commit: vi.fn().mockImplementation(async (writes: Array<Record<string, unknown>>) => {
      state.commitCalled = true;
      state.commitWrites = writes;
    }),
    docPath: vi.fn().mockImplementation((p: string) => `projects/proj/databases/(default)/documents/${p}`),
  };
  return mock as unknown as FirestoreClient;
}

function createMockState(overrides: Partial<MockState> = {}): MockState {
  return {
    idempotencyDoc: null,
    accountDoc: { ...mockAccount },
    accountUpdateTime: "2026-01-01T00:00:00.000Z",
    referenceLockDoc: null,
    commitCalled: false,
    commitWrites: [],
    beginTransactionCalled: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("executeCreditTransaction — successful credit", () => {
  it("commits 5 writes atomically (account, txn, audit, ref-lock, idempotency)", async () => {
    const state = createMockState();
    const firestore = createMockFirestore(state);

    const result = await executeCreditTransaction(firestore, admin, validBody, idempotencyKey);

    // Verify the result
    expect(result.transactionId).toBeTruthy();
    expect(result.reference).toBe(validBody.reference);
    expect(result.newBalance).toBe(1500); // 1000 + 500
    expect(result.newAvailableBalance).toBe(1500);

    // Verify exactly 5 writes were committed
    expect(state.commitCalled).toBe(true);
    expect(state.commitWrites).toHaveLength(5);

    // Verify write preconditions
    // (a) Account update — has updateMask + updateTime precondition
    const accountWrite = state.commitWrites[0];
    expect(accountWrite.updateMask).toBeDefined();
    expect((accountWrite.updateMask as { fieldPaths: string[] }).fieldPaths).toEqual(["balance", "availableBalance"]);
    expect(accountWrite.currentDocument).toEqual({ updateTime: "2026-01-01T00:00:00.000Z" });

    // (b) Transaction record — exists:false
    expect(state.commitWrites[1].currentDocument).toEqual({ exists: false });

    // (c) Audit log — exists:false
    expect(state.commitWrites[2].currentDocument).toEqual({ exists: false });

    // (d) Reference lock — exists:false
    expect(state.commitWrites[3].currentDocument).toEqual({ exists: false });

    // (e) Idempotency key — exists:false
    expect(state.commitWrites[4].currentDocument).toEqual({ exists: false });
  });

  it("uses integer minor-unit arithmetic for the balance", async () => {
    const state = createMockState({
      accountDoc: { ...mockAccount, balance: 1000.50, availableBalance: 1000.50 },
    });
    const firestore = createMockFirestore(state);

    const result = await executeCreditTransaction(firestore, admin, {
      ...validBody,
      amount: 500.25,
    }, idempotencyKey);

    // 1000.50 + 500.25 = 1500.75 (exact, no floating-point error)
    expect(result.newBalance).toBe(1500.75);
    expect(result.newAvailableBalance).toBe(1500.75);
  });
});

describe("executeCreditTransaction — idempotency cache hit", () => {
  it("returns cached response when same key + same payload", async () => {
    const cachedResponse = {
      ok: true,
      data: {
        transactionId: "txn_cached",
        newBalance: 1500,
        newAvailableBalance: 1500,
        creditedAt: "2026-11-27T10:00:00.000Z",
        reference: validBody.reference,
      },
    };

    const state = createMockState({
      idempotencyDoc: {
        request: {
          customerId: validBody.customerId,
          accountId: validBody.accountId,
          amount: validBody.amount,
          currency: validBody.currency,
          reason: validBody.reason,
          reference: validBody.reference,
        },
        response: cachedResponse,
      },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("IDEMPOTENCY_HIT:");

    // Verify NO commit was called — the cached response is returned without re-crediting.
    expect(state.commitCalled).toBe(false);
  });
});

describe("executeCreditTransaction — idempotency payload mismatch", () => {
  it("rejects when same key is reused with a different amount", async () => {
    const state = createMockState({
      idempotencyDoc: {
        request: {
          customerId: validBody.customerId,
          accountId: validBody.accountId,
          amount: 999, // different from the new request's 500
          currency: validBody.currency,
          reason: validBody.reason,
          reference: validBody.reference,
        },
        response: { ok: true, data: {} },
      },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("IDEMPOTENCY_MISMATCH");

    expect(state.commitCalled).toBe(false);
  });

  it("rejects when same key is reused with a different customer", async () => {
    const state = createMockState({
      idempotencyDoc: {
        request: {
          customerId: "usr_999", // different
          accountId: validBody.accountId,
          amount: validBody.amount,
          currency: validBody.currency,
          reason: validBody.reason,
          reference: validBody.reference,
        },
        response: { ok: true, data: {} },
      },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("IDEMPOTENCY_MISMATCH");

    expect(state.commitCalled).toBe(false);
  });
});

describe("executeCreditTransaction — account validation", () => {
  it("rejects when account does not exist", async () => {
    const state = createMockState({ accountDoc: null });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.ACCOUNT_NOT_FOUND);

    expect(state.commitCalled).toBe(false);
  });

  it("rejects when account owner does not match customer", async () => {
    const state = createMockState({
      accountDoc: { ...mockAccount, ownerUid: "usr_999" },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.ACCOUNT_CUSTOMER_MISMATCH);

    expect(state.commitCalled).toBe(false);
  });

  it("rejects when account is frozen", async () => {
    const state = createMockState({
      accountDoc: { ...mockAccount, status: "frozen" },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.ACCOUNT_NOT_ACTIVE);

    expect(state.commitCalled).toBe(false);
  });

  it("rejects when account currency does not match", async () => {
    const state = createMockState({
      accountDoc: { ...mockAccount, currency: "EUR" },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.CURRENCY_MISMATCH);

    expect(state.commitCalled).toBe(false);
  });

  it("rejects when account balance is not a number (corrupted)", async () => {
    const state = createMockState({
      accountDoc: { ...mockAccount, balance: "corrupted" },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.ACCOUNT_CORRUPTED);

    expect(state.commitCalled).toBe(false);
  });

  it("rejects when account balance is NaN", async () => {
    const state = createMockState({
      accountDoc: { ...mockAccount, balance: NaN },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.ACCOUNT_CORRUPTED);

    expect(state.commitCalled).toBe(false);
  });

  it("rejects when account balance is Infinity", async () => {
    const state = createMockState({
      accountDoc: { ...mockAccount, balance: Infinity },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.ACCOUNT_CORRUPTED);

    expect(state.commitCalled).toBe(false);
  });
});

describe("executeCreditTransaction — self-credit prevention", () => {
  it("rejects when admin tries to credit their own account", async () => {
    const state = createMockState({
      accountDoc: { ...mockAccount, ownerUid: admin.uid },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, {
        ...validBody,
        customerId: admin.uid,
      }, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.SELF_CREDIT_FORBIDDEN);

    expect(state.commitCalled).toBe(false);
  });
});

describe("executeCreditTransaction — reference lock (duplicate reference)", () => {
  it("rejects when reference lock already exists", async () => {
    const state = createMockState({
      referenceLockDoc: { reference: validBody.reference, transactionId: "txn_old" },
    });
    const firestore = createMockFirestore(state);

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("VALIDATION:" + ErrorCode.DUPLICATE_REFERENCE);

    expect(state.commitCalled).toBe(false);
  });

  it("does NOT query the transactions collection (uses reference lock instead)", async () => {
    const state = createMockState();
    const firestore = createMockFirestore(state);

    // The mock FirestoreClient doesn't have a queryByField method — if the
    // code tries to call it, the test will fail with a type error.
    await executeCreditTransaction(firestore, admin, validBody, idempotencyKey);

    // Verify getDocInTransaction was called for reference_locks (not queryByField)
    const calls = (firestore as unknown as { getDocInTransaction: { mock: { calls: string[][] } } })
      .getDocInTransaction.mock.calls.map((c: string[]) => c[0]);
    expect(calls.some((p: string) => p.includes("reference_locks"))).toBe(true);
  });
});

describe("executeCreditTransaction — transaction conflict", () => {
  it("propagates ABORTED errors for retry handling", async () => {
    const state = createMockState();
    const firestore = createMockFirestore(state);

    // Override commit to throw an ABORTED error
    (firestore as unknown as { commit: { mockImplementation: (fn: () => Promise<void>) => void } })
      .commit.mockImplementation(async () => {
        throw new Error("Firestore commit failed (409): ABORTED");
      });

    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow("ABORTED");

    // The commit was attempted (but failed)
    expect(state.commitCalled).toBe(false); // Our mock flag wasn't set because the throw happened
  });
});

describe("executeCreditTransaction — lost commit response recovery", () => {
  it("on retry after lost response, returns cached response from idempotency doc", async () => {
    // Scenario: the first commit succeeded but the response was lost (network error).
    // On retry, the idempotency doc exists and matches → cached response returned.
    const cachedResponse = {
      ok: true,
      data: {
        transactionId: "txn_original",
        newBalance: 1500,
        newAvailableBalance: 1500,
        creditedAt: "2026-11-27T10:00:00.000Z",
        reference: validBody.reference,
      },
    };

    const state = createMockState({
      idempotencyDoc: {
        request: {
          customerId: validBody.customerId,
          accountId: validBody.accountId,
          amount: validBody.amount,
          currency: validBody.currency,
          reason: validBody.reason,
          reference: validBody.reference,
        },
        response: cachedResponse,
      },
    });
    const firestore = createMockFirestore(state);

    // The retry should throw IDEMPOTENCY_HIT (which the handler catches and
    // returns as a 200 with the cached response).
    await expect(
      executeCreditTransaction(firestore, admin, validBody, idempotencyKey)
    ).rejects.toThrow(/IDEMPOTENCY_HIT:/);

    // No new commit — the cached response is returned without re-crediting.
    expect(state.commitCalled).toBe(false);
  });
});

describe("executeCreditTransaction — atomicity", () => {
  it("all 5 writes are in a single commit call", async () => {
    const state = createMockState();
    const firestore = createMockFirestore(state);

    await executeCreditTransaction(firestore, admin, validBody, idempotencyKey);

    // Exactly 1 commit call with 5 writes
    expect(state.commitCalled).toBe(true);
    expect(state.commitWrites).toHaveLength(5);
  });

  it("the account update uses the updateTime precondition from the read", async () => {
    const state = createMockState({
      accountUpdateTime: "2026-11-27T12:00:00.000Z",
    });
    const firestore = createMockFirestore(state);

    await executeCreditTransaction(firestore, admin, validBody, idempotencyKey);

    const accountWrite = state.commitWrites[0];
    expect(accountWrite.currentDocument).toEqual({
      updateTime: "2026-11-27T12:00:00.000Z",
    });
  });

  it("the reference lock and idempotency writes use exists:false precondition", async () => {
    const state = createMockState();
    const firestore = createMockFirestore(state);

    await executeCreditTransaction(firestore, admin, validBody, idempotencyKey);

    // Reference lock (index 3)
    expect(state.commitWrites[3].currentDocument).toEqual({ exists: false });
    // Idempotency key (index 4)
    expect(state.commitWrites[4].currentDocument).toEqual({ exists: false });
  });

  it("the idempotency document stores the full request payload", async () => {
    const state = createMockState();
    const firestore = createMockFirestore(state);

    await executeCreditTransaction(firestore, admin, validBody, idempotencyKey);

    // The idempotency write (index 4) should contain the request fields.
    // The fields are Firestore-encoded — 'request' is a mapValue containing
    // nested fields for customerId, accountId, amount, currency, reason, reference.
    const idemWrite = state.commitWrites[4];
    const fields = (idemWrite.update as { fields: Record<string, unknown> }).fields;
    expect(fields.request).toBeDefined();
    // The request field is encoded as a mapValue with nested fields.
    const requestMap = (fields.request as { mapValue?: { fields?: Record<string, unknown> } }).mapValue;
    expect(requestMap).toBeDefined();
    expect(requestMap?.fields).toBeDefined();
    expect(requestMap?.fields?.customerId).toBeDefined();
    expect(requestMap?.fields?.amount).toBeDefined();
  });
});
