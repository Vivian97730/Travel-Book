import {
  isRecord,
  parseTripHome,
  type SaveTravelFact,
  type TripHome,
} from "../../../../../packages/contracts/src/index.ts";
import type { HomeStore } from "../../handler.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export class HomeStoreRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code?: "RESOURCE_NOT_FOUND" | "VERSION_CONFLICT" | "VALIDATION_FAILED",
  ) {
    super("HOME_STORE_UNAVAILABLE");
    this.name = "HomeStoreRequestError";
  }
}

async function requestError(response: Response): Promise<HomeStoreRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const message = typeof body === "object" && body !== null && "message" in body
    ? body.message
    : null;
  const code = message === "RESOURCE_NOT_FOUND" || message === "VERSION_CONFLICT" || message === "VALIDATION_FAILED"
    ? message
    : undefined;
  return new HomeStoreRequestError(response.status, code);
}

function dateParts(value: unknown): RegExpMatchArray | null {
  return typeof value === "string" ? value.match(isoDatePattern) : null;
}

function formatDateLabel(startDate: unknown, endDate: unknown): string {
  const start = dateParts(startDate);
  const end = dateParts(endDate);
  if (!start || !end) return "";
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const startWeekday = weekdays[new Date(Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]))).getUTCDay()];
  const endWeekday = weekdays[new Date(Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]))).getUTCDay()];
  return `${start[2]}/${start[3]} (${startWeekday}) - ${end[2]}/${end[3]} (${endWeekday})`;
}

function formatDurationLabel(startDate: unknown, endDate: unknown): string {
  const start = dateParts(startDate);
  const end = dateParts(endDate);
  if (!start || !end) return "";

  const startAt = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const endAt = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  const nights = Math.round((endAt - startAt) / 86_400_000);
  return nights >= 0 ? `${nights + 1} 天 ${nights} 夜` : "";
}

function formatFlightDuration(value: unknown): string {
  if (!Number.isInteger(value) || (value as number) < 0) return "";
  const minutes = value as number;
  return `${Math.floor(minutes / 60)} 小時 ${String(minutes % 60).padStart(2, "0")} 分`;
}

function mapHomePayload(payload: unknown): TripHome | null {
  if (payload === null) return null;
  if (!isRecord(payload)) throw new Error("HOME_STORE_INVALID_RESPONSE");

  const flights = Array.isArray(payload.flights)
    ? payload.flights.map((flight) => isRecord(flight) ? {
      direction: flight.direction,
      duration: formatFlightDuration(flight.durationMinutes),
      legs: flight.legs,
    } : flight)
    : payload.flights;
  const candidate = {
    title: payload.title,
    subtitle: payload.subtitle,
    dateLabel: formatDateLabel(payload.startDate, payload.endDate),
    durationLabel: formatDurationLabel(payload.startDate, payload.endDate),
    travelerCount: payload.travelerCount,
    version: payload.version,
    flights,
    facts: payload.facts,
  };
  const parsed = parseTripHome(candidate);
  if (!parsed.ok) throw new Error("HOME_STORE_INVALID_RESPONSE");
  return parsed.value;
}

export class SupabaseHomeStore implements HomeStore {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly secretKey: string, private readonly fetcher: Fetcher = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getHome(tripId: string): Promise<TripHome | null> {
    const response = await this.fetcher(`${this.baseUrl}/rest/v1/rpc/get_trip_home`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({ p_trip_id: tripId }),
    });
    if (!response.ok) throw await requestError(response);

    const payload: unknown = await response.json();
    return mapHomePayload(payload);
  }

  async saveFacts(
    tripId: string,
    facts: readonly SaveTravelFact[],
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<TripHome> {
    const response = await this.fetcher(`${this.baseUrl}/rest/v1/rpc/save_travel_facts`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({
        p_trip_id: tripId,
        p_facts: facts,
        p_expected_version: expectedVersion,
        p_idempotency_key: idempotencyKey,
      }),
    });
    if (!response.ok) throw await requestError(response);

    const payload: unknown = await response.json();
    const home = mapHomePayload(payload);
    if (!home) throw new Error("HOME_STORE_INVALID_RESPONSE");
    return home;
  }
}
