# OceanSky Bank Worker — Cloudflare Worker Foundation (CP-11)

This is the Cloudflare Worker that hosts all server-side privileged banking
operations for OceanSky Bank. It verifies Firebase ID tokens, enforces admin
custom claims, and accesses Firestore via the REST API using a service
account.

**Checkpoint:** CP-11 (Foundation)
**Status:** Implemented and tested. Not deployed.
**Cost:** Zero (Cloudflare Workers free tier: 100K requests/day)

---

## What This Worker Does

1. **Verifies Firebase ID tokens cryptographically** using Google's published
   x509 certificates (via the `jose` library). No Firebase Admin SDK required.

2. **Enforces admin authorization** via verified custom claims. The `admin:
   true` claim must be present in the cryptographically verified ID token.
   No localStorage, no frontend flags, no client-side state is trusted.

3. **Accesses Firestore via the REST API** using a service account OAuth2
   access token. The service account credentials are stored as Cloudflare
   Worker secrets — never in the repo, never in frontend code.

4. **Enforces strict CORS** — only the configured Vercel frontend origin is
   allowed.

## Current Endpoints (CP-11)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | None | Health check — confirms the Worker is reachable |
| GET | `/api/admin/verify` | Bearer token + admin claim | Verifies the caller is an authenticated admin |

Future endpoints (CP-12+):
- `POST /api/admin/credit-account` — Admin Credit Customer Account

## Security Model

### Token Verification

Firebase ID tokens are JWTs signed by Google with RS256. The Worker:

1. Fetches Google's public x509 certificates from
   `https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com`
2. Caches them for 6 hours
3. Matches the JWT's `kid` header to the correct certificate
4. Verifies the signature using `jose`'s `importX509` + `jwtVerify`
5. Checks the `iss` claim matches `https://securetoken.google.com/{projectId}`
6. Checks the `aud` claim matches the project ID
7. Checks `exp` (jose does this automatically)

### Admin Authorization

The `admin: true` custom claim is set via the Firebase Admin SDK's
`setCustomUserClaims()` function (run server-side, never from the browser).
The claim is embedded in the user's ID token and cryptographically signed.

The Worker reads this claim ONLY from the verified token payload — never
from localStorage, request headers, URL parameters, or the request body.

### Firestore Access

The Worker authenticates to Firestore using a service account:
1. Mints a JWT signed with the service account's RSA private key
2. Exchanges it for an OAuth2 access token (valid 1 hour, cached)
3. Calls the Firestore REST API with the access token

Service accounts bypass Firestore security rules. The Worker's own auth
logic (token verification + admin claim check) is the enforcement layer for
admin operations. Firestore rules still protect against direct client-side
access.

### Token Revocation Limitation

Firebase ID tokens are JWTs valid for 1 hour from issuance. **Signing out
of the Firebase client does NOT revoke already-issued tokens.** A token
remains valid until its `exp` time regardless of sign-out.

True revocation requires the Firebase Admin SDK's
`revokeRefreshTokens()` + `verifyIdTokenAndCheckRevoked()`, which is not
available in Cloudflare Workers. This Worker relies on expiration only.

If immediate revocation is needed in the future:
- Run a separate Admin SDK script to revoke refresh tokens
- Or deploy a Firebase Cloud Function (requires Blaze plan — not zero-cost)

---

## Local Development

### Prerequisites

- Node.js 18+
- npm or bun
- A Cloudflare account (free)
- The Firebase service account JSON for the shared Firebase project

### Install Dependencies

```bash
cd worker
npm install
```

### Configure Secrets

1. Download the service account JSON from Firebase Console:
   - Firebase Console → Project Settings → Service Accounts → Generate new private key

2. Copy `.dev.vars.example` to `.dev.vars`:

```bash
cp .dev.vars.example .dev.vars
```

3. Edit `.dev.vars` and fill in the values from the service account JSON:
   - `FIREBASE_CLIENT_EMAIL` → the `client_email` field
   - `FIREBASE_PRIVATE_KEY` → the `private_key` field (keep the `\n` escapes)

4. Edit `wrangler.toml` and update the `[vars]`:
   - `ALLOWED_ORIGIN` → your Vercel URL (e.g., `https://your-app.vercel.app`)
   - `FIREBASE_PROJECT_ID` → your Firebase project ID

### Run Locally

```bash
npm run dev
```

This starts `wrangler dev` on `http://localhost:8787`. The Worker reads
secrets from `.dev.vars`.

### Run Tests

```bash
npm test
```

44 unit tests covering CORS, admin check, Firestore value encoding, response
helpers, and token extraction.

---

## Deployment

### 1. Install Wrangler (if not already installed)

