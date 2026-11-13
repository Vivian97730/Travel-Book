import { parseApiError, parseSharedChecklistResponse, type SharedChecklistMutation } from "@travel-book/contracts";
import { ApiClientError } from "../../shared/api/apiClient";
import type { SharedChecklistRepository } from "./sharedChecklistRepository";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiSharedChecklistRepository implements SharedChecklistRepository {
  constructor(private readonly baseUrl: string, private readonly token: string, private readonly fetcher: Fetcher = fetch) {}

  async getSharedChecklist() {
    return this.readChecklist(await this.request("/v1/checklists/shared"));
  }

  async mutateSharedChecklist(mutation: SharedChecklistMutation, idempotencyKey: string) {
    const path = mutation.action === "create" ? "/v1/checklists/shared" : `/v1/checklists/shared/${encodeURIComponent(mutation.id)}`;
    const body = mutation.action === "create" ? mutation.input
      : mutation.action === "update" ? { ...mutation.input, expectedVersion: mutation.expectedVersion }
        : { expectedVersion: mutation.expectedVersion };
    return this.readChecklist(await this.request(path, {
      method: mutation.action === "create" ? "POST" : mutation.action === "update" ? "PATCH" : "DELETE",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
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

  private readChecklist({ body, requestId }: { body: unknown; requestId: string }) {
    const parsed = parseSharedChecklistResponse(body);
    if (!parsed.ok) throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "共享清單回應格式不正確。", requestId);
    return parsed.value;
  }
}
