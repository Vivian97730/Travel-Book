import { describe, expect, it, vi } from "vitest";
import { importLegacyChecklist } from "./LegacyChecklistImport";
import type { SharedChecklistRepository } from "../checklists/sharedChecklistRepository";
import type { TripMember } from "@travel-book/contracts";
const mother: TripMember = { tripId: "11111111-1111-4111-8111-111111111111", id: "22222222-2222-4222-8222-222222222222", roleKey: "mother", displayName: "媽媽" };
const items = [ { kind: "luggage" as const, item: { id: 1, title: "護照", isDone: true } },
  { kind: "todos" as const, item: { id: 2, title: "保險", isDone: false } } ];
function setup() {
  const values = new Map<string,string>();
  const storage = { getItem: (key:string) => values.get(key) ?? null, setItem: (key:string,value:string) => { values.set(key,value); } };
  const mutate = vi.fn<SharedChecklistRepository["mutateSharedChecklist"]>(async () => ({ schemaVersion: 1 as const, version: 1, items: [] }));
  const repository = { forKind: vi.fn(() => ({ getSharedChecklist: async () => ({ schemaVersion: 1 as const, version: 1, items: [] }), mutateSharedChecklist: mutate })) };
  return { storage, mutate, repository };
}
describe("explicit legacy checklist migration", () => {
  it("does not transmit any old data when ownership cannot be persisted", async () => {
    const {storage,repository,mutate} = setup();
    storage.setItem = () => { throw new Error("storage denied"); };
    await expect(importLegacyChecklist(items,mother,repository,storage)).rejects.toThrow();
    expect(mutate).not.toHaveBeenCalled();
  });
  it("binds a partial import to one owner and retries identical receipts without losing completion state", async () => {
    const {storage,repository,mutate} = setup();
    mutate.mockRejectedValueOnce(new Error("connection lost after commit"));
    await expect(importLegacyChecklist(items,mother,repository,storage)).rejects.toThrow();
    const firstKey = mutate.mock.calls[0][1];
    await expect(importLegacyChecklist(items,{...mother,id:mother.tripId},repository,storage)).rejects.toThrow("IMPORT_ALREADY_BOUND");
    await importLegacyChecklist(items,mother,repository,storage);
    expect(mutate.mock.calls[1][1]).toBe(firstKey);
    expect(mutate.mock.calls[1][0]).toEqual({action:"create",input:{title:"護照",isDone:true}});
    await expect(importLegacyChecklist(items,mother,repository,storage)).rejects.toThrow("IMPORT_ALREADY_BOUND");
  });
});
