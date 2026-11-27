// ============================================================================
// Firestore REST API Client
// ----------------------------------------------------------------------------
// Provides typed access to Firestore via the REST API using an OAuth2 access
// token minted from the service account. This bypasses Firestore security
// rules (service accounts have full access), so the Worker's own authorization
// logic (token verification + admin claim check) is the enforcement layer.
//
// All paths use the /bank/data/ namespace — the Worker never touches root-level
// collections (where LARD Collective data lives).
// ============================================================================

import { getAccessToken } from "./google-auth";

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1";

/**
 * Returns the Firestore documents base URL for the configured project.
 */
function documentsUrl(projectId: string): string {
  return `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents`;
}

// ----------------------------------------------------------------------------
// Firestore value encoding (JS → Firestore JSON)
// ----------------------------------------------------------------------------

export function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    if (Number.isInteger(value) && Math.abs(value) < Number.MAX_SAFE_INTEGER) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: { values: value.map(toFirestoreValue) },
    };
  }
  if (typeof value === "object") {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

// ----------------------------------------------------------------------------
// Firestore value decoding (Firestore JSON → JS)
// ----------------------------------------------------------------------------

export function fromFirestoreValue(value: Record<string, unknown>): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("bytesValue" in value) return value.bytesValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) {
    const arr = (value.arrayValue as { values?: unknown[] }).values;
    return arr ? arr.map((v) => fromFirestoreValue(v as Record<string, unknown>)) : [];
  }
  if ("mapValue" in value) {
    const fields = (value.mapValue as { fields?: Record<string, unknown> }).fields;
    if (!fields) return {};
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromFirestoreValue(v as Record<string, unknown>);
    }
    return obj;
  }
  return undefined;
}

/**
 * Extracts the document fields from a Firestore document response and
 * converts them to a plain JS object.
 */
export function decodeDocument(doc: {
  name?: string;
  fields?: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}): { id: string; data: Record<string, unknown> } {
  const name = doc.name || "";
  const id = name.split("/").pop() || "";
  const data: Record<string, unknown> = {};
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      data[k] = fromFirestoreValue(v as Record<string, unknown>);
    }
  }
  return { id, data };
}

// ----------------------------------------------------------------------------
// Firestore operations
// ----------------------------------------------------------------------------

export class FirestoreClient {
  constructor(
    private projectId: string,
    private clientEmail: string,
    private privateKey: string
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken(this.clientEmail, this.privateKey);
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Gets a single document by its full path (e.g., "bank/data/customers/{uid}").
   * Returns null if the document does not exist (404).
   */
  async getDoc(path: string): Promise<Record<string, unknown> | null> {
    const url = `${documentsUrl(this.projectId)}/${path}`;
    const res = await fetch(url, { headers: await this.authHeaders() });

    if (res.status === 404) return null;
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Firestore getDoc failed (${res.status}): ${errorBody}`);
    }

    const doc = await res.json();
    const { data } = decodeDocument(doc as Parameters<typeof decodeDocument>[0]);
    return data;
  }

  /**
   * Creates a new document with an auto-generated ID.
   * Returns the created document data (including the generated ID).
   */
  async createDoc(
    collectionPath: string,
    data: Record<string, unknown>
  ): Promise<{ id: string; data: Record<string, unknown> }> {
    const url = `${documentsUrl(this.projectId)}/${collectionPath}`;
    const body = {
      fields: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)])
      ),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: await this.authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Firestore createDoc failed (${res.status}): ${errorBody}`);
    }

