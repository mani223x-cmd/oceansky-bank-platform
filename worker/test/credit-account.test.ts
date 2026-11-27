// ============================================================================
// Tests: Credit Account — Validation, Monetary Precision, Idempotency
// ============================================================================
// These are UNIT tests for pure functions (validation, monetary conversion,
// hash, idempotency key format). They do NOT require real Firebase credentials.
//
// Integration tests for the full Firestore transaction flow are documented in
// the checkpoint report and require `wrangler dev` + real service account
// credentials.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  validateCreditRequest,
  validateIdempotencyKey,
  toMinorUnits,
  fromMinorUnits,
  sha256Hex,
} from "../src/routes/credit-account";
import { ErrorCode } from "../src/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const validRequest = {
  customerId: "usr_001",
  accountId: "acc_001",
  amount: 500,
  currency: "USD",
  reason: "Customer service adjustment for disputed transaction",
  reference: "CR-20261127-0001",
};

const validUUID = "550e8400-e29b-41d4-a716-446655440000";

// ===========================================================================
// 1. Request Validation — malformed inputs
// ===========================================================================

describe("validateCreditRequest — malformed inputs", () => {
  it("rejects null body", () => {
    expect(validateCreditRequest(null)).toBe(ErrorCode.INVALID_BODY);
  });

  it("rejects undefined body", () => {
    expect(validateCreditRequest(undefined)).toBe(ErrorCode.INVALID_BODY);
  });

  it("rejects array body", () => {
    expect(validateCreditRequest([1, 2, 3])).toBe(ErrorCode.INVALID_BODY);
  });

  it("rejects string body", () => {
    expect(validateCreditRequest("hello")).toBe(ErrorCode.INVALID_BODY);
  });

  it("rejects number body", () => {
    expect(validateCreditRequest(42)).toBe(ErrorCode.INVALID_BODY);
  });

  it("rejects boolean body", () => {
    expect(validateCreditRequest(true)).toBe(ErrorCode.INVALID_BODY);
  });

  it("rejects empty object", () => {
    expect(validateCreditRequest({})).toBe(ErrorCode.INVALID_CUSTOMER);
  });

  it("rejects missing customerId", () => {
    expect(validateCreditRequest({ ...validRequest, customerId: undefined })).toBe(ErrorCode.INVALID_CUSTOMER);
  });

  it("rejects empty customerId", () => {
    expect(validateCreditRequest({ ...validRequest, customerId: "" })).toBe(ErrorCode.INVALID_CUSTOMER);
  });

  it("rejects non-string customerId", () => {
    expect(validateCreditRequest({ ...validRequest, customerId: 123 })).toBe(ErrorCode.INVALID_CUSTOMER);
  });

  it("rejects customerId with slashes (Firestore path injection)", () => {
    expect(validateCreditRequest({ ...validRequest, customerId: "usr/001" })).toBe(ErrorCode.INVALID_CUSTOMER);
  });

  it("rejects customerId that is too long (> 128 chars)", () => {
    expect(validateCreditRequest({ ...validRequest, customerId: "A".repeat(129) })).toBe(ErrorCode.INVALID_CUSTOMER);
  });

  it("rejects missing accountId", () => {
    expect(validateCreditRequest({ ...validRequest, accountId: undefined })).toBe(ErrorCode.INVALID_ACCOUNT);
  });

  it("rejects empty accountId", () => {
    expect(validateCreditRequest({ ...validRequest, accountId: "" })).toBe(ErrorCode.INVALID_ACCOUNT);
  });

  it("rejects non-string accountId", () => {
    expect(validateCreditRequest({ ...validRequest, accountId: true })).toBe(ErrorCode.INVALID_ACCOUNT);
  });

  it("rejects accountId with special characters", () => {
    expect(validateCreditRequest({ ...validRequest, accountId: "acc;001" })).toBe(ErrorCode.INVALID_ACCOUNT);
  });
});

// ===========================================================================
// 2. Request Validation — amount
// ===========================================================================

