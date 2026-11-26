// ============================================================================
// OceanSky Bank Worker — Shared Types
// ============================================================================

/**
 * Environment bindings for the Worker.
 * Non-secret values come from [vars] in wrangler.toml.
 * Secret values are set via `wrangler secret put` and are NOT in the repo.
 */
export interface Env {
  // Non-secret (from wrangler.toml [vars])
  ALLOWED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;

  // Secrets (set via `wrangler secret put`)
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;

  // Optional KV namespace for caching Firebase public keys
  FIREBASE_CERTS_CACHE?: KVNamespace;
}

/**
 * The decoded payload of a verified Firebase ID token.
 * Standard Firebase claims plus custom claims set via the Admin SDK.
 */
export interface VerifiedToken {
  uid: string;
  email: string;
  emailVerified: boolean;
  issuer: string;
  audience: string;
  issuedAt: number;
  expiresAt: number;
  // Custom claims (set via setCustomUserClaims)
  admin: boolean;
  role?: string;
  department?: string;
}

/**
 * A verified admin user, extracted from a VerifiedToken where admin === true.
 */
export interface VerifiedAdmin {
  uid: string;
  email: string;
  admin: true;
  role?: string;
  department?: string;
}

/**
 * ServiceResult envelope — matches the frontend's service contract.
 * Every Worker endpoint returns this shape in the JSON body.
 */
export interface ServiceResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Error codes used across the Worker. The frontend already handles
 * ServiceResult.code strings for routing and display.
 */
export const ErrorCode = {
  AUTH_NO_TOKEN: "AUTH_NO_TOKEN",
  AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_WRONG_PROJECT: "AUTH_WRONG_PROJECT",
  AUTH_NOT_ADMIN: "AUTH_NOT_ADMIN",
  NO_IDEMPOTENCY_KEY: "NO_IDEMPOTENCY_KEY",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  ACCOUNT_CUSTOMER_MISMATCH: "ACCOUNT_CUSTOMER_MISMATCH",
  ACCOUNT_NOT_ACTIVE: "ACCOUNT_NOT_ACTIVE",
  CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
  SELF_CREDIT_FORBIDDEN: "SELF_CREDIT_FORBIDDEN",
  INVALID_AMOUNT: "INVALID_AMOUNT",
  INVALID_CURRENCY: "INVALID_CURRENCY",
  INVALID_REASON: "INVALID_REASON",
  INVALID_CUSTOMER: "INVALID_CUSTOMER",
  INVALID_ACCOUNT: "INVALID_ACCOUNT",
  DUPLICATE_REFERENCE: "DUPLICATE_REFERENCE",
  TXN_CONFLICT: "TXN_CONFLICT",
  FIRESTORE_ERROR: "FIRESTORE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN_ORIGIN: "FORBIDDEN_ORIGIN",
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];
