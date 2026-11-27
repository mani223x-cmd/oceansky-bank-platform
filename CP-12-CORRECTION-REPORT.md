# CP-12 Correction Report — Security & Transaction Fixes

**Date:** 2026-11-27
**Status:** Corrected, tested, documented. Not deployed.
**GitHub push:** Manual (not automatic)

---

## What Was Corrected

Seven issues identified in the original CP-12 implementation have been fixed:

### 1. Atomic Reference Uniqueness (FIXED)
**Before:** Reference uniqueness was checked via a non-transactional `queryByField`
call BEFORE the transaction — two simultaneous credits with the same reference
could both pass the check.

**After:** A dedicated `bank/data/reference_locks/{sha256(reference)}` document
is created WITHIN the same Firestore transaction using `currentDocument: { exists: false }`.
If two admins try the same reference simultaneously:
- The first commit creates the lock document.
- The second commit's `exists: false` precondition fails → ABORTED → the
  transaction is retried, which re-reads the lock document, finds it exists,
  and rejects with `DUPLICATE_REFERENCE`.

The lock, account update, transaction record, audit record, and idempotency
record are all in the same 5-write atomic commit.

### 2. Idempotency Protection (FIXED)
**Before:** Idempotency was checked OUTSIDE the transaction via a `getDoc`
call. If the commit succeeded but the HTTP response was lost (network error),
a retry would not find the idempotency document (it was written in the
successful commit, but the check was non-transactional) → potential double credit.

**After:** Idempotency verification is moved INTO the transaction:
- The idempotency document is read within the transaction (READ 1).
- If it exists AND the stored request payload matches the new request → the
  cached response is returned without re-crediting (no commit).
- If it exists but the payload differs → rejected with `IDEMPOTENCY_PAYLOAD_MISMATCH`.
- If it doesn't exist → the transaction proceeds, creating the idempotency
  document with `exists: false` precondition as part of the atomic commit.

**Lost commit-response recovery:** If the commit succeeds but the response is
lost, the client retries with the same key. The new transaction reads the
idempotency document (which now exists from the successful commit), finds the
payload matches, and returns the cached response — no double credit.

**Key format validation:** The `X-Idempotency-Key` header is validated against
a strict UUID v4 regex. This prevents unsafe Firestore document paths (slashes,
spaces, special characters).

### 3. Monetary Precision (FIXED)
**Before:** Balance arithmetic used floating-point directly:
`newBalance = currentBalance + body.amount` — susceptible to `0.1 + 0.2 ≠ 0.3`.

**After:** All monetary arithmetic is done in integer minor units (cents):
- `toMinorUnits(amount, currency)` converts `12.34 USD` → `1234` (integer).
- `fromMinorUnits(minor, currency)` converts back to `12.34` (float for storage).
- The amount is validated for precision — amounts with more than 2 decimal
  places are rejected with `AMOUNT_PRECISION_EXCEEDED` (no silent rounding).
- Existing account balances are validated as finite numbers before calculation.
- The stored balance format remains a float — no migration required.

### 4. Request Validation (FIXED)
**Before:** Validation didn't handle null bodies, arrays, oversized strings,
invalid ID formats, or non-finite numbers. Could throw uncaught exceptions.

**After:** The `validateCreditRequest` function accepts `unknown` input and
validates robustly:
- Null / undefined / array / non-object bodies → `INVALID_BODY`
- Missing or wrong-typed fields → appropriate error codes
- Empty strings → rejected
- Oversized strings (customerId > 128, reference > 100, reason > 200) → rejected
- Non-finite numbers (NaN, Infinity) → `INVALID_AMOUNT`
- Invalid ID formats (slashes, special chars) → rejected (Firestore path safety)
- Invalid reference format → `INVALID_REFERENCE_FORMAT`
- Invalid idempotency key format → `INVALID_IDEMPOTENCY_KEY`
- Amount precision exceeded → `AMOUNT_PRECISION_EXCEEDED`

No malformed input can cause an uncaught exception.

### 5. Firestore Transaction Correctness (FIXED)
- All three reads (idempotency, account, reference lock) use the SAME
  transaction ID from `beginTransaction`.
- The account update uses `currentDocument: { updateTime }` precondition from
  the transactional read — prevents lost updates.
- All create writes use `currentDocument: { exists: false }` — prevents overwrites.
- Retries re-read everything in a NEW transaction — no bypass of uniqueness
  or idempotency checks.
- All document paths stay within `bank/data/` namespace.
- The `toFirestoreFields` helper was added to fix a bug where `toFirestoreValue`
  was used for the top-level document fields (it wraps in `mapValue` instead of
  producing the flat fields map expected by the commit API).

### 6. Audit Integrity (PRESERVED)
The audit log record is unchanged — it identifies:
- administrator (uid, email)
- target customer (customerId)
- target account (accountId)
- amount and currency
- reason
- transaction reference
- transaction ID
- previous and new balance
- reference lock ID
- timestamp