describe("validateCreditRequest — amount validation", () => {
  it("rejects missing amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: undefined })).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it("rejects non-number amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: "500" })).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it("rejects NaN amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: NaN })).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it("rejects Infinity amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: Infinity })).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it("rejects -Infinity amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: -Infinity })).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it("rejects zero amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 0 })).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it("rejects negative amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: -100 })).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it("rejects amount exceeding maximum (1,000,001)", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 1_000_001 })).toBe(ErrorCode.INVALID_AMOUNT);
  });

  it("accepts amount = 0.01 (minimum positive)", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 0.01 })).toBeNull();
  });

  it("accepts amount = 1,000,000 (maximum)", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 1_000_000 })).toBeNull();
  });

  it("rejects amount with more than 2 decimal places (0.001)", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 0.001 })).toBe(ErrorCode.AMOUNT_PRECISION_EXCEEDED);
  });

  it("rejects amount with more than 2 decimal places (100.999)", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 100.999 })).toBe(ErrorCode.AMOUNT_PRECISION_EXCEEDED);
  });

  it("accepts amount with exactly 2 decimal places (100.99)", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 100.99 })).toBeNull();
  });

  it("accepts integer amount (500)", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 500 })).toBeNull();
  });
});

// ===========================================================================
// 3. Request Validation — currency
// ===========================================================================

describe("validateCreditRequest — currency validation", () => {
  it("rejects missing currency", () => {
    expect(validateCreditRequest({ ...validRequest, currency: undefined })).toBe(ErrorCode.INVALID_CURRENCY);
  });

  it("rejects non-string currency", () => {
    expect(validateCreditRequest({ ...validRequest, currency: 123 })).toBe(ErrorCode.INVALID_CURRENCY);
  });

  it("rejects NGN currency", () => {
    expect(validateCreditRequest({ ...validRequest, currency: "NGN" })).toBe(ErrorCode.INVALID_CURRENCY);
  });

  it("rejects GBP currency", () => {
    expect(validateCreditRequest({ ...validRequest, currency: "GBP" })).toBe(ErrorCode.INVALID_CURRENCY);
  });

  it("rejects lowercase usd", () => {
    expect(validateCreditRequest({ ...validRequest, currency: "usd" })).toBe(ErrorCode.INVALID_CURRENCY);
  });

  it("accepts USD", () => {
    expect(validateCreditRequest({ ...validRequest, currency: "USD" })).toBeNull();
  });

  it("accepts EUR", () => {
    expect(validateCreditRequest({ ...validRequest, currency: "EUR" })).toBeNull();
  });
});

// ===========================================================================
// 4. Request Validation — reason
// ===========================================================================

describe("validateCreditRequest — reason validation", () => {
  it("rejects missing reason", () => {
    expect(validateCreditRequest({ ...validRequest, reason: undefined })).toBe(ErrorCode.INVALID_REASON);
  });

  it("rejects non-string reason", () => {
    expect(validateCreditRequest({ ...validRequest, reason: 42 })).toBe(ErrorCode.INVALID_REASON);
  });

  it("rejects empty reason", () => {
    expect(validateCreditRequest({ ...validRequest, reason: "" })).toBe(ErrorCode.INVALID_REASON);
  });

  it("rejects whitespace-only reason", () => {
    expect(validateCreditRequest({ ...validRequest, reason: "     " })).toBe(ErrorCode.INVALID_REASON);
  });

  it("rejects reason < 5 characters", () => {
    expect(validateCreditRequest({ ...validRequest, reason: "Hi" })).toBe(ErrorCode.INVALID_REASON);
  });

  it("rejects reason > 200 characters", () => {
    expect(validateCreditRequest({ ...validRequest, reason: "A".repeat(201) })).toBe(ErrorCode.INVALID_REASON);
  });

  it("accepts reason of exactly 5 characters", () => {
    expect(validateCreditRequest({ ...validRequest, reason: "Short" })).toBeNull();
  });

  it("accepts reason of exactly 200 characters", () => {
    expect(validateCreditRequest({ ...validRequest, reason: "A".repeat(200) })).toBeNull();
  });
});

// ===========================================================================
// 5. Request Validation — reference
// ===========================================================================

describe("validateCreditRequest — reference validation", () => {
  it("rejects missing reference", () => {
    expect(validateCreditRequest({ ...validRequest, reference: undefined })).toBe(ErrorCode.INVALID_REFERENCE);
  });

  it("rejects non-string reference", () => {
    expect(validateCreditRequest({ ...validRequest, reference: 42 })).toBe(ErrorCode.INVALID_REFERENCE);
  });

  it("rejects empty reference", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "" })).toBe(ErrorCode.INVALID_REFERENCE);
  });

  it("rejects reference with spaces", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "CR 2026 0001" })).toBe(ErrorCode.INVALID_REFERENCE_FORMAT);
  });

  it("rejects reference with slashes", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "CR/2026/0001" })).toBe(ErrorCode.INVALID_REFERENCE_FORMAT);
  });

  it("rejects reference with special characters", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "CR@2026#0001" })).toBe(ErrorCode.INVALID_REFERENCE_FORMAT);
  });

  it("rejects reference > 100 characters", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "A".repeat(101) })).toBe(ErrorCode.INVALID_REFERENCE_FORMAT);
  });

  it("rejects reference starting with dash", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "-CR-2026" })).toBe(ErrorCode.INVALID_REFERENCE_FORMAT);
  });

  it("accepts alphanumeric reference with dashes", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "CR-20261127-0001" })).toBeNull();
  });

  it("accepts alphanumeric reference with underscores", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "CR_20261127_0001" })).toBeNull();
  });

  it("accepts purely numeric reference", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "123456" })).toBeNull();
  });
});

