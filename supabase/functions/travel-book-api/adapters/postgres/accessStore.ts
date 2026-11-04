import { parseAccessVerifyResponse, type AccessVerifyResponse } from "../../../../../packages/contracts/src/index.ts";
import type { AccessStore } from "../../handler.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

interface AccessRpcRow {
  trip_id: string;
  trip_title: string;
  start_date: string;
  end_date: string;
  display_timezone: string;
  resource_versions: Record<string, number> | null;
}

export class AccessStoreRequestError extends Error {
  constructor(readonly status: number) {
    super("ACCESS_STORE_UNAVAILABLE");
    this.name = "AccessStoreRequestError";
  }
}

export class SupabaseAccessStore implements AccessStore {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly secretKey: string, private readonly fetcher: Fetcher = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async verify(token: string): Promise<AccessVerifyResponse | null> {
    const response = await this.fetcher(`${this.baseUrl}/rest/v1/rpc/verify_trip_access`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    });
    if (!response.ok) throw new AccessStoreRequestError(response.status);

    const rows = await response.json() as AccessRpcRow[];
    const row = rows[0];
    if (!row) return null;

    const parsed = parseAccessVerifyResponse({
      trip: {
        id: row.trip_id,
        title: row.trip_title,
        startDate: row.start_date,
        endDate: row.end_date,
        displayTimezone: row.display_timezone,
      },
      resourceVersions: row.resource_versions ?? {},
    });
    if (!parsed.ok) throw new Error("ACCESS_STORE_INVALID_RESPONSE");
    return parsed.value;
  }
}
