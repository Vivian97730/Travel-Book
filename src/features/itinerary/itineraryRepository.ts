import type { SaveTripDayItem, TripDay, PlaceSearchCandidate } from "@travel-book/contracts";

export interface ItineraryRepository {
  searchPlaces?(query: string, city: string): Promise<PlaceSearchCandidate[]>;
  getDay(date: string): Promise<TripDay>;
  saveDayItems(date: string, items: readonly SaveTripDayItem[], expectedVersion: number): Promise<TripDay>;
}
