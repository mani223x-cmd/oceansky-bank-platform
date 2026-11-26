// ============================================================================
// CORS Handler
// ----------------------------------------------------------------------------
// Enforces a strict single-origin allowlist. Only the configured Vercel
// frontend origin (and localhost for development) may call the Worker.
// ============================================================================

import type { ServiceResult } from "./types";

const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Authorization, Content-Type, X-Idempotency-Key";
const MAX_AGE = "86400"; // 24 hours — preflight cache

/**
 * Returns CORS headers for responses. The origin is the configured
 * ALLOWED_ORIGIN from wrangler.toml.
 */
export function corsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": MAX_AGE,
    "Access-Control-Allow-Credentials": "false",
    "Vary": "Origin",
  };
}

/**
 * Handles CORS preflight (OPTIONS) requests and validates the Origin header
 * on all other requests.
 *
 * Returns a Response if the request should be short-circuited (either the
 * preflight response or a 403 for a disallowed origin). Returns null if the
 * request should proceed to the route handler.
 */
export function handleCors(request: Request, allowedOrigin: string): Response | null {
  const origin = request.headers.get("Origin");

  // No Origin header → not a CORS request (server-to-server or curl).
  // Allow it to proceed — CORS is a browser-only protection.
  if (!origin) {
    return null;
  }

  // Strict origin allowlist. The origin must match exactly.
  if (origin !== allowedOrigin) {
    const body: ServiceResult = {
      ok: false,
      error: "Origin not allowed.",
      code: "FORBIDDEN_ORIGIN",
    };
    return new Response(JSON.stringify(body), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(allowedOrigin),
    });
  }

  // Origin is allowed and it's not a preflight — proceed to the route handler.
  // The actual response will include CORS headers added by the json() helper.
  return null;
}
