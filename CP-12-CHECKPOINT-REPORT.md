# CP-12 Checkpoint Report — Admin Credit Account

**Checkpoint:** CP-12
**Date:** 2026-11-27
**Status:** Implemented, tested, documented. Not deployed.
**GitHub push:** Manual (not automatic)
**Vercel deploy:** N/A (Worker deploys to Cloudflare separately)

---

## What Was Implemented

A secure Admin Credit Account feature that allows an authorized administrator
to credit a customer's OceanSky account balance through an internal simulated
banking ledger operation. The feature consists of:

1. **Worker endpoint POST /api/admin/credit-account** — a secure server-side
   handler that verifies the Firebase ID token, checks the admin custom claim,
   validates all inputs, and performs an atomic Firestore transaction that
   updates the account balance, creates a transaction record, creates an audit
   log entry, and stores an idempotency key — all in a single atomic commit.

2. **Worker endpoint GET /api/admin/customers/:customerId/accounts** — returns
   a customer's accounts to the admin (cross-customer read that Firestore rules
   would block from the client side).

3. **Frontend adminService.creditAccount + listCustomerAccounts** — service
   methods that call the Worker endpoints. No direct Firestore writes from the
   browser.

4. **CreditAccount.tsx** — a premium admin UI page with a 4-step flow:
   customer search, account selection, credit details, and success/receipt.

5. **Sidebar entry + dashboard quick action** — navigation integration.

---

## Files Created (4 new files)

- worker/src/routes/credit-account.ts — POST /api/admin/credit-account handler
  with atomic Firestore transaction, idempotency, audit trail, 17-step
  validation, and one retry on transaction conflict.
- worker/src/routes/customer-accounts.ts — GET /api/admin/customers/:id/accounts
  handler for admin cross-customer account reads.
- worker/test/credit-account.test.ts — 25 unit tests for the validation logic
  (amount, currency, reason, reference, edge cases, security invariants).
- src/components/admin/admin/CreditAccount.tsx — the admin credit UI page
  (customer search, account selection, credit form, review/confirm, receipt).

## Files Modified (7 existing files)

- worker/src/firestore-rest.ts — added beginTransaction, getDocInTransaction,
  commit, and docPath methods to FirestoreClient for atomic transactions.
- worker/src/index.ts — added the two new routes (exact + pattern matching
  for path parameters), updated the router to support :param segments.
- src/lib/types/index.ts — added admin_credit to TxnType, added
  CreditAccountPayload, CreditAccountResult, AdminAccountSummary types.
- src/lib/services/index.ts — added adminService.creditAccount and
  adminService.listCustomerAccounts methods that call the Worker endpoints.
  Added useAuthStore import for admin token access.
- src/components/admin/AdminApp.tsx — added credit-account route to
  renderAdminView, imported AdminCreditAccount component.
- src/components/admin/AdminSidebar.tsx — added "Credit Account" nav item
  under Banking section with Banknote icon.
- src/components/admin/admin/Dashboard.tsx — added "Credit account" quick
  action button (grid expanded from 3 to 4 columns).

---

## Test Results

### Worker Tests
  Test Files  6 passed (6)
       Tests  69 passed (69)
    Duration  1.25s
  TypeScript: 0 errors (tsc --noEmit clean)

New tests added in CP-12:
- test/credit-account.test.ts: 25 tests covering:
  - Valid requests (USD, EUR, boundary amounts, boundary reason length)
  - Invalid customer/account/currency/amount/reason/reference
  - Security invariants (max amount, unsupported currencies)

### Frontend
  ESLint: 0 errors, 2 warnings (both pre-existing in worker/ directory)
  Dev server: HTTP 200
  Browser verification: Credit Account page renders with sidebar entry,
    page header, customer search, step indicator — all functional.

---

## Security Implementation

1. **No browser-side balance writes** — the adminService.creditAccount method
   calls the Worker endpoint. The Worker performs all Firestore writes
   server-side using a service account.

2. **Admin authorization via verified Firebase claims** — the Worker verifies
   the Firebase ID token cryptographically (signature + issuer + audience +
   expiration via jose + Google x509 certs). The admin: true custom claim is
   read ONLY from the verified token payload, never from localStorage or the
   request body.

