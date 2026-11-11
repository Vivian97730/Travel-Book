import { parseApiError, parseExpensesResponse } from "@travel-book/contracts";
import { ApiClientError } from "../../shared/api/apiClient";
import type { ExpensesRepository } from "./expensesRepository";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiExpensesRepository implements ExpensesRepository {
  constructor(private readonly baseUrl: string, private readonly token: string, private readonly fetcher: Fetcher = fetch) {}

  async getExpenses() {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}/v1/expenses`, {
        headers: { authorization: `Bearer ${this.token}`, "x-request-id": requestId },
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
    const parsed = parseExpensesResponse(body);
    if (!parsed.ok) throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "支出回應格式不正確。", requestId);
    return parsed.value;
  }
}
