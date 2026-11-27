// ============================================================================
// Tests: Admin Transaction History — Query Parameter Validation
// ============================================================================
// Unit tests for the query parameter validation functions in the transactions
// route. These test the PURE validation logic without requiring real Firebase
// credentials or a real Firestore instance.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  validatePaginationParams,
  validateSearchParam,
  validateTypeFilter,
  validateStatusFilter,
  validateDateRange,
} from "../src/routes/transactions";
import { ErrorCode } from "../src/types";

// ===========================================================================
// Pagination validation
// ===========================================================================

describe("validatePaginationParams", () => {
  it("returns defaults for null page and pageSize", () => {
    const result = validatePaginationParams(null, null);
    expect("error" in result).toBe(false);
    expect((result as { page: number; pageSize: number }).page).toBe(1);
    expect((result as { page: number; pageSize: number }).pageSize).toBe(20);
  });

  it("accepts valid page and pageSize", () => {
    const result = validatePaginationParams("2", "50");
    expect("error" in result).toBe(false);
    expect((result as { page: number; pageSize: number }).page).toBe(2);
    expect((result as { page: number; pageSize: number }).pageSize).toBe(50);
  });

  it("rejects page = 0", () => {
    const result = validatePaginationParams("0", "20");
    expect("error" in result).toBe(true);
    expect((result as { error: string; code: string }).code).toBe(ErrorCode.INVALID_PAGINATION);
  });

  it("rejects negative page", () => {
    const result = validatePaginationParams("-1", "20");
    expect("error" in result).toBe(true);
    expect((result as { error: string; code: string }).code).toBe(ErrorCode.INVALID_PAGINATION);
  });

  it("rejects non-numeric page", () => {
    const result = validatePaginationParams("abc", "20");
    expect("error" in result).toBe(true);
    expect((result as { error: string; code: string }).code).toBe(ErrorCode.INVALID_PAGINATION);
  });

  it("rejects pageSize = 0", () => {
    const result = validatePaginationParams("1", "0");
    expect("error" in result).toBe(true);
  });

  it("rejects pageSize > 100", () => {
    const result = validatePaginationParams("1", "101");
    expect("error" in result).toBe(true);
    expect((result as { error: string; code: string }).code).toBe(ErrorCode.INVALID_PAGINATION);
  });

  it("rejects non-numeric pageSize", () => {
    const result = validatePaginationParams("1", "xyz");
    expect("error" in result).toBe(true);
  });

  it("accepts pageSize = 100 (maximum)", () => {
    const result = validatePaginationParams("1", "100");
    expect("error" in result).toBe(false);
    expect((result as { page: number; pageSize: number }).pageSize).toBe(100);
  });

  it("accepts pageSize = 1 (minimum)", () => {
    const result = validatePaginationParams("1", "1");
    expect("error" in result).toBe(false);
    expect((result as { page: number; pageSize: number }).pageSize).toBe(1);
  });
});

// ===========================================================================
// Search validation
// ===========================================================================