```bash
npm install -g wrangler
# or use npx wrangler ...
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Set Secrets (IDENTIFIED DEPLOYMENT ACTION)

```bash
wrangler secret put FIREBASE_CLIENT_EMAIL
# Paste the service account email when prompted

wrangler secret put FIREBASE_PRIVATE_KEY
# Paste the private key (with \n escapes) when prompted
```

### 4. Update wrangler.toml

Edit `wrangler.toml` and replace the placeholder values:
- `ALLOWED_ORIGIN` → your production Vercel URL
- `FIREBASE_PROJECT_ID` → your Firebase project ID

### 5. Deploy (IDENTIFIED DEPLOYMENT ACTION — DO NOT RUN YET)

```bash
npm run deploy
```

This deploys the Worker to Cloudflare's edge network. The Worker URL will be:
`https://oceansky-bank-worker.<your-cloudflare-subdomain>.workers.dev`

### 6. Verify Deployment

```bash
curl https://oceansky-bank-worker.<your-subdomain>.workers.dev/api/health
# Should return: { "ok": true, "data": { "service": "oceansky-bank-worker", "status": "ok", ... } }
```

### 7. Test Admin Verify (with a real Firebase admin token)

```bash
curl -H "Authorization: Bearer <your-firebase-id-token>" \
     -H "Origin: https://your-app.vercel.app" \
     https://oceansky-bank-worker.<your-subdomain>.workers.dev/api/admin/verify
```

---

## Configuration Reference

### Environment Variables (wrangler.toml `[vars]` — non-secret)

| Variable | Purpose | Example |
| --- | --- | --- |
| `ALLOWED_ORIGIN` | The Vercel frontend URL allowed by CORS | `https://oceansky.vercel.app` |
| `FIREBASE_PROJECT_ID` | The Firebase project ID (used for token verification) | `oceansky-shared-prod` |

### Secrets (set via `wrangler secret put`)

| Secret | Purpose | Source |
| --- | --- | --- |
| `FIREBASE_CLIENT_EMAIL` | Service account email for Firestore REST API auth | Firebase Console → Service Accounts → Generate key → `client_email` |
| `FIREBASE_PRIVATE_KEY` | Service account RSA private key (PEM format) | Same JSON → `private_key` |

---

## Project Structure

```
worker/
├── package.json              # Dependencies + scripts
├── wrangler.toml             # Cloudflare Worker config (non-secret vars)
├── tsconfig.json             # TypeScript config
├── vitest.config.ts          # Test config
├── postcss.config.js         # Empty — prevents Vite from searching parent dirs
├── .gitignore                # Excludes node_modules, .wrangler, .dev.vars, secrets
├── .dev.vars.example         # Template for local dev secrets
├── README.md                 # This file
├── src/
│   ├── index.ts              # Entry point + router + CORS + error handling
│   ├── types.ts              # Shared types (Env, VerifiedToken, ServiceResult, ErrorCode)
│   ├── cors.ts               # CORS preflight + origin validation
│   ├── response.ts           # ok() / fail() / notFound() helpers
│   ├── firebase-verify.ts    # JWT verification via jose + Google x509 certs
│   ├── google-auth.ts        # Service account → OAuth2 access token (cached)
│   ├── firestore-rest.ts     # Firestore REST API client + value encode/decode
│   ├── admin-check.ts        # Admin claim extraction from verified token
│   └── routes/
│       ├── health.ts         # GET /api/health
│       └── verify.ts         # GET /api/admin/verify
└── test/
    ├── cors.test.ts          # 6 tests
    ├── admin-check.test.ts   # 7 tests
    ├── firestore-value.test.ts # 19 tests
    ├── response.test.ts      # 5 tests
    └── firebase-verify.test.ts # 7 tests
```

---

## Test Results

```
Test Files  5 passed (5)
     Tests  44 passed (44)
  Duration  ~1.0s

TypeScript: 0 errors (tsc --noEmit clean)
```

---

## LARD Collective Isolation

This Worker:
- Uses the same Firebase project as LARD Collective
- Accesses Firestore via the REST API with a service account
- Only reads/writes documents under the `bank/data/` path
- Never touches root-level collections where LARD data lives
- Has its own Firestore security rules (in the Firebase Console) scoped to `/bank/**`

No LARD data, rules, or functionality is modified, broken, or accessed.

---

## What's Next (CP-12)

CP-12 will add:
- `POST /api/admin/credit-account` endpoint to this Worker
- The Admin Credit Customer Account UI in the Next.js frontend
- Atomic Firestore transaction (balance update + ledger + audit + idempotency)
- Idempotency key handling
- Full end-to-end testing

The Worker foundation (CP-11) provides everything CP-12 needs: token
verification, admin authorization, Firestore access, CORS, and the
ServiceResult response contract.
