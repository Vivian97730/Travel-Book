import type { ItineraryRepository } from "../itinerary/itineraryRepository";
import type { SharedChecklistRepository } from "../checklists/sharedChecklistRepository";
import type { CoreSnapshots } from "./coreSnapshots";

export function snapshotRepositories(
  itinerary: ItineraryRepository, checklist: SharedChecklistRepository,
  snapshots: CoreSnapshots, tokenHash: Promise<string>, online: () => boolean,
) {
  let active = true;
  const revisions = new Map<string, number>();
  const writes = new Set<Promise<unknown>>();

  async function record<T>(resource: string, result: T, revision = revisions.get(resource) ?? 0): Promise<T> {
    const hash = await tokenHash;
    if (active && revision === (revisions.get(resource) ?? 0)) {
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
    searchPlaces: itinerary.searchPlaces ? async (query, city) => {
      requireOnline();
      return itinerary.searchPlaces!(query, city);
    } : undefined,
    async getDay(date) {
      const resource = "day:" + date;
      const revision = revisions.get(resource) ?? 0;
      return online() ? record(resource, await itinerary.getDay(date), revision) : snapshots.day(await tokenHash, date);
    },
    async saveDayItems(date, items, version) {
      requireOnline();
      revisions.set("day:" + date, (revisions.get("day:" + date) ?? 0) + 1);
      return record("day:" + date, await itinerary.saveDayItems(date, items, version));
    },
  };
  const checklistRepository: SharedChecklistRepository = {
    async getSharedChecklist() {
      const revision = revisions.get("checklist") ?? 0;
      return online() ? record("checklist", await checklist.getSharedChecklist(), revision) : snapshots.checklist(await tokenHash);
    },
    async mutateSharedChecklist(mutation, key) {
      requireOnline();
      revisions.set("checklist", (revisions.get("checklist") ?? 0) + 1);
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
