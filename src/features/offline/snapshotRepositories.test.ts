import { describe, expect, it, vi } from "vitest";
import { snapshotRepositories } from "./snapshotRepositories";
import type { CoreSnapshots } from "./coreSnapshots";

function setup() {
  let online = true;
  const day = { date: "2027-02-05", version: 1, weekday: "五", city: "維也納", summary: "", items: [] };
  const list = { schemaVersion: 1 as const, version: 1, items: [] };
  const itinerary = { getDay: vi.fn(async () => day), saveDayItems: vi.fn(async () => day) };
  const checklist = { getSharedChecklist: vi.fn(async () => list), mutateSharedChecklist: vi.fn(async () => list) };
  const store = {
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    day: vi.fn(async () => day),
    checklist: vi.fn(async () => list),
  };
  const hash = "a".repeat(64);
  const core = snapshotRepositories(itinerary, checklist, store as unknown as CoreSnapshots, Promise.resolve(hash), () => online);
  return { day, list, itinerary, checklist, store, hash, core, goOffline: () => { online = false; } };
}

describe("core offline repositories", () => {
  it("reads the current token's snapshots and prevents offline writes", async () => {
    const { core, store, itinerary, checklist, goOffline, day, list, hash } = setup();
    await core.itineraryRepository.getDay(day.date);
    await core.checklistRepository.getSharedChecklist();
    expect(store.put).toHaveBeenCalledWith(hash, "day:" + day.date, day);
    expect(store.put).toHaveBeenCalledWith(hash, "checklist", list);

    goOffline();
    await expect(core.itineraryRepository.getDay(day.date)).resolves.toEqual(day);
    await expect(core.checklistRepository.getSharedChecklist()).resolves.toEqual(list);
    expect(store.day).toHaveBeenCalledWith(hash, day.date);
    expect(store.checklist).toHaveBeenCalledWith(hash);
    await expect(core.itineraryRepository.saveDayItems(day.date, [], 1)).rejects.toThrow("OFFLINE_READ_ONLY");
    await expect(core.checklistRepository.mutateSharedChecklist({ action: "create", input: { title: "護照" } }, "fixture"))
      .rejects.toThrow("OFFLINE_READ_ONLY");
    expect(itinerary.getDay).toHaveBeenCalledOnce();
    expect(checklist.getSharedChecklist).toHaveBeenCalledOnce();
    expect(itinerary.saveDayItems).not.toHaveBeenCalled();
    expect(checklist.mutateSharedChecklist).not.toHaveBeenCalled();
  });

  it("does not restore revoked data when an in-flight request finishes", async () => {
    const { core, store, checklist, list, hash } = setup();
    let finish!: (result: typeof list) => void;
    checklist.getSharedChecklist.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = core.checklistRepository.getSharedChecklist();
    await core.revoke();
    finish(list);
    await pending;
    expect(store.delete).toHaveBeenCalledWith(hash);
    expect(store.put).not.toHaveBeenCalled();
  });
});
