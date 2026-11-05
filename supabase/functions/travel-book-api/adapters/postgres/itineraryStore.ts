import { parseTripDay, type TripDay } from "../../../../../packages/contracts/src/index.ts";
import type { ItineraryStore } from "../../handler.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ItineraryStoreRequestError extends Error {
  constructor(readonly status: number) {
    super("ITINERARY_STORE_UNAVAILABLE");
    this.name = "ItineraryStoreRequestError";
  }
}

export class SupabaseItineraryStore implements ItineraryStore {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly secretKey: string, private readonly fetcher: Fetcher = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getDay(tripId: string, date: string): Promise<TripDay | null> {
    const response = await this.fetcher(`${this.baseUrl}/rest/v1/rpc/get_trip_day`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({ p_trip_id: tripId, p_date: date }),
    });
    if (!response.ok) throw new ItineraryStoreRequestError(response.status);

    const payload: unknown = await response.json();
    if (payload === null) return null;
    const parsed = parseTripDay(payload);
    if (!parsed.ok) throw new Error("ITINERARY_STORE_INVALID_RESPONSE");
    return parsed.value;
  }
}