describe("validateSearchParam", () => {
  it("returns null for null input", () => {
    expect(validateSearchParam(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(validateSearchParam("")).toBeNull();
  });

  it("accepts alphanumeric with dashes", () => {
    expect(validateSearchParam("CR-20261127-0001")).toBe("CR-20261127-0001");
  });

  it("accepts a UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(validateSearchParam(uuid)).toBe(uuid);
  });

  it("returns null for search with spaces", () => {
    expect(validateSearchParam("CR 2026 0001")).toBeNull();
  });

  it("returns null for search with slashes (injection)", () => {
    expect(validateSearchParam("CR/2026/0001")).toBeNull();
  });

  it("returns null for search with special characters", () => {
    expect(validateSearchParam("CR@2026#0001")).toBeNull();
  });

  it("returns null for search > 100 characters", () => {
    expect(validateSearchParam("A".repeat(101))).toBeNull();
  });

  it("returns null for search starting with dash", () => {
    expect(validateSearchParam("-CR-2026")).toBeNull();
  });

  it("accepts numeric search (customer ID)", () => {
    expect(validateSearchParam("usr_001")).toBe("usr_001");
  });
});

// ===========================================================================
// Type filter validation
// ===========================================================================

describe("validateTypeFilter", () => {
  it("returns null for null", () => {
    expect(validateTypeFilter(null)).toBeNull();
  });

  it("returns null for 'all'", () => {
    expect(validateTypeFilter("all")).toBeNull();
  });

  it("accepts 'credit'", () => {
    expect(validateTypeFilter("credit")).toBe("credit");
  });

  it("accepts 'admin_credit'", () => {
    expect(validateTypeFilter("admin_credit")).toBe("admin_credit");
  });

  it("accepts 'transfer_in'", () => {
    expect(validateTypeFilter("transfer_in")).toBe("transfer_in");
  });

  it("accepts 'bill_payment'", () => {
    expect(validateTypeFilter("bill_payment")).toBe("bill_payment");
  });

  it("returns null for invalid type", () => {
    expect(validateTypeFilter("wire_transfer")).toBeNull();
  });

  it("returns null for injection attempt", () => {
    expect(validateTypeFilter("credit'; DROP TABLE--")).toBeNull();
  });
});

// ===========================================================================
// Status filter validation
// ===========================================================================

describe("validateStatusFilter", () => {
  it("returns null for null", () => {
    expect(validateStatusFilter(null)).toBeNull();
  });

  it("returns null for 'all'", () => {
    expect(validateStatusFilter("all")).toBeNull();
  });

  it("accepts 'success'", () => {
    expect(validateStatusFilter("success")).toBe("success");
  });

  it("accepts 'pending'", () => {
    expect(validateStatusFilter("pending")).toBe("pending");
  });

  it("accepts 'failed'", () => {
    expect(validateStatusFilter("failed")).toBe("failed");
  });

  it("accepts 'reversed'", () => {
    expect(validateStatusFilter("reversed")).toBe("reversed");
  });

  it("returns null for invalid status", () => {
    expect(validateStatusFilter("cancelled")).toBeNull();
  });
});

// ===========================================================================
// Date range validation
// ===========================================================================

describe("validateDateRange", () => {
  it("returns empty object for null dates", () => {
    const result = validateDateRange(null, null);
    expect("error" in result).toBe(false);
    expect(result).toEqual({});
  });

  it("accepts valid fromDate (YYYY-MM-DD)", () => {
    const result = validateDateRange("2026-11-01", null);
    expect("error" in result).toBe(false);
    expect((result as { from: string }).from).toBe("2026-11-01T00:00:00.000Z");
  });

  it("accepts valid toDate (YYYY-MM-DD)", () => {
    const result = validateDateRange(null, "2026-11-30");
    expect("error" in result).toBe(false);
    expect((result as { to: string }).to).toBe("2026-11-30T23:59:59.999Z");
  });

  it("accepts valid full ISO dates", () => {
    const result = validateDateRange(
      "2026-11-01T10:00:00.000Z",
      "2026-11-30T18:00:00.000Z"
    );
    expect("error" in result).toBe(false);
  });

  it("rejects invalid fromDate format", () => {
    const result = validateDateRange("November 1, 2026", null);
    expect("error" in result).toBe(true);
    expect((result as { error: string; code: string }).code).toBe(ErrorCode.INVALID_DATE_RANGE);
  });

  it("rejects invalid toDate format", () => {
    const result = validateDateRange(null, "2026/11/30");
    expect("error" in result).toBe(true);
  });

  it("rejects fromDate > toDate", () => {
    const result = validateDateRange("2026-11-30", "2026-11-01");
    expect("error" in result).toBe(true);
    expect((result as { error: string; code: string }).code).toBe(ErrorCode.INVALID_DATE_RANGE);
  });

  it("accepts fromDate == toDate", () => {
    const result = validateDateRange("2026-11-15", "2026-11-15");
    expect("error" in result).toBe(false);
  });

  it("rejects injection attempt in fromDate", () => {
    const result = validateDateRange("2026-11-01'; DROP TABLE--", null);
    expect("error" in result).toBe(true);
  });

  it("rejects malformed date with extra characters", () => {
    const result = validateDateRange("2026-11-01T10:00:00.000Zextra", null);
    expect("error" in result).toBe(true);
  });
});

// ===========================================================================
// Security invariants
// ===========================================================================

describe("Security invariants", () => {
  it("all valid transaction types are accepted", () => {
    const validTypes = [
      "credit", "debit", "transfer_in", "transfer_out",
      "bill_payment", "airtime", "data", "card_payment",
      "fee", "interest", "salary", "refund", "admin_credit",
    ];
    for (const type of validTypes) {
      expect(validateTypeFilter(type)).toBe(type);
    }
  });

  it("all invalid types are rejected (null returned)", () => {
    const invalidTypes = [
      "wire", "ach", "swift", "check", "cash",
      "CREDIT", "Credit", "credit;", "credit OR 1=1",
    ];
    for (const type of invalidTypes) {
      expect(validateTypeFilter(type)).toBeNull();
    }
  });

  it("search with slashes is always rejected (Firestore path safety)", () => {
    expect(validateSearchParam("bank/data/transactions/123")).toBeNull();
    expect(validateSearchParam("../etc/passwd")).toBeNull();
    expect(validateSearchParam("a/b/c")).toBeNull();
  });
});