3. **Self-credit prevention** — the Worker checks admin.uid !== customerId
   and returns SELF_CREDIT_FORBIDDEN (403) if they match. The UI also
   disables the admin's own entry in the customer list.

4. **Idempotency** — the client generates a UUID (X-Idempotency-Key header).
   The Worker checks bank/data/idempotency_keys/{key} before processing. If
   it exists, the cached response is returned without re-processing. The
   idempotency key document is created within the same atomic transaction.

5. **Atomic Firestore transaction** — the entire operation (account balance
   update + transaction record + audit log + idempotency key) is committed
   in a single Firestore transaction via the REST API's beginTransaction +
   batchGet + commit flow. If any write fails, the entire commit is rolled
   back. The transaction includes a retry on ABORTED (concurrent modification).

6. **Audit trail** — each credit creates an immutable audit log entry in
   bank/data/audit_logs containing: admin ID, admin email, customer ID,
   account ID, amount, currency, reason, reference, transaction ID, previous
   balance, new balance, and timestamp.

7. **No service account secrets in frontend code** — the Worker reads
   FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY from Cloudflare Worker
   secrets (set via wrangler secret put). The frontend only sends the
   Firebase ID token — it never sees the service account.

8. **No fake success** — if NEXT_PUBLIC_WORKER_URL is not set or the admin
   token is missing, adminService.creditAccount returns a clear error
   (SERVICE_NOT_CONFIGURED or AUTH_NOT_READY). No mock transaction is
   presented as a real database operation.

---

## Honest Limitations

1. **End-to-end flow requires Firebase Auth integration (CP-3).** The frontend
   currently uses mock authentication (adminToken is a mock string, not a real
   Firebase ID token). The Worker will reject mock tokens because the JWT
   signature won't match Google's public keys. This is the CORRECT behavior —
   the Worker is the security boundary. When CP-3 integrates Firebase Auth,
   the adminToken will be a real Firebase ID token and the credit operation
   will work end-to-end.

2. **Customer search and account listing use the existing mock service.** In
   the current environment (no Firebase), the CreditAccount UI loads customers
   from adminService.listCustomers() (mock) and accounts from
   accountService.listByUser() (mock). When Firebase is integrated, the
   adminService.listCustomerAccounts method will call the Worker instead.

3. **The actual Firestore transaction has not been integration-tested** with
   real Firebase credentials. Unit tests verify the validation logic. The
   transaction logic (beginTransaction + batchGet + commit) follows the
   Firestore REST API specification but requires wrangler dev + real service
   account credentials to test end-to-end.

4. **Reference uniqueness check is non-atomic.** The Worker queries for
   existing transactions with the same reference BEFORE the transaction. In
   the extremely rare case of two simultaneous credits with the same
   reference, both could pass the check. The idempotency key (which IS atomic)
   prevents duplicate processing of the same request, but not two different
   requests with the same reference. A Firestore unique constraint or a
   pre-transaction create with currentDocument.exists=false on the reference
   would fix this (future hardening).

5. **Token revocation limitation (from CP-11).** Firebase ID tokens are valid
   for 1 hour regardless of sign-out. The Worker checks expiration only.

---

## Manual Configuration Required

### Before the credit feature works end-to-end:

1. **CP-3 (Firebase Auth integration)** must be completed so the frontend
   produces real Firebase ID tokens.

2. **NEXT_PUBLIC_WORKER_URL** must be set in Vercel environment variables,
   pointing to the deployed Cloudflare Worker URL.

3. **Admin custom claims** must be set on admin users via the Firebase Admin
   SDK script (CP-9).

4. **Cloudflare Worker must be deployed** (CP-11 deployment step):
   - wrangler secret put FIREBASE_CLIENT_EMAIL
   - wrangler secret put FIREBASE_PRIVATE_KEY
   - npm run deploy (in worker/)

5. **Firestore security rules** must include the idempotency_keys collection:
   match /bank/data/idempotency_keys/{keyId} {
     allow read, write: if false;  // Worker only
   }

---

## Deployment Status

**Nothing was deployed.**
- The Cloudflare Worker was not deployed.
- The Vercel frontend was not deployed.
- No Firebase rules were published.
- No paid services were activated.
- No Git history was modified.

The code is ready for review. Extract the ZIP into your existing local project,
review the changes, and commit/push when ready.