### 7. Testing (EXPANDED)
122 tests total (up from 69 in original CP-12):

- **101 unit tests** in `test/credit-account.test.ts`:
  - Malformed inputs (null, array, string, number, boolean bodies)
  - Missing/wrong-typed fields
  - Amount validation (zero, negative, NaN, Infinity, max exceeded, precision)
  - Currency validation (unsupported, lowercase, missing)
  - Reason validation (empty, short, long, whitespace)
  - Reference validation (empty, spaces, slashes, special chars, too long)
  - Idempotency key validation (UUID format, slashes, non-UUID, non-string)
  - Monetary precision (toMinorUnits, fromMinorUnits, round-trip, 0.1+0.2)
  - SHA-256 hash (deterministic, different inputs, Firestore-safe)
  - Security invariants (path injection, all unsupported currencies)

- **21 mock-based transaction tests** in `test/credit-transaction.test.ts`:
  - Successful credit (5 writes, correct preconditions)
  - Idempotency cache hit (returns cached response, no commit)
  - Idempotency payload mismatch (rejects, no commit)
  - Account not found
  - Account owner mismatch
  - Account frozen/inactive
  - Currency mismatch
  - Account balance corrupted (string, NaN, Infinity)
  - Self-credit prevention
  - Duplicate reference (reference lock exists)
  - Transaction conflict (ABORTED propagation)
  - Lost commit response recovery (cached response on retry)
  - Atomicity (single commit with 5 writes, correct preconditions)
  - updateTime precondition from read
  - exists:false on reference lock + idempotency
  - Idempotency document stores full request payload

---

## Files Changed

| File | Action | Summary |
| --- | --- | --- |
| worker/src/types.ts | Modified | Added 6 new error codes: INVALID_IDEMPOTENCY_KEY, IDEMPOTENCY_PAYLOAD_MISMATCH, ACCOUNT_CORRUPTED, INVALID_REFERENCE, INVALID_REFERENCE_FORMAT, INVALID_BODY, AMOUNT_PRECISION_EXCEEDED |
| worker/src/routes/credit-account.ts | Rewritten | Full rewrite with all 7 corrections: atomic reference lock, transactional idempotency, integer monetary precision, robust validation, 5-write atomic commit, toFirestoreFields fix |
| worker/test/credit-account.test.ts | Rewritten | 101 unit tests for validation, monetary precision, idempotency, hashing |
| worker/test/credit-transaction.test.ts | New | 21 mock-based tests for the full transaction flow |
| worker/test/vitest.d.ts | New | TypeScript type declaration for Workers vitest pool |

---

## Test Results

```
Worker TypeScript: 0 errors (tsc --noEmit clean)
Worker Tests: 122 passed (122) across 2 test files
  - credit-account.test.ts: 101 tests (unit)
  - credit-transaction.test.ts: 21 tests (mocked transaction flow)
Frontend ESLint: 0 errors, 2 warnings (pre-existing in worker/)
Duration: ~0.6s
```

---

## Remaining Limitations

1. **Integration testing with real Firestore** is not performed in unit tests.
   The mock-based tests verify the transaction LOGIC (read order, preconditions,
   write structure) but not the actual Firestore REST API calls. Integration
   testing requires `wrangler dev` + real Firebase service account credentials.

2. **End-to-end flow requires Firebase Auth (CP-3)** — the frontend still uses
   mock authentication. The Worker will reject mock tokens (correct behavior).

3. **Token revocation limitation (from CP-11)** — Firebase ID tokens are valid
   for 1 hour regardless of sign-out.

4. **Reference lock cleanup** — lock documents are never automatically deleted.
   They are small (4 fields) and serve as a permanent uniqueness record. A
   cleanup script could remove locks for reversed/failed transactions if needed.

---

## Security Verification

| Requirement | Status |
| --- | --- |
| No browser-side balance writes | ✅ Worker performs all writes |
| Admin auth via verified Firebase claims | ✅ Token verified cryptographically |
| Self-credit prevention | ✅ Server-side uid comparison + UI disable |
| Idempotency prevents double credits | ✅ Transactional read + exists:false write |
| Atomic reference uniqueness | ✅ SHA-256 lock document in same transaction |
| Integer monetary precision | ✅ Minor-unit arithmetic, no float errors |
| No silent rounding | ✅ Precision exceeded → rejected |
| Robust request validation | ✅ Null/array/oversized/non-finite all handled |
| No Firestore path injection | ✅ ID/reference/key format validation |
| Audit trail preserved | ✅ Full audit record in every credit |
| No service account secrets in frontend | ✅ Worker secrets only |
| No fake success responses | ✅ Errors returned when service not configured |
| All paths within bank/data/ namespace | ✅ Verified |

---

## Deployment Status

**Nothing was deployed.** No Git history was modified. No commits or pushes.

Extract the ZIP into your existing local project, overwriting the 5 files.
Run `cd worker && npm test` to verify all 122 tests pass locally.
