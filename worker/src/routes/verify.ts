// ============================================================================
// Route: GET /api/admin/verify
// ----------------------------------------------------------------------------
// Verifies the caller's Firebase ID token and checks the admin custom claim.
// Returns the verified admin identity if authorized, or an error if not.
//
// This endpoint is the auth gate for all future admin operations. The
// frontend admin portal can call this to confirm the admin session is valid
// before displaying privileged UI.
//
// Authorization:
//   - Authorization: Bearer <Firebase ID token> (required)
//   - The token's `admin` custom claim must be true.
//
// Responses:
//   200 { ok: true, data: { uid, email, admin, role, department } }
//   401 { ok: false, error: "...", code: "AUTH_NO_TOKEN" | "AUTH_INVALID_TOKEN" }
//   403 { ok: false, error: "...", code: "AUTH_NOT_ADMIN" }
// ============================================================================

import type { Env, ServiceResult, VerifiedAdmin } from "../types";
import { ErrorCode } from "../types";
import { ok, fail } from "../response";
import { verifyFirebaseToken, extractBearerToken } from "../firebase-verify";
import { requireAdmin } from "../admin-check";

export async function handleVerify(
  request: Request,
  env: Env
): Promise<Response> {
  // 1. Extract the Bearer token.
  const authHeader = request.headers.get("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    return fail(
      "Authentication required.",
      ErrorCode.AUTH_NO_TOKEN,
      401,
      env.ALLOWED_ORIGIN
    );
  }

  // 2. Verify the token cryptographically.
  const verified = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);

  if (!verified) {
    return fail(
      "Invalid or expired authentication token.",
      ErrorCode.AUTH_INVALID_TOKEN,
      401,
      env.ALLOWED_ORIGIN
    );
  }

  // 3. Check the admin custom claim.
  const admin = requireAdmin(verified);

  if (!admin) {
    return fail(
      "Admin authorization required.",
      ErrorCode.AUTH_NOT_ADMIN,
      403,
      env.ALLOWED_ORIGIN
    );
  }

  // 4. Return the verified admin identity.
  const result: ServiceResult<VerifiedAdmin> = {
    ok: true,
    data: admin,
  };

  return ok(result.data, 200, env.ALLOWED_ORIGIN);
}
