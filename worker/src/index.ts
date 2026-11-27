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
import { handleCreditAccount } from "./routes/credit-account";
import { handleCustomerAccounts } from "./routes/customer-accounts";

// Exact-match routes — "METHOD /path" → handler.
const EXACT_ROUTES: Record<string, (request: Request, env: Env) => Promise<Response>> = {
  "GET /api/health": handleHealth,
  "GET /api/admin/verify": handleVerify,
  "POST /api/admin/credit-account": handleCreditAccount,
};

// Pattern routes — for paths with parameters (e.g., /api/admin/customers/:customerId/accounts).
// The :param segments are extracted and passed to the handler.
interface PatternRoute {
  method: string;
  segments: string[]; // e.g., ["api", "admin", "customers", ":customerId", "accounts"]
  paramNames: string[]; // e.g., ["customerId"]
  handler: (request: Request, env: Env, params: Record<string, string>) => Promise<Response>;
}

const PATTERN_ROUTES: PatternRoute[] = [
  {
    method: "GET",
    segments: ["api", "admin", "customers", ":customerId", "accounts"],
    paramNames: ["customerId"],
    handler: (req, env, params) => handleCustomerAccounts(req, env, params.customerId),
  },
];

function matchPattern(
  method: string,
  pathSegments: string[]
): { route: PatternRoute; params: Record<string, string> } | null {
  for (const route of PATTERN_ROUTES) {
    if (route.method !== method) continue;
    if (route.segments.length !== pathSegments.length) continue;
    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < route.segments.length; i++) {
      const routeSeg = route.segments[i];
      const pathSeg = pathSegments[i];
      if (routeSeg.startsWith(":")) {
        params[routeSeg.slice(1)] = decodeURIComponent(pathSeg);
      } else if (routeSeg !== pathSeg) {
        matched = false;
        break;
      }
    }
    if (matched) return { route, params };
  }
  return null;
}

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
    const pathname = url.pathname.replace(/^\/+|\/+$/g, "");
    const pathSegments = pathname ? pathname.split("/") : [];
    const routeKey = `${request.method} ${url.pathname}`;

    // 3. Try exact match first.
    const exactHandler = EXACT_ROUTES[routeKey];
    if (exactHandler) {
      try {
        return await exactHandler(request, env);
      } catch (err) {
        console.error("Unhandled error:", err);
        return fail("An internal error occurred.", "INTERNAL_ERROR", 500, env.ALLOWED_ORIGIN);
      }
    }

    // 4. Try pattern match.
    const patternMatch = matchPattern(request.method, pathSegments);
    if (patternMatch) {
      try {
        return await patternMatch.route.handler(request, env, patternMatch.params);
      } catch (err) {
        console.error("Unhandled error:", err);
        return fail("An internal error occurred.", "INTERNAL_ERROR", 500, env.ALLOWED_ORIGIN);
      }
    }

    // 5. No match — 404.
    return notFound(env.ALLOWED_ORIGIN);
  },
};

// Re-export key modules for testing.
export { verifyFirebaseToken, extractBearerToken } from "./firebase-verify";
export { checkAdmin, requireAdmin } from "./admin-check";
export { FirestoreClient, toFirestoreValue, fromFirestoreValue, decodeDocument } from "./firestore-rest";
export { getAccessToken, clearAuthCache } from "./google-auth";
export { handleCors, corsHeaders } from "./cors";
export { ok, fail, notFound } from "./response";
