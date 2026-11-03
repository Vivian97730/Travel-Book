import type { TravelFact, TripHome } from "./types";
import type { HomeRepository } from "./homeRepository";
import { normalizeTravelFacts } from "./normalizeTravelFacts";

export class FakeHomeRepository implements HomeRepository {
  private home: TripHome;

  constructor(initialHome: TripHome) {
    this.home = structuredClone(initialHome);
  }

  async getTripHome(): Promise<TripHome> {
    return structuredClone(this.home);
  }

  async saveTravelFacts(facts: TravelFact[], expectedVersion: number): Promise<TripHome> {
    if (this.home.version !== expectedVersion) throw new Error("VERSION_CONFLICT");

    this.home = {
      ...this.home,
      facts: normalizeTravelFacts(facts),
      version: this.home.version + 1,
    };
    return structuredClone(this.home);
  }
}
