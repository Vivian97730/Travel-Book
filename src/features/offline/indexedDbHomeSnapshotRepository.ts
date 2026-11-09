import {
  parseHomeSnapshot,
  type HomeSnapshot,
  type HomeSnapshotRepository,
} from "./homeSnapshotRepository";

const DATABASE_NAME = "travel-book.offline.v1";
const STORE_NAME = "shared-home-snapshots";

export class IndexedDbHomeSnapshotRepository implements HomeSnapshotRepository {
  constructor(private readonly factory: IDBFactory = indexedDB) {}

  async get(tokenHash: string): Promise<HomeSnapshot | null> {
    const value = await this.request("readonly", (store) => store.get(tokenHash));
    const snapshot = parseHomeSnapshot(value, tokenHash);
    if (!snapshot && value !== undefined) await this.delete(tokenHash);
    return snapshot;
  }

  async put(snapshot: HomeSnapshot): Promise<void> {
    await this.request("readwrite", (store) => store.put(structuredClone(snapshot)));
  }

  async delete(tokenHash: string): Promise<void> {
    await this.request("readwrite", (store) => store.delete(tokenHash));
  }

  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "tokenHash" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("無法開啟離線快照。"));
    });
  }

  private async request(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest,
  ): Promise<unknown> {
    const database = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("無法存取離線快照。"));
        transaction.onabort = () => reject(transaction.error ?? new Error("離線快照交易已取消。"));
      });
    } finally {
      database.close();
    }
  }
}