// ===========================================================================
// 6. Idempotency Key Validation
// ===========================================================================

describe("validateIdempotencyKey", () => {
  it("accepts a valid UUID v4", () => {
    expect(validateIdempotencyKey(validUUID)).toBe(true);
  });

  it("accepts lowercase UUID", () => {
    expect(validateIdempotencyKey(validUUID.toLowerCase())).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateIdempotencyKey("")).toBe(false);
  });

  it("rejects non-UUID string", () => {
    expect(validateIdempotencyKey("not-a-uuid")).toBe(false);
  });

  it("rejects a string with slashes (Firestore path injection)", () => {
    expect(validateIdempotencyKey("550e8400/e29b/41d4/a716/446655440000")).toBe(false);
  });

  it("rejects a string with spaces", () => {
    expect(validateIdempotencyKey("550e8400 e29b 41d4 a716 446655440000")).toBe(false);
  });

  it("rejects a UUID with extra characters", () => {
    expect(validateIdempotencyKey(validUUID + "extra")).toBe(false);
  });

  it("rejects a UUID missing segments", () => {
    expect(validateIdempotencyKey("550e8400-e29b-41d4-a716")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(validateIdempotencyKey(123 as unknown as string)).toBe(false);
    expect(validateIdempotencyKey(null as unknown as string)).toBe(false);
    expect(validateIdempotencyKey(undefined as unknown as string)).toBe(false);
  });

  it("rejects a UUID with invalid hex characters", () => {
    expect(validateIdempotencyKey("550e8400-e29b-41d4-a716-44665544gggg")).toBe(false);
  });
});

// ===========================================================================
// 7. Monetary Precision
// ===========================================================================

describe("toMinorUnits", () => {
  it("converts 12.34 USD to 1234 cents", () => {
    expect(toMinorUnits(12.34, "USD")).toBe(1234);
  });

  it("converts 0.01 USD to 1 cent", () => {
    expect(toMinorUnits(0.01, "USD")).toBe(1);
  });

  it("converts 100 USD to 10000 cents", () => {
    expect(toMinorUnits(100, "USD")).toBe(10000);
  });

  it("converts 99.99 EUR to 9999 cents", () => {
    expect(toMinorUnits(99.99, "EUR")).toBe(9999);
  });

  it("converts 0 USD to 0 cents", () => {
    expect(toMinorUnits(0, "USD")).toBe(0);
  });

  it("returns null for amount with too many decimal places (0.001 USD)", () => {
    expect(toMinorUnits(0.001, "USD")).toBeNull();
  });

  it("returns null for amount with too many decimal places (100.999 USD)", () => {
    expect(toMinorUnits(100.999, "USD")).toBeNull();
  });

  it("returns null for unsupported currency", () => {
    expect(toMinorUnits(100, "GBP")).toBeNull();
  });

  it("handles the 0.1 + 0.2 problem correctly (0.1 → 10 cents)", () => {
    // 0.1 in floating point is 0.1000000000000000055511151231257827021181583404541015625
    // Math.round(0.1 * 100) = 10 (correct)
    expect(toMinorUnits(0.1, "USD")).toBe(10);
  });

  it("handles the 0.2 problem correctly (0.2 → 20 cents)", () => {
    expect(toMinorUnits(0.2, "USD")).toBe(20);
  });

  it("handles 0.1 + 0.2 via minor units correctly (0.3 → 30 cents, not 0.30000000000000004)", () => {
    const ten = toMinorUnits(0.1, "USD")!;
    const twenty = toMinorUnits(0.2, "USD")!;
    const thirty = ten + twenty;
    expect(thirty).toBe(30);
    expect(fromMinorUnits(thirty, "USD")).toBe(0.3);
  });
});

describe("fromMinorUnits", () => {
  it("converts 1234 cents to 12.34 USD", () => {
    expect(fromMinorUnits(1234, "USD")).toBe(12.34);
  });

  it("converts 1 cent to 0.01 USD", () => {
    expect(fromMinorUnits(1, "USD")).toBe(0.01);
  });

  it("converts 10000 cents to 100 USD", () => {
    expect(fromMinorUnits(10000, "USD")).toBe(100);
  });

  it("converts 0 cents to 0 USD", () => {
    expect(fromMinorUnits(0, "USD")).toBe(0);
  });
});

