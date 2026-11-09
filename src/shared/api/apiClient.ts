import {
  parseAccessVerifyResponse,
  parseApiError,
  parseSaveTravelFactsRequest,
  parseTripHome,
  parseTripDay,
  type AccessVerifyResponse,
  type ApiErrorCode,
  type SaveTripDayItem,
  type TravelFact,
  type TripDay,
  type TripHome,
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

  async getTripHome(token: string): Promise<TripHome> {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl}/v1/home`, {
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

    const parsed = parseTripHome(body);
    if (!parsed.ok) {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId, { issues: parsed.issues });
    }
    return parsed.value;
  }

  async saveTravelFacts(
    token: string,
    facts: readonly TravelFact[],
    expectedVersion: number,
  ): Promise<TripHome> {
    const requestId = crypto.randomUUID();
    const body = {
      expectedVersion,
      facts: facts.map(({ id, icon, title, content }, sortOrder) => ({ id, icon, title, content, sortOrder })),
    };
    const parsedRequest = parseSaveTravelFactsRequest(body);
    if (!parsedRequest.ok) {
      throw new ApiClientError("VALIDATION_FAILED", "小知識保存資料格式不正確。", requestId, { issues: parsedRequest.issues });
    }

    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl}/v1/home/facts`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
          "x-request-id": requestId,
        },
        body: JSON.stringify(parsedRequest.value),
      });
    } catch {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "目前無法連線，請稍後再試。", requestId);
    }

    const responseBody: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = parseApiError(responseBody);
      if (parsedError.ok) {
        const { code, message, requestId: responseRequestId, details } = parsedError.value.error;
        throw new ApiClientError(code, message, responseRequestId, details);
      }
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId);
    }

    const parsed = parseTripHome(responseBody);
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
