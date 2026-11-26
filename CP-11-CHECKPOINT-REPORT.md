# CP-11 Checkpoint Report — Cloudflare Worker Foundation

**Checkpoint:** CP-11
**Date:** 2026-11-27
**Status:** Implemented, tested, documented. Not deployed.
**GitHub push:** Manual (not automatic)
**Vercel deploy:** N/A (Worker deploys to Cloudflare, not Vercel)

---

## What Was Implemented

The Cloudflare Worker foundation for OceanSky Bank privileged banking
operations. The Worker runs on Cloudflare's free tier (100K requests/day)
and provides:

1. Firebase ID token verification — cryptographic verification using
   Google's published x509 certificates via the jose library.
2. Admin authorization enforcement — admin: true claim read ONLY from
   the cryptographically verified token payload. Never localStorage.
3. Firestore REST API client — server-side access via service account
   OAuth2 token. Includes value encoding/decoding. Ready for CP-12.
4. Strict CORS enforcement — only the configured Vercel origin allowed.
5. Two endpoints: GET /api/health, GET /api/admin/verify
6. ServiceResult envelope — matches the frontend's existing contract.

---

## Files Created (25 new files)

### Worker configuration (8)
- worker/package.json
- worker/package-lock.json
- worker/wrangler.toml
- worker/tsconfig.json
- worker/vitest.config.ts
- worker/postcss.config.js
- worker/.gitignore
- worker/.dev.vars.example

### Worker source (10)
- worker/src/index.ts — entry point, router, CORS, error handling
- worker/src/types.ts — Env, VerifiedToken, VerifiedAdmin, ServiceResult, ErrorCode
- worker/src/cors.ts — strict single-origin CORS
- worker/src/response.ts — ok/fail/notFound helpers
- worker/src/firebase-verify.ts — JWT verification via jose + Google x509 certs
- worker/src/google-auth.ts — service account to OAuth2 access token
- worker/src/firestore-rest.ts — Firestore REST API client + value encode/decode
- worker/src/admin-check.ts — admin claim extraction (ONLY source of admin auth)
- worker/src/routes/health.ts — GET /api/health
- worker/src/routes/verify.ts — GET /api/admin/verify

### Worker tests (6)
- worker/test/cors.test.ts — 6 tests
- worker/test/admin-check.test.ts — 7 tests
- worker/test/firestore-value.test.ts — 19 tests
- worker/test/response.test.ts — 5 tests
- worker/test/firebase-verify.test.ts — 7 tests
- worker/test/vitest.d.ts

### Worker documentation (1)
- worker/README.md

---

## Files Modified (1 file)

- .gitignore — added Worker exclusions:
  worker/node_modules/, worker/.wrangler/, worker/.dev.vars,
  worker/dist/, worker/coverage/, worker/*.service-account.json,
  worker/service-account-key.json

---

## Tests Performed and Results

  Test Files  5 passed (5)
       Tests  44 passed (44)
    Duration  1.10s
  TypeScript: 0 errors (tsc --noEmit clean)

The Next.js frontend was NOT modified. Dev server: HTTP 200 on port 3000.

---

## Manual Configuration Required

### Before Local Testing
1. cd worker && npm install
2. Download Firebase service account JSON from Firebase Console
3. cp worker/.dev.vars.example worker/.dev.vars — fill in service account values
4. Update worker/wrangler.toml — set ALLOWED_ORIGIN and FIREBASE_PROJECT_ID
5. npm test — run the 44 unit tests
6. npm run dev — start the Worker on localhost:8787

### Before Cloudflare Deployment (manual — DO NOT RUN YET)
1. npx wrangler login
2. npx wrangler secret put FIREBASE_CLIENT_EMAIL
3. npx wrangler secret put FIREBASE_PRIVATE_KEY
4. npm run deploy
5. Verify: curl https://oceansky-bank-worker.<subdomain>.workers.dev/api/health

### Before CP-12
- Set admin custom claims on admin users (Admin SDK script)
- Set NEXT_PUBLIC_WORKER_URL in Vercel env vars

---

## Limitations and Outstanding Tasks

1. Token revocation: Firebase ID tokens are valid for 1 hour regardless of
   sign-out. True revocation requires Firebase Admin SDK (not in Workers).
2. Not deployed: Worker is tested locally but not on Cloudflare.
3. No real Firebase credentials tested: Unit tests use mocked inputs.
4. CP-12 (Admin Credit) not yet implemented — foundation is ready.
5. LARD Collective isolation verified: Worker only accesses /bank/data/ paths.
