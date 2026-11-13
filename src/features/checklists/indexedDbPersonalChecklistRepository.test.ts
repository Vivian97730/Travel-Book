import { describe, expect, it, vi } from "vitest";
import { IndexedDbPersonalChecklistRepository } from "./indexedDbPersonalChecklistRepository";

function pendingWrite() {
  const request = { result: 7 };
  const add = vi.fn(() => request);
  const transaction = {
    objectStore: () => ({ add }),
    oncomplete: null as (() => void) | null,
    onabort: null as (() => void) | null,
    error: null as DOMException | null,
  };
  const database = { close: vi.fn(), transaction: () => transaction };
  const open = {
    result: database,
    onsuccess: null as (() => void) | null,
  };
  const factory = {
    open: vi.fn(() => {
      queueMicrotask(() => open.onsuccess?.());
      return open;
    }),
  };
  return {
    repository: new IndexedDbPersonalChecklistRepository(factory as unknown as IDBFactory),
    factory,
    database,
    transaction,
    add,
  };
}

describe("IndexedDB personal checklist writes", () => {
  it("returns the saved item only after the transaction commits", async () => {
    const { repository, transaction, add, database } = pendingWrite();
    const settled = vi.fn();
    const result = repository.addItem("luggage", " 轉接頭 ").then(settled);
    await vi.waitFor(() => expect(add).toHaveBeenCalledWith({ title: "轉接頭", isDone: false }));
    expect(settled).not.toHaveBeenCalled();
    expect(database.close).not.toHaveBeenCalled();

    transaction.oncomplete?.();
    await result;
    expect(settled).toHaveBeenCalledWith({ id: 7, title: "轉接頭", isDone: false });
    expect(database.close).toHaveBeenCalledOnce();
  });

  it("rejects an aborted write even if the request has a result", async () => {
    const { repository, transaction, add, database } = pendingWrite();
    const result = repository.addItem("todos", "確認漫遊");
    const aborted = expect(result).rejects.toMatchObject({ name: "QuotaExceededError" });
    await vi.waitFor(() => expect(add).toHaveBeenCalledOnce());
    transaction.error = new DOMException("Storage full", "QuotaExceededError");
    transaction.onabort?.();
    await aborted;
    expect(database.close).toHaveBeenCalledOnce();
  });

  it("rejects a blank title before opening storage", async () => {
    const { repository, factory } = pendingWrite();
    await expect(repository.addItem("todos", "　 ")).rejects.toThrow("清單名稱");
    expect(factory.open).not.toHaveBeenCalled();
  });
});
