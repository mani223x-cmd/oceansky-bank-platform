// ============================================================================
// Route: GET /api/health
// ----------------------------------------------------------------------------
// Public health check. No authentication required. Returns the Worker's
// service name and current timestamp. Used by the frontend to confirm the
// Worker is reachable and by Cloudflare/uptime monitors.
// ============================================================================

import type { Env } from "../types";
import { ok } from "../response";

export async function handleHealth(
  _request: Request,
  env: Env
): Promise<Response> {
  return ok(
    {
      service: "oceansky-bank-worker",
      status: "ok",
      time: new Date().toISOString(),
      firebaseProject: env.FIREBASE_PROJECT_ID,
    },
    200,
    env.ALLOWED_ORIGIN
  );
}