    const doc = await res.json();
    return decodeDocument(doc as Parameters<typeof decodeDocument>[0]);
  }

  /**
   * Updates an existing document. By default, only the fields provided in
   * `data` are written (field-level update, not full replacement).
   */
  async updateDoc(
    path: string,
    data: Record<string, unknown>,
    options?: { mergeFields?: string[] }
  ): Promise<void> {
    const updateMask = options?.mergeFields
      ? `?updateMask.fieldPaths=${options.mergeFields.join("&updateMask.fieldPaths=")}`
      : "";
    const url = `${documentsUrl(this.projectId)}/${path}${updateMask}`;
    const body = {
      fields: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, toFirestoreValue(v)])
      ),
    };

    const res = await fetch(url, {
      method: "PATCH",
      headers: await this.authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Firestore updateDoc failed (${res.status}): ${errorBody}`);
    }
  }

  /**
   * Queries documents in a collection with a single field filter.
   * For complex queries, use runQuery() directly.
   */
  async queryByField(
    collectionPath: string,
    field: string,
    op: string,
    value: unknown
  ): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
    const url = `${documentsUrl(this.projectId)}/${collectionPath}:runQuery`;
    const filter = {
      fieldFilter: {
        field: { fieldPath: field },
        op,
        value: toFirestoreValue(value),
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: await this.authHeaders(),
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collectionPath.split("/").pop() }], where: filter } }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Firestore query failed (${res.status}): ${errorBody}`);
    }

    const results = await res.json();
    const docs: Array<{ id: string; data: Record<string, unknown> }> = [];
    for (const result of results as Array<Record<string, unknown>>) {
      if (result.document) {
        docs.push(decodeDocument(result.document as Parameters<typeof decodeDocument>[0]));
      }
    }
    return docs;
  }

  // --------------------------------------------------------------------------
  // Transaction support — atomic read-modify-write operations
  // --------------------------------------------------------------------------

  /**
   * Begins a Firestore read-write transaction.
   * Returns the transaction ID (base64) to pass to getDocInTransaction + commit.
   */
  async beginTransaction(): Promise<string> {
    const url = `${documentsUrl(this.projectId)}/:beginTransaction`;
    const res = await fetch(url, {
      method: "POST",
      headers: await this.authHeaders(),
      body: JSON.stringify({ options: { readWrite: {} } }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Firestore beginTransaction failed (${res.status}): ${errorBody}`);
    }
    const body = (await res.json()) as { transaction?: string };
    if (!body.transaction) throw new Error("beginTransaction returned no transaction ID");
    return body.transaction;
  }

  /**
   * Reads a document within a transaction (serialized — no concurrent modification
   * between this read and the subsequent commit).
   */
  async getDocInTransaction(
    path: string,
    transaction: string
  ): Promise<{ data: Record<string, unknown> | null; updateTime?: string }> {
    const url = `${documentsUrl(this.projectId)}:batchGet`;
    const fullPath = `${documentsUrl(this.projectId)}/${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: await this.authHeaders(),
      body: JSON.stringify({ documents: [fullPath], transaction }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Firestore batchGet failed (${res.status}): ${errorBody}`);
    }
    const results = (await res.json()) as Array<{
      found?: { name?: string; fields?: Record<string, unknown>; updateTime?: string };
      missing?: string;
    }>;
    if (results.length === 0 || results[0].missing) return { data: null };
    const found = results[0].found;
    if (!found) return { data: null };
    const { data } = decodeDocument({ name: found.name, fields: found.fields });
    return { data, updateTime: found.updateTime };
  }

  /**
   * Commits a set of writes atomically within a transaction.
   * Each write is a Firestore Write object. If any fails, the entire commit
   * is rolled back. If a concurrent write invalidated the transaction, the
   * commit fails with ABORTED — caller must retry.
   */
  async commit(
    writes: Array<Record<string, unknown>>,
    transaction: string
  ): Promise<void> {
    const url = `${documentsUrl(this.projectId)}:commit`;
    const res = await fetch(url, {
      method: "POST",
      headers: await this.authHeaders(),
      body: JSON.stringify({ writes, transaction }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Firestore commit failed (${res.status}): ${errorBody}`);
    }
  }

  /**
   * Helper: builds the full Firestore document path for a relative path.
   */
  docPath(relativePath: string): string {
    return `${documentsUrl(this.projectId)}/${relativePath}`;
  }
}
