import type { TravelFact, TripHome } from "./types";

export interface HomeRepository {
  getTripHome(): Promise<TripHome>;
  saveTravelFacts(facts: TravelFact[], expectedVersion: number): Promise<TripHome>;
}
