import { parseTripDay, type SaveTripDayItem, type TripDay } from "../../../../../packages/contracts/src/index.ts";
import type { ItineraryStore } from "../../handler.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ItineraryStoreRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: "RESOURCE_NOT_FOUND" | "VERSION_CONFLICT" | "VALIDATION_FAILED",
  ) {
    super("ITINERARY_STORE_UNAVAILABLE");
    this.name = "ItineraryStoreRequestError";
  }
}

async function requestError(response: Response): Promise<ItineraryStoreRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const message = typeof body === "object" && body !== null && "message" in body
    ? body.message
    : null;
  const code = message === "RESOURCE_NOT_FOUND" || message === "VERSION_CONFLICT" || message === "VALIDATION_FAILED"
    ? message
    : undefined;
  return new ItineraryStoreRequestError(response.status, code);
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
    if (!response.ok) throw await requestError(response);

    const payload: unknown = await response.json();
    if (payload === null) return null;
    const parsed = parseTripDay(payload);
    if (!parsed.ok) throw new Error("ITINERARY_STORE_INVALID_RESPONSE");
    return parsed.value;
  }

  async saveDayItems(
    tripId: string,
    date: string,
    items: readonly SaveTripDayItem[],
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<TripDay> {
    const response = await this.fetcher(`${this.baseUrl}/rest/v1/rpc/save_trip_day_items`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({
        p_trip_id: tripId,
        p_date: date,
        p_items: items,
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey,
      }),
    });
    if (!response.ok) throw await requestError(response);

    const payload: unknown = await response.json();
    const parsed = parseTripDay(payload);
    if (!parsed.ok) throw new Error("ITINERARY_STORE_INVALID_RESPONSE");
    return parsed.value;
  }
}
