import { parseTripHome, parseTripDay, parseSharedChecklistResponse, parseStaysResponse, parseExpensesResponse } from "@travel-book/contracts";
import type { HomeRepository } from "../home/homeRepository";
import type { ItineraryRepository } from "../itinerary/itineraryRepository";
import type { StaysRepository } from "../stays/staysRepository";
import type { SharedChecklistRepository } from "../checklists/sharedChecklistRepository";
import type { ExpensesRepository } from "../expenses/expensesRepository";
import { ResourceCache } from "./resourceCache";

export function cachedHome(source: HomeRepository, cache: ResourceCache): HomeRepository {
  return {
    getTripHome: () => cache.read("home", () => source.getTripHome(), (data) => { const p = parseTripHome(data); return p.ok ? p.value : null; }),
    saveTravelFacts: (facts, version) => cache.mutate("home", () => source.saveTravelFacts(facts, version), (data) => cache.set("home", data)),
  };
}
export function cachedItinerary(source: ItineraryRepository, cache: ResourceCache): ItineraryRepository {
  return {
    searchPlaces: source.searchPlaces ? (query, city) => cache.authorize(() => source.searchPlaces!(query, city)) : undefined,
    getDay: (date) => cache.read(`day:${date}`, () => source.getDay(date), (data) => { const p = parseTripDay(data); return p.ok && p.value.date === date ? p.value : null; }),
    saveDayItems: (date, items, version) => cache.mutate(`day:${date}`, () => source.saveDayItems(date, items, version), (data) => cache.set(`day:${date}`, data)),
  };
}
export function cachedChecklist(source: SharedChecklistRepository, cache: ResourceCache, key = "checklist"): SharedChecklistRepository {
  return {
    getSharedChecklist: () => cache.read(key, () => source.getSharedChecklist(), (data) => { const p = parseSharedChecklistResponse(data); return p.ok ? p.value : null; }),
    mutateSharedChecklist: (mutation, id) => cache.mutate(key, () => source.mutateSharedChecklist(mutation, id), (data) => cache.set(key, data)),
  };
}
export function cachedExpenses(source: ExpensesRepository, cache: ResourceCache): ExpensesRepository {
  return {
    getExpenses: () => cache.read("expenses", () => source.getExpenses(), (data) => { const p = parseExpensesResponse(data); return p.ok ? p.value : null; }),
    getRate: (currency, date) => source.getRate(currency, date),
    getReferenceRate: (currency, date) => source.getReferenceRate(currency, date),
    mutateExpense: (mutation, id) => cache.mutate("expenses", () => source.mutateExpense(mutation, id), (data) => cache.set("expenses", data)),
  };
}
export function cachedStays(source: StaysRepository, cache: ResourceCache): StaysRepository {
  let latest: Awaited<ReturnType<StaysRepository["getStays"]>> | undefined;
  const remember = async (data: NonNullable<typeof latest>) => {
    latest = data;
    cache.retainPhotos(new Set(data.flatMap((stay) => stay.photo ? [stay.photo.id] : [])));
    await cache.set("stays", data);
  };
  return {
    get lastSyncedAt() { return source.lastSyncedAt; },
    async getStays() {
      const data = await cache.read("stays", async () => {
        const data = await source.getStays();
        cache.retainPhotos(new Set(data.flatMap((stay) => stay.photo ? [stay.photo.id] : [])));
        return data;
      }, (data) => { const p = parseStaysResponse({ schemaVersion: 1, stays: data }); return p.ok ? p.value.stays : null; });
      latest = data; return data;
    },
    createStay: (input) => cache.mutate("stays", () => source.createStay(input), async (stay) => {
      if (latest) await remember([...latest.filter((item) => item.id !== stay.id), stay]);
    }),
    updateStay: (id, input, version) => cache.mutate("stays", () => source.updateStay(id, input, version), async (stay) => {
      if (latest) await remember(latest.map((item) => item.id === id ? stay : item));
    }),
    deleteStay: (id, version) => cache.mutate("stays", () => source.deleteStay(id, version), async () => {
      if (latest) await remember(latest.filter((stay) => stay.id !== id));
    }),
    uploadPhoto: source.uploadPhoto ? (file) => cache.authorize(() => source.uploadPhoto!(file)) : undefined,
    readPhoto: source.readPhoto ? (id) => cache.photo(id, () => source.readPhoto!(id)) : undefined,
    removePhoto: source.removePhoto ? async (id) => {
      const removed = await cache.authorize(() => source.removePhoto!(id));
      if (removed) cache.forgetPhoto(id);
      return removed;
    } : undefined,
  };
}
