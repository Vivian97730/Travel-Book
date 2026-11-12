import { isRecord, parseApiError, parseExpensesResponse, type ExpenseCurrency, type ExpenseMutation } from "@travel-book/contracts";
import { ApiClientError } from "../../shared/api/apiClient";
import type { ExpensesRepository } from "./expensesRepository";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiExpensesRepository implements ExpensesRepository {
  constructor(private readonly baseUrl: string, private readonly token: string, private readonly fetcher: Fetcher = fetch) {}

  async getExpenses() {
    return this.readExpenses(await this.request("/v1/expenses"));
  }

  async getRate(currency: ExpenseCurrency, date: string) {
    const { body, requestId } = await this.request(`/v1/rates?${new URLSearchParams({ currency, date })}`);
    if (isRecord(body) && body.currency === currency && body.date === date
      && (body.rate === null || (typeof body.rate === "string" && /^\d+(?:\.\d+)?$/.test(body.rate) && /[1-9]/.test(body.rate)))) {
      return body.rate;
    }
    throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "匯率回應格式不正確。", requestId);
  }

  async mutateExpense(mutation: ExpenseMutation, idempotencyKey: string) {
    const path = mutation.id === null ? "/v1/expenses" : `/v1/expenses/${mutation.id}`;
    return this.readExpenses(await this.request(path, {
      method: mutation.action === "create" ? "POST" : mutation.action === "update" ? "PATCH" : "DELETE",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ ...mutation.input, expectedVersion: mutation.expectedVersion }),
    }));
  }

  private async request(path: string, init?: RequestInit) {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: { ...init?.headers, authorization: `Bearer ${this.token}`, "x-request-id": requestId },
        cache: "no-store",
      });
    } catch {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "目前無法連線，請稍後再試。", requestId);
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = parseApiError(body);
      if (error.ok) {
        const { code, message, requestId: responseId, details } = error.value.error;
        throw new ApiClientError(code, message, responseId, details);
      }
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用。", requestId);
    }
    return { body, requestId };
  }

  private readExpenses({ body, requestId }: { body: unknown; requestId: string }) {
    const parsed = parseExpensesResponse(body);
    if (!parsed.ok) throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "支出回應格式不正確。", requestId);
    return parsed.value;
  }
}
