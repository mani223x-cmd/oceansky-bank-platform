// ============================================================================
// OceanSky Bank Worker — Entry Point
// ----------------------------------------------------------------------------
// This Worker hosts all server-side privileged banking operations for
// OceanSky Bank. It is deployed to Cloudflare's edge network (free tier:
// 100K requests/day) and communicates with the existing Firebase project's
// Firestore via the REST API.
//
// CP-11 (this checkpoint) implements the FOUNDATION only:
//   - CORS enforcement
//   - Firebase ID token verification (cryptographic)
//   - Admin custom claim enforcement
//   - Firestore REST API client (ready for CP-12 to use)
//   - Two endpoints: /api/health and /api/admin/verify
//
// CP-12 will add: POST /api/admin/credit-account (Admin Credit feature)
//
// SECURITY MODEL:
//   1. Every privileged endpoint requires a Firebase ID token in the
//      Authorization: Bearer header.
//   2. The token is verified by SIGNATURE (Google's public x509 certs),
//      ISSUER (https://securetoken.google.com/{projectId}),
//      AUDIENCE (the project ID), and EXPIRATION (jose checks `exp`).
//   3. Admin authorization comes ONLY from the `admin: true` custom claim
//      in the verified token. It NEVER comes from localStorage, URL params,
//      request body, or any client-side flag.
//   4. Firestore writes go through the REST API with a service account
//      access token. Firestore security rules still apply, but the service
//      account bypasses them — the Worker's own auth logic is the
//      enforcement layer for admin operations.
//
// TOKEN REVOCATION LIMITATION:
//   Firebase ID tokens are JWTs valid for 1 hour. Signing out of the Firebase
//   client does NOT revoke already-issued tokens. A token remains valid until
//   its `exp` time regardless of sign-out. True revocation requires the
//   Firebase Admin SDK's revokeRefreshTokens() + verifyIdTokenAndCheckRevoked(),
//   which is not available in Workers. This Worker relies on expiration only.
//   If immediate revocation is needed, a separate Admin SDK script or Cloud
//   Function must be used to revoke refresh tokens (future hardening).
// ============================================================================

import type { Env } from "./types";
import { handleCors } from "./cors";
import { fail, notFound } from "./response";
import { handleHealth } from "./routes/health";
import { handleVerify } from "./routes/verify";

// Route table — maps "METHOD /path" to a handler function.
// CP-12 will add "POST /api/admin/credit-account" here.
const ROUTES: Record<string, (request: Request, env: Env) => Promise<Response>> = {
  "GET /api/health": handleHealth,
  "GET /api/admin/verify": handleVerify,
};

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    // 1. CORS preflight + origin validation.
    const corsResponse = handleCors(request, env.ALLOWED_ORIGIN);
    if (corsResponse) {
      return corsResponse;
    }

    // 2. Parse the route.
    const url = new URL(request.url);
    const routeKey = `${request.method} ${url.pathname}`;
    const handler = ROUTES[routeKey];

    if (!handler) {
      return notFound(env.ALLOWED_ORIGIN);
    }

    // 3. Execute the handler with error handling.
    try {
      return await handler(request, env);
    } catch (err) {
      // Log to Cloudflare (visible in wrangler tail / dashboard).
      // Never expose the internal error message to the client.
      console.error("Unhandled error:", err);
      return fail(
        "An internal error occurred.",
        "INTERNAL_ERROR",
        500,
        env.ALLOWED_ORIGIN
      );
    }
  },
};

// Re-export key modules for testing.
export { verifyFirebaseToken, extractBearerToken } from "./firebase-verify";
export { checkAdmin, requireAdmin } from "./admin-check";
export { FirestoreClient, toFirestoreValue, fromFirestoreValue, decodeDocument } from "./firestore-rest";
export { getAccessToken, clearAuthCache } from "./google-auth";
export { handleCors, corsHeaders } from "./cors";
export { ok, fail, notFound } from "./response";