describe("Monetary precision — round-trip", () => {
  it("round-trips a typical balance (24532.80 → 2453280 → 24532.80)", () => {
    const balance = 24532.80;
    const minor = toMinorUnits(balance, "USD")!;
    const restored = fromMinorUnits(minor, "USD");
    expect(minor).toBe(2453280);
    expect(restored).toBe(24532.80);
  });

  it("round-trips a small balance (0.50)", () => {
    const minor = toMinorUnits(0.50, "USD")!;
    expect(fromMinorUnits(minor, "USD")).toBe(0.50);
  });

  it("round-trips a large balance (999999.99)", () => {
    const minor = toMinorUnits(999999.99, "USD")!;
    expect(fromMinorUnits(minor, "USD")).toBe(999999.99);
  });

  it("does NOT silently round invalid amounts (0.001 returns null)", () => {
    expect(toMinorUnits(0.001, "USD")).toBeNull();
  });
});

// ===========================================================================
// 8. SHA-256 Reference Lock Hash
// ===========================================================================

describe("sha256Hex", () => {
  it("produces a deterministic 64-character hex string", async () => {
    const hash = await sha256Hex("CR-20261127-0001");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same hash for the same input", async () => {
    const hash1 = await sha256Hex("CR-20261127-0001");
    const hash2 = await sha256Hex("CR-20261127-0001");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await sha256Hex("CR-20261127-0001");
    const hash2 = await sha256Hex("CR-20261127-0002");
    expect(hash1).not.toBe(hash2);
  });

  it("produces a hash with no slashes (Firestore-safe document ID)", async () => {
    const hash = await sha256Hex("CR/2026/0001");
    expect(hash).not.toContain("/");
  });

  it("produces a known hash for a known input", async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const hash = await sha256Hex("");
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

// ===========================================================================
// 9. Valid request — integration of all validation
// ===========================================================================

describe("validateCreditRequest — valid requests", () => {
  it("accepts a well-formed USD request", () => {
    expect(validateCreditRequest(validRequest)).toBeNull();
  });

  it("accepts a well-formed EUR request", () => {
    expect(validateCreditRequest({ ...validRequest, currency: "EUR" })).toBeNull();
  });

  it("accepts a request with maximum amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 1_000_000 })).toBeNull();
  });

  it("accepts a request with minimum amount", () => {
    expect(validateCreditRequest({ ...validRequest, amount: 0.01 })).toBeNull();
  });
});

// ===========================================================================
// 10. Security invariants
// ===========================================================================

describe("Security invariants", () => {
  it("rejects all non-USD/EUR currencies", () => {
    for (const cur of ["NGN", "GBP", "GHS", "KES", "ZAR", "JPY", "CAD", "AUD"]) {
      expect(validateCreditRequest({ ...validRequest, currency: cur })).toBe(ErrorCode.INVALID_CURRENCY);
    }
  });

  it("rejects all amounts > 1,000,000", () => {
    for (const amt of [1_000_001, 5_000_000, 100_000_000]) {
      expect(validateCreditRequest({ ...validRequest, amount: amt })).toBe(ErrorCode.INVALID_AMOUNT);
    }
  });

  it("rejects amounts with > 2 decimal places", () => {
    for (const amt of [0.001, 0.999, 100.001, 1.234]) {
      expect(validateCreditRequest({ ...validRequest, amount: amt })).toBe(ErrorCode.AMOUNT_PRECISION_EXCEEDED);
    }
  });

  it("rejects Firestore path injection in customerId", () => {
    expect(validateCreditRequest({ ...validRequest, customerId: "../etc/passwd" })).toBe(ErrorCode.INVALID_CUSTOMER);
  });

  it("rejects Firestore path injection in accountId", () => {
    expect(validateCreditRequest({ ...validRequest, accountId: "acc/../../../etc" })).toBe(ErrorCode.INVALID_ACCOUNT);
  });

  it("rejects Firestore path injection in reference", () => {
    expect(validateCreditRequest({ ...validRequest, reference: "CR/2026/0001" })).toBe(ErrorCode.INVALID_REFERENCE_FORMAT);
  });

  it("rejects Firestore path injection in idempotency key", () => {
    expect(validateIdempotencyKey("550e8400/e29b/41d4/a716/446655440000")).toBe(false);
  });
});
