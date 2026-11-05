import type { TripDay } from "@travel-book/contracts";

export interface ItineraryRepository {
  getDay(date: string): Promise<TripDay>;
}
