import { initialTripHome } from "./data";
import type { HomeRepository } from "./homeRepository";
import { normalizeTravelFacts } from "./normalizeTravelFacts";
import type { TravelFact, TripHome } from "./types";

const STORAGE_KEY = "travel-book.home.v1";

export interface HomeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class BrowserHomeRepository implements HomeRepository {
  constructor(private readonly storage: HomeStorage = window.localStorage) {}

  async getTripHome(): Promise<TripHome> {
    const saved = this.storage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(initialTripHome);

    try {
      const parsed = JSON.parse(saved) as Pick<TripHome, "facts" | "version">;
      return { ...structuredClone(initialTripHome), facts: parsed.facts, version: parsed.version };
    } catch {
      this.storage.removeItem(STORAGE_KEY);
      return structuredClone(initialTripHome);
    }
  }

  async saveTravelFacts(facts: TravelFact[], expectedVersion: number): Promise<TripHome> {
    const current = await this.getTripHome();
    if (current.version !== expectedVersion) throw new Error("VERSION_CONFLICT");

    const next = {
      ...current,
      facts: normalizeTravelFacts(facts),
      version: current.version + 1,
    };
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ facts: next.facts, version: next.version }));
    return next;
  }
}
