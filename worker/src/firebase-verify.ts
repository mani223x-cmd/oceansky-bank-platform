// ============================================================================
// Firebase ID Token Verification
// ----------------------------------------------------------------------------
// Verifies Firebase ID tokens cryptographically using Google's published
// x509 certificates. No Firebase Admin SDK is required (it does not work in
// Cloudflare Workers). This module is the Worker's source of truth for
// "who is this user?" and "are they an admin?".
//
// SECURITY NOTES:
//   1. Tokens are verified by SIGNATURE (RS256 via Google's public keys),
//      ISSUER (https://securetoken.google.com/{projectId}),
//      AUDIENCE (the Firebase project ID),
//      and EXPIRATION (exp claim, checked automatically by jose).
//
//   2. Firebase ID tokens are JWTs valid for 1 hour from issuance.
//      Signing out of the Firebase client does NOT revoke already-issued
//      tokens. A token remains valid until its `exp` time regardless of
//      sign-out. True revocation requires Firebase Admin SDK's
//      revokeRefreshTokens() + verifyIdTokenAndCheckRevoked(), which needs
//      the Admin SDK (not available in Workers). This Worker does NOT
//      perform revocation checks — it relies on expiration only.
//
//   3. Public keys are fetched from Google's metadata endpoint and cached
//      for 6 hours. If the fetch fails, the cache is used until it expires.
//
//   4. This module NEVER trusts client-side claims (localStorage, URL params,
//      request body). The ONLY source of admin authorization is the
//      cryptographically verified `admin` custom claim in the ID token.
// ============================================================================

import { importX509, jwtVerify } from "jose";
import type { VerifiedToken } from "./types";

// Google's public x509 certificates for Firebase ID token verification.
const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// Cache the certs for 6 hours (Google rotates keys roughly every 6-12 hours).
const CERT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CertCache {
  certs: Record<string, string>;
  fetchedAt: number;
}

let certCache: CertCache | null = null;

/**
 * Fetches Google's x509 certificates for Firebase token verification.
 * Cached in a module-level variable for 6 hours.
 *
 * In a multi-isolate Worker deployment, each isolate has its own cache.
 * For shared caching, use the optional FIREBASE_CERTS_CACHE KV namespace
 * (see wrangler.toml).
 */
async function getFirebaseCerts(): Promise<Record<string, string>> {
  const now = Date.now();

  if (certCache && now - certCache.fetchedAt < CERT_CACHE_TTL_MS) {
    return certCache.certs;
  }

  const res = await fetch(FIREBASE_CERTS_URL, {
    headers: { "Cache-Control": "max-age=21600" },
  });

  if (!res.ok) {
    // If we have a stale cache, use it rather than failing completely.
    if (certCache) {
      return certCache.certs;
    }
    throw new Error(`Failed to fetch Firebase certs: ${res.status}`);
  }

  const certs = (await res.json()) as Record<string, string>;
  certCache = { certs, fetchedAt: now };
  return certs;
}

/**
 * Decodes a JWT header (without verifying) to extract the `kid` header.
 * Used to look up the correct public key for signature verification.
 */
function decodeJwtHeader(token: string): { kid?: string; alg?: string } {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  // Base64url → Base64
  const headerB64 = parts[0].replace(/-/g, "+").replace(/_/g, "/");
  // Decode (atob is available in Workers)
  const headerJson = atob(headerB64);
  return JSON.parse(headerJson);
}

/**
 * Verifies a Firebase ID token.
 *
 * Returns the decoded token (including custom claims) if the token is valid,
 * or null if the token is invalid, expired, or from the wrong project.
 *
 * @param token The raw JWT string from the Authorization header.
 * @param projectId The Firebase project ID (used to verify issuer + audience).
 */
export async function verifyFirebaseToken(
  token: string,
  projectId: string
): Promise<VerifiedToken | null> {
  try {
    if (!token || typeof token !== "string") {
      return null;
    }

    // 1. Decode the header to find the key ID.
    const header = decodeJwtHeader(token);
    if (!header.kid) {
      return null;
    }

    // 2. Fetch Google's public certs and find the matching one.
    const certs = await getFirebaseCerts();
    const certPem = certs[header.kid];
    if (!certPem) {
      // The key may have rotated. Force a cache refresh and try once more.
      certCache = null;
      const freshCerts = await getFirebaseCerts();
      const freshCert = freshCerts[header.kid];
      if (!freshCert) {
        return null;
      }
      return await verifyWithCert(token, freshCert, projectId);
    }

    return await verifyWithCert(token, certPem, projectId);
  } catch {
    // Any error (invalid JWT, bad signature, network failure, etc.) → reject.
    return null;
  }
}

/**
 * Verifies a JWT against a specific x509 certificate.
 */
async function verifyWithCert(
  token: string,
  certPem: string,
  projectId: string
): Promise<VerifiedToken | null> {
  // Import the x509 certificate as an RSA public key for RS256.
  const publicKey = await importX509(certPem, "RS256");

  // Verify the JWT: signature + issuer + audience + expiration.
  // jose automatically checks `exp` and `nbf` claims.
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  // Extract standard + custom claims.
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    return null;
  }

  return {
    uid: sub,
    email: typeof payload.email === "string" ? payload.email : "",
    emailVerified: payload.email_verified === true,
    issuer: typeof payload.iss === "string" ? payload.iss : "",
    audience: typeof payload.aud === "string" ? payload.aud : (Array.isArray(payload.aud) ? payload.aud[0] : ""),
    issuedAt: payload.iat ?? 0,
    expiresAt: payload.exp ?? 0,
    // Custom claims set via Firebase Admin SDK setCustomUserClaims().
    // These are embedded in the ID token and cryptographically signed.
    admin: (payload as Record<string, unknown>).admin === true,
    role: typeof (payload as Record<string, unknown>).role === "string"
      ? (payload as Record<string, string>).role
      : undefined,
    department: typeof (payload as Record<string, unknown>).department === "string"
      ? (payload as Record<string, string>).department
      : undefined,
  };
}

/**
 * Extracts the Bearer token from an Authorization header.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
