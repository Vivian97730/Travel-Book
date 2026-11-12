import { describe, expect, it, vi } from "vitest";
import { readChecklist, writeChecklist, type ChecklistSource } from "./checklistSource";
import type { SharedChecklistItem } from "@travel-book/contracts";

const sharedItem: SharedChecklistItem = {
  id: "c1000000-0000-4000-8000-000000000001", version: 3, sortOrder: 0, title: "護照", isDone: false,
};
const personalItem = { id: 1, title: "行李", isDone: false };

describe("checklist page data routing", () => {
  it("uses the shared server response and carries the item version on a toggle", async () => {
    const latest = [{ ...sharedItem, isDone: true, version: 4 }];
    const response = { schemaVersion: 1 as const, version: 5, items: latest };
    const repository = {
      getSharedChecklist: vi.fn(async () => ({ ...response, items: [sharedItem] })),
      mutateSharedChecklist: vi.fn(async () => response),
    };
    const source: ChecklistSource = { kind: "essentials", repository };
    await expect(readChecklist(source)).resolves.toEqual([sharedItem]);
    await expect(writeChecklist(source, { action: "toggle", item: sharedItem }, "receipt", [sharedItem])).resolves.toEqual(latest);
    expect(repository.mutateSharedChecklist).toHaveBeenCalledWith({
      action: "update", id: sharedItem.id, expectedVersion: 3, input: { isDone: true },
    }, "receipt");
  });

  it.each(["luggage", "todos"] as const)("routes %s only through the selected personal store", async (kind) => {
    const renamed = { ...personalItem, title: "更新項目" };
    const repository = {
      getItems: vi.fn(async () => [personalItem]),
      addItem: vi.fn(async () => personalItem),
      updateItem: vi.fn(async () => renamed),
      deleteItem: vi.fn(async () => {}),
    };
    const source: ChecklistSource = { kind, repository };
    await expect(readChecklist(source)).resolves.toEqual([personalItem]);
    await expect(writeChecklist(source, { action: "create", title: "行李" }, "unused", [])).resolves.toEqual([personalItem]);
    await expect(writeChecklist(source, { action: "rename", item: personalItem, title: "更新項目" }, "unused", [personalItem])).resolves.toEqual([renamed]);
    await expect(writeChecklist(source, { action: "delete", item: renamed }, "unused", [renamed])).resolves.toEqual([]);
    expect(repository.getItems).toHaveBeenCalledWith(kind);
    expect(repository.addItem).toHaveBeenCalledWith(kind, "行李");
    expect(repository.updateItem).toHaveBeenCalledWith(kind, 1, { title: "更新項目" });
    expect(repository.deleteItem).toHaveBeenCalledWith(kind, 1);
  });
});
