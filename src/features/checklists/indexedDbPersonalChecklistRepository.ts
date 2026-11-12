import {
  normalizePersonalChecklistTitle,
  type PersonalChecklistItem,
  type PersonalChecklistKind,
  type PersonalChecklistPatch,
  type PersonalChecklistRepository,
} from "./personalChecklistRepository";

const DATABASE_NAME = "travel-book.personal-checklists.v1";
const STORE_NAMES = { luggage: "personal-luggage-items", todos: "personal-todo-items" } as const;

export class IndexedDbPersonalChecklistRepository implements PersonalChecklistRepository {
  constructor(private readonly factory: IDBFactory = indexedDB) {}

  getItems(kind: PersonalChecklistKind): Promise<PersonalChecklistItem[]> {
    return this.transact(kind, "readonly", (store) => {
      const request: IDBRequest<PersonalChecklistItem[]> = store.getAll();
      return () => request.result;
    });
  }

  async addItem(kind: PersonalChecklistKind, input: string): Promise<PersonalChecklistItem> {
    const title = normalizePersonalChecklistTitle(input);
    return this.transact(kind, "readwrite", (store) => {
      const item = { title, isDone: false };
      const request = store.add(item);
      return () => ({ ...item, id: Number(request.result) });
    });
  }

  async updateItem(kind: PersonalChecklistKind, id: number, patch: PersonalChecklistPatch): Promise<PersonalChecklistItem> {
    const title = patch.title === undefined ? undefined : normalizePersonalChecklistTitle(patch.title);
    const { isDone } = patch;
    return this.transact(kind, "readwrite", (store) => {
      const request: IDBRequest<PersonalChecklistItem | undefined> = store.get(id);
      let updated: PersonalChecklistItem | undefined;
      request.onsuccess = () => {
        const item = request.result;
        if (!item) return;
        updated = { id, title: title ?? item.title, isDone: isDone ?? item.isDone };
        store.put(updated);
      };
      return () => {
        if (!updated) throw new Error("找不到指定清單項目。");
        return updated;
      };
    });
  }

  deleteItem(kind: PersonalChecklistKind, id: number): Promise<void> {
    return this.transact(kind, "readwrite", (store) => {
      store.delete(id);
      return () => undefined;
    });
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        for (const name of Object.values(STORE_NAMES)) {
          request.result.createObjectStore(name, { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("無法開啟裝置端清單。"));
    });
  }

  private async transact<T>(
    kind: PersonalChecklistKind,
    mode: IDBTransactionMode,
    schedule: (store: IDBObjectStore) => () => T,
  ): Promise<T> {
    const database = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAMES[kind], mode);
        transaction.onabort = () => reject(transaction.error ?? new Error("無法存取裝置端清單。"));
        const result = schedule(transaction.objectStore(STORE_NAMES[kind]));
        // Individual requests can succeed before the transaction commits.
        transaction.oncomplete = () => {
          try {
            resolve(result());
          } catch (error) {
            reject(error);
          }
        };
      });
    } finally {
      database.close();
    }
  }
}
