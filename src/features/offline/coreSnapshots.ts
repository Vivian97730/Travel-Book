import { parseAccessVerifyResponse, parseSharedChecklistResponse, parseTripDay,
  type AccessVerifyResponse, type SharedChecklistResponse, type TripDay } from "@travel-book/contracts";
import { HOME_SNAPSHOT_MAX_AGE_MS } from "./homeSnapshotRepository";

export interface SnapshotInfo {
  snapshotVersion: 1;
  syncedAt: string;
  expiresAt: string;
}

interface Entry extends SnapshotInfo {
  tokenHash: string;
  resource: string;
  data: unknown;
}

const STORE = "shared-resources";

export class CoreSnapshots {
  private async request<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("travel-book.core-snapshots.v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: ["tokenHash", "resource"] });
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

  async put(tokenHash: string, resource: string, data: unknown) {
    const now = Date.now();
    const entry: Entry = {
      tokenHash, resource, data, snapshotVersion: 1, syncedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + HOME_SNAPSHOT_MAX_AGE_MS).toISOString(),
    };
    await this.request("readwrite", (store) => store.put(entry));
  }

  async get(tokenHash: string, resource: string): Promise<Entry | undefined> {
    const entry: Entry | undefined = await this.request("readonly", (store) => store.get([tokenHash, resource]));
    if (entry?.snapshotVersion !== 1 || entry.tokenHash !== tokenHash || entry.resource !== resource
      || !Number.isFinite(Date.parse(entry.syncedAt))
      || Date.parse(entry.expiresAt) !== Date.parse(entry.syncedAt) + HOME_SNAPSHOT_MAX_AGE_MS) return undefined;
    return entry;
  }

  async delete(tokenHash: string) {
    await this.request("readwrite", (store) => store.delete(IDBKeyRange.bound([tokenHash], [tokenHash, []])));
  }

  async access(tokenHash: string): Promise<AccessVerifyResponse | null> {
    const parsed = parseAccessVerifyResponse((await this.get(tokenHash, "access"))?.data);
    return parsed.ok ? parsed.value : null;
  }

  async day(tokenHash: string, date: string): Promise<TripDay> {
    const parsed = parseTripDay((await this.get(tokenHash, "day:" + date))?.data);
    if (!parsed.ok || parsed.value.date !== date) throw new Error("OFFLINE_SNAPSHOT_UNAVAILABLE");
    return parsed.value;
  }

  async checklist(tokenHash: string): Promise<SharedChecklistResponse> {
    const parsed = parseSharedChecklistResponse((await this.get(tokenHash, "checklist"))?.data);
    if (!parsed.ok) throw new Error("OFFLINE_SNAPSHOT_UNAVAILABLE");
    return parsed.value;
  }
}
