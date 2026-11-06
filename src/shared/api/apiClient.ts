import {
  parseAccessVerifyResponse,
  parseApiError,
  parseTripDay,
  type AccessVerifyResponse,
  type ApiErrorCode,
  type SaveTripDayItem,
  type TripDay,
} from "@travel-book/contracts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiClientError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly requestId: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, requestId: this.requestId, details: this.details };
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly fetcher: Fetcher = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async verifyAccess(token: string): Promise<AccessVerifyResponse> {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl}/v1/access/verify`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "x-request-id": requestId,
        },
        body: "{}",
      });
    } catch {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "目前無法連線，請稍後再試。", requestId);
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = parseApiError(body);
      if (parsedError.ok) {
        const { code, message, requestId: responseRequestId, details } = parsedError.value.error;
        throw new ApiClientError(code, message, responseRequestId, details);
      }
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId);
    }

    const parsed = parseAccessVerifyResponse(body);
    if (!parsed.ok) {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId, { issues: parsed.issues });
    }
    return parsed.value;
  }

  async getTripDay(token: string, date: string): Promise<TripDay> {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl}/v1/days/${encodeURIComponent(date)}`, {
        headers: {
          authorization: `Bearer ${token}`,
          "x-request-id": requestId,
        },
      });
    } catch {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "目前無法連線，請稍後再試。", requestId);
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = parseApiError(body);
      if (parsedError.ok) {
        const { code, message, requestId: responseRequestId, details } = parsedError.value.error;
        throw new ApiClientError(code, message, responseRequestId, details);
      }
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId);
    }

    const parsed = parseTripDay(body);
    if (!parsed.ok) {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId, { issues: parsed.issues });
    }
    return parsed.value;
  }

  async saveTripDayItems(
    token: string,
    date: string,
    items: readonly SaveTripDayItem[],
    expectedVersion: number,
  ): Promise<TripDay> {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl}/v1/days/${encodeURIComponent(date)}`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
          "x-request-id": requestId,
        },
        body: JSON.stringify({ expectedVersion, items }),
      });
    } catch {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "目前無法連線，請稍後再試。", requestId);
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = parseApiError(body);
      if (parsedError.ok) {
        const { code, message, requestId: responseRequestId, details } = parsedError.value.error;
        throw new ApiClientError(code, message, responseRequestId, details);
      }
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId);
    }

    const parsed = parseTripDay(body);
    if (!parsed.ok) {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId, { issues: parsed.issues });
    }
    return parsed.value;
  }
}
