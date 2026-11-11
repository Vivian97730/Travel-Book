import { isRecord, parseAccessVerifyResponse, parseStaysResponse, type AccessVerifyResponse, type Stay } from "@travel-book/contracts";

const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const STORE = "snapshots";

export interface StaysSnapshot {
  snapshotVersion: 1;
  tokenHash: string;
  access: AccessVerifyResponse;
  syncedAt: string;
  expiresAt: string;
  stays: Stay[];
}

export interface StaysSnapshots {
  get(tokenHash: string): Promise<StaysSnapshot | null>;
  put(snapshot: StaysSnapshot): Promise<void>;
  delete(tokenHash: string): Promise<void>;
}

export function createStaysSnapshot(tokenHash: string, access: AccessVerifyResponse, stays: Stay[], now = Date.now()): StaysSnapshot {
  return {
    snapshotVersion: 1, tokenHash, access, stays,
    syncedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAX_AGE).toISOString(),
  };
}

export function parseStaysSnapshot(input: unknown, tokenHash: string, now = Date.now()): StaysSnapshot | null {
  if (!isRecord(input) || input.snapshotVersion !== 1 || input.tokenHash !== tokenHash
    || typeof input.syncedAt !== "string" || typeof input.expiresAt !== "string") return null;
  const syncedAt = Date.parse(input.syncedAt);
  const expiresAt = Date.parse(input.expiresAt);
  if (!Number.isFinite(syncedAt) || expiresAt !== syncedAt + MAX_AGE || expiresAt <= now) return null;
  const access = parseAccessVerifyResponse(input.access);
  const stays = parseStaysResponse({ schemaVersion: 1, stays: input.stays });
  if (!access.ok || !stays.ok) return null;
  return {
    snapshotVersion: 1, tokenHash, access: access.value, stays: stays.value.stays,
    syncedAt: input.syncedAt, expiresAt: input.expiresAt,
  };
}

export class IndexedDbStaysSnapshots implements StaysSnapshots {
  async get(tokenHash: string): Promise<StaysSnapshot | null> {
    const value = await this.request("readonly", (store) => store.get(tokenHash));
    return parseStaysSnapshot(value, tokenHash);
  }

  async put(snapshot: StaysSnapshot): Promise<void> {
    await this.request("readwrite", (store) => store.put(snapshot));
  }

  async delete(tokenHash: string): Promise<void> {
    await this.request("readwrite", (store) => store.delete(tokenHash));
  }

  private async request(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("travel-book.stays.v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "tokenHash" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE, mode);
        const request = operation(transaction.objectStore(STORE));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }
}
