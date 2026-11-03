import { initialTripHome } from "./data";
import type { TravelFact, TripHome } from "./types";

const STORAGE_KEY = "travel-book.home.v1";

export interface HomeRepository {
  getTripHome(): Promise<TripHome>;
  saveTravelFacts(facts: TravelFact[], expectedVersion: number): Promise<TripHome>;
}

function normalizeFacts(facts: TravelFact[]): TravelFact[] {
  return facts.map((fact, index) => ({
    ...fact,
    title: fact.title.trim(),
    content: fact.content.trim(),
    sortOrder: index,
  }));
}

export class BrowserHomeRepository implements HomeRepository {
  async getTripHome(): Promise<TripHome> {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(initialTripHome);

    try {
      const parsed = JSON.parse(saved) as Pick<TripHome, "facts" | "version">;
      return { ...structuredClone(initialTripHome), facts: parsed.facts, version: parsed.version };
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return structuredClone(initialTripHome);
    }
  }

  async saveTravelFacts(facts: TravelFact[], expectedVersion: number): Promise<TripHome> {
    const current = await this.getTripHome();
    if (current.version !== expectedVersion) {
      throw new Error("VERSION_CONFLICT");
    }

    const next = {
      ...current,
      facts: normalizeFacts(facts),
      version: current.version + 1,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ facts: next.facts, version: next.version }));
    return next;
  }
}
