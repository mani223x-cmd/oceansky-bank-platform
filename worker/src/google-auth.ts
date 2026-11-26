// ============================================================================
// Google Auth — Service Account → OAuth2 Access Token
// ----------------------------------------------------------------------------
// The Worker authenticates to the Firestore REST API using an OAuth2 access
// token minted from a Firebase service account. The service account JSON is
// stored as Cloudflare Worker secrets (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY),
// NEVER in the repo or frontend.
//
// Flow:
//   1. Create a JWT with the service account email as issuer + subject.
//   2. Set scope to https://www.googleapis.com/auth/datastore (Firestore).
//   3. Set audience to https://oauth2.googleapis.com/token.
//   4. Sign the JWT with the service account's RSA private key (via jose).
//   5. POST the JWT to Google's OAuth2 token endpoint.
//   6. Receive an access_token (valid for 1 hour).
//   7. Cache the token in module-level memory until 5 minutes before expiry.
//
// This uses only the `jose` library + the Worker's native fetch — no Admin SDK.
// ============================================================================

import { SignJWT, importPKCS8, type KeyLike } from "jose";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_TTL_SECONDS = 3600; // 1 hour

// Refresh the token 5 minutes before it expires.
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface CachedAccessToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedAccessToken | null = null;

// Cache the imported private key so we don't re-import it on every request.
let cachedKey: KeyLike | null = null;

/**
 * Returns the Firestore REST API access token.
 * Mints a new token if none is cached or the cached token is near expiry.
 *
 * @param clientEmail The service account email (from Worker secrets).
 * @param privateKeyPem The service account private key in PEM format (from Worker secrets).
 */
export async function getAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + REFRESH_BUFFER_MS) {
    return cachedToken.token;
  }

  const token = await mintAccessToken(clientEmail, privateKeyPem);
  cachedToken = {
    token,
    expiresAt: now + TOKEN_TTL_SECONDS * 1000,
  };
  return token;
}

/**
 * Mints a new OAuth2 access token using the service account JWT-bearer flow.
 */
async function mintAccessToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  // Import the private key (cached for performance).
  if (!cachedKey) {
    // The PEM from the Firebase service account JSON uses \n escapes.
    // Convert to real newlines if needed.
    const pem = privateKeyPem.replace(/\\n/g, "\n");
    cachedKey = await importPKCS8(pem, "RS256");
  }

  // Create the JWT assertion. In jose v5, the payload is passed to the constructor.
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: FIRESTORE_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience(TOKEN_ENDPOINT)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(cachedKey);

  // Exchange the assertion for an access token.
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google OAuth token exchange failed: ${res.status} ${errorBody}`);
  }

  const body = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  return body.access_token;
}

/**
 * Clears the cached token and key. Useful for tests.
 */
export function clearAuthCache(): void {
  cachedToken = null;
  cachedKey = null;
}
