// ============================================================================
// Response Helpers
// ----------------------------------------------------------------------------
// Every Worker response is a ServiceResult<T> JSON envelope with CORS headers.
// ============================================================================

import type { ServiceResult } from "./types";
import { corsHeaders } from "./cors";

/**
 * Sends a success response (HTTP 200 by default) with a ServiceResult body.
 */
export function ok<T>(data: T, status: number = 200, allowedOrigin: string): Response {
  const body: ServiceResult<T> = { ok: true, data };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(allowedOrigin),
    },
  });
}

/**
 * Sends an error response with a ServiceResult body containing the error
 * message and code.
 */
export function fail(
  error: string,
  code: string,
  status: number,
  allowedOrigin: string
): Response {
  const body: ServiceResult = { ok: false, error, code };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(allowedOrigin),
    },
  });
}

/**
 * Sends a 404 for unmatched routes.
 */
export function notFound(allowedOrigin: string): Response {
  return fail("Endpoint not found.", "NOT_FOUND", 404, allowedOrigin);
}
