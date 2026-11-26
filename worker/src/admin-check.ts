// ============================================================================
// Admin Authorization Check
// ----------------------------------------------------------------------------
// Extracts and validates admin claims from a verified Firebase ID token.
//
// CRITICAL: This module is the ONLY place admin authorization is determined.
// It reads from the cryptographically verified token payload — never from
// localStorage, request headers, URL parameters, or request body.
//
// If `admin !== true` in the verified token, the user is NOT an admin.
// There is no fallback. There is no override. There is no "default admin".
// ============================================================================

import type { VerifiedAdmin, VerifiedToken } from "./types";

/**
 * Checks if a verified token has admin authorization.
 * Returns a VerifiedAdmin object if the `admin` custom claim is true,
 * or null if the user is not an admin.
 */
export function checkAdmin(token: VerifiedToken): VerifiedAdmin | null {
  if (!token.admin) {
    return null;
  }

  return {
    uid: token.uid,
    email: token.email,
    admin: true,
    role: token.role,
    department: token.department,
  };
}

/**
 * Convenience: verifies a token AND checks admin in one call.
 * Returns the VerifiedAdmin if both succeed, or null if either fails.
 *
 * This is the function privileged route handlers should use.
 */
export function requireAdmin(token: VerifiedToken | null): VerifiedAdmin | null {
  if (!token) return null;
  return checkAdmin(token);
}
