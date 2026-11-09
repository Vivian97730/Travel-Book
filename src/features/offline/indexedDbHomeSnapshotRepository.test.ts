import { describe, expect, it } from "vitest";
import { initialTripHome } from "../home/data";
import { createHomeSnapshot, hashAccessToken } from "./homeSnapshotRepository";
import { IndexedDbHomeSnapshotRepository } from "./indexedDbHomeSnapshotRepository";

const access = {
  trip: {
    id: "10000000-0000-4000-8000-000000000001",
    title: "2027 過年東歐遊",
    startDate: "2027-02-05",
    endDate: "2027-02-15",
    displayTimezone: "Asia/Taipei",
  },
  resourceVersions: { home: 1 },
};

function createFakeIndexedDb(): IDBFactory {
  const values = new Map<string, unknown>();
  const names = { contains: () => true };
  const store = {
    get(key: string) {
      return completeRequest(values.get(key));
    },
    put(value: { tokenHash: string }) {
      values.set(value.tokenHash, structuredClone(value));
      return completeRequest(value.tokenHash);
    },
    delete(key: string) {
      values.delete(key);
      return completeRequest(undefined);
    },
  };
  const database = {
    objectStoreNames: names,
    createObjectStore: () => store,
    transaction: () => ({ objectStore: () => store }),
    close: () => undefined,
  };
  return {
    open: () => completeRequest(database),
  } as unknown as IDBFactory;
}

function completeRequest<T>(result: T): IDBRequest<T> {
  const request = { result, error: null, onsuccess: null, onerror: null } as unknown as IDBRequest<T>;
  queueMicrotask(() => request.onsuccess?.(new Event("success") as IDBRequestEventMap["success"]));
  return request;
}

describe("IndexedDB home snapshot adapter", () => {
  it("round-trips and deletes the same snapshot contract", async () => {
    const repository = new IndexedDbHomeSnapshotRepository(createFakeIndexedDb());
    const tokenHash = await hashAccessToken("private-token");
    const snapshot = createHomeSnapshot({ tokenHash, access, home: initialTripHome });

    await repository.put(snapshot);
    await expect(repository.get(tokenHash)).resolves.toEqual(snapshot);
    await repository.delete(tokenHash);
    await expect(repository.get(tokenHash)).resolves.toBeNull();
  });
});
