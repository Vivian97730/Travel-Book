import type { ItineraryRepository } from "../itinerary/itineraryRepository";
import type { SharedChecklistRepository } from "../checklists/sharedChecklistRepository";
import type { CoreSnapshots } from "./coreSnapshots";

export function snapshotRepositories(
  itinerary: ItineraryRepository, checklist: SharedChecklistRepository,
  snapshots: CoreSnapshots, tokenHash: Promise<string>, online: () => boolean,
) {
  let active = true;
  const writes = new Set<Promise<unknown>>();

  async function record<T>(resource: string, result: T): Promise<T> {
    const hash = await tokenHash;
    if (active) {
      const write = snapshots.put(hash, resource, result).catch(() => undefined);
      writes.add(write);
      await write;
      writes.delete(write);
    }
    return result;
  }

  function requireOnline() {
    if (!active || !online()) throw new Error("OFFLINE_READ_ONLY");
  }

  const itineraryRepository: ItineraryRepository = {
    async getDay(date) {
      return online() ? record("day:" + date, await itinerary.getDay(date)) : snapshots.day(await tokenHash, date);
    },
    async saveDayItems(date, items, version) {
      requireOnline();
      return record("day:" + date, await itinerary.saveDayItems(date, items, version));
    },
  };
  const checklistRepository: SharedChecklistRepository = {
    async getSharedChecklist() {
      return online() ? record("checklist", await checklist.getSharedChecklist()) : snapshots.checklist(await tokenHash);
    },
    async mutateSharedChecklist(mutation, key) {
      requireOnline();
      return record("checklist", await checklist.mutateSharedChecklist(mutation, key));
    },
  };
  return {
    itineraryRepository, checklistRepository,
    async rememberAccess(access: unknown) { await record("access", access); },
    async revoke() {
      active = false;
      await Promise.allSettled(writes);
      await snapshots.delete(await tokenHash);
    },
  };
}
