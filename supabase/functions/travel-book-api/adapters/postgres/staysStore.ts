import { parseStaysResponse, type StayInput, type StaysResponse } from "../../../../../packages/contracts/src/index.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class StaysStoreError extends Error {
  constructor(readonly code?: "VALIDATION_FAILED" | "RESOURCE_NOT_FOUND" | "VERSION_CONFLICT") {
    super("STAYS_STORE_UNAVAILABLE");
  }
}

export class SupabaseStaysStore {
  constructor(private readonly baseUrl: string, private readonly secretKey: string, private readonly fetcher: Fetcher = fetch) {}

  async mutateStay(tripId: string, action: "create" | "update" | "delete", id: string | null, input: StayInput | null, expectedVersion: number, idempotencyKey: string): Promise<StaysResponse> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/rpc/mutate_trip_stay`, {
      method: "POST", headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({ p_trip_id: tripId, p_action: action, p_id: id, p_input: input, p_expected_version: expectedVersion, p_idempotency_key: idempotencyKey }),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof body === "object" && body !== null && "message" in body ? body.message : null;
      throw new StaysStoreError(message === "VALIDATION_FAILED" || message === "RESOURCE_NOT_FOUND" || message === "VERSION_CONFLICT" ? message : undefined);
    }
    const parsed = parseStaysResponse(body);
    if (!parsed.ok) throw new StaysStoreError();
    return parsed.value;
  }

  async getStays(tripId: string): Promise<StaysResponse | null> {
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_trip_stays`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({ p_trip_id: tripId }),
    });
    if (!response.ok) throw new Error("STAYS_STORE_UNAVAILABLE");
    const body: unknown = await response.json();
    if (body === null) return null;
    const parsed = parseStaysResponse(body);
    if (!parsed.ok) throw new Error("STAYS_STORE_INVALID_RESPONSE");
    return parsed.value;
  }
}
