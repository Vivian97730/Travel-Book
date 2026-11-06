import type { SaveTripDayItem, TripDay } from "@travel-book/contracts";

export interface ItineraryRepository {
  getDay(date: string): Promise<TripDay>;
  saveDayItems(date: string, items: readonly SaveTripDayItem[], expectedVersion: number): Promise<TripDay>;
}
