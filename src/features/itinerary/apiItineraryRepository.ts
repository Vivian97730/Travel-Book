import type { SaveTripDayItem, TripDay } from "@travel-book/contracts";
import { ApiClient } from "../../shared/api/apiClient";
import type { ItineraryRepository } from "./itineraryRepository";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiItineraryRepository implements ItineraryRepository {
  private readonly client: ApiClient;

  constructor(baseUrl: string, private readonly accessToken: string, fetcher: Fetcher = fetch) {
    this.client = new ApiClient(baseUrl, fetcher);
  }

  getDay(date: string): Promise<TripDay> {
    return this.client.getTripDay(this.accessToken, date);
  }

  saveDayItems(date: string, items: readonly SaveTripDayItem[], expectedVersion: number): Promise<TripDay> {
    return this.client.saveTripDayItems(this.accessToken, date, items, expectedVersion);
  }
}
