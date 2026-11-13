import { isStayPhoto, parseApiError, parseStayInput, parseStaysResponse, type Stay, type StayInput } from "@travel-book/contracts";
import { ApiClientError } from "../../shared/api/apiClient";
import type { StaysRepository } from "./staysRepository";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiStaysRepository implements StaysRepository {
  private readonly pendingKeys = new Map<string, string>();
  constructor(private readonly baseUrl: string, private readonly token: string, private readonly fetcher: Fetcher = fetch) {}

  async uploadPhoto(file: Blob): Promise<{ id: string }> {
    const fetcher = this.fetcher;
    const response = await fetcher(`${this.baseUrl.replace(/\/$/, "")}/v1/stay-photos`, {
      method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "image/jpeg" }, body: file,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isStayPhoto(body)) {
      throw new Error("照片上傳失敗，請稍後重試。");
    }
    return body;
  }

  async readPhoto(id: string): Promise<Blob> {
    const fetcher = this.fetcher;
    const response = await fetcher(`${this.baseUrl.replace(/\/$/, "")}/v1/stay-photos/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${this.token}` }, cache: "no-store",
    });
    if (!response.ok) throw new Error("照片讀取失敗。");
    return response.blob();
  }

  async createStay(input: StayInput): Promise<Stay> {
    const stays = await this.mutate("POST", "", input, 0);
    if (stays.length !== 1) throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", "");
    return stays[0];
  }

  async updateStay(id: string, input: StayInput, expectedVersion: number): Promise<Stay> {
    const stays = await this.mutate("PATCH", id, input, expectedVersion);
    if (stays.length !== 1 || stays[0].id !== id) throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", "");
    return stays[0];
  }

  async deleteStay(id: string, expectedVersion: number): Promise<void> {
    await this.mutate("DELETE", id, null, expectedVersion);
  }

  private async mutate(method: string, id: string, input: StayInput | null, expectedVersion: number): Promise<Stay[]> {
    const requestId = crypto.randomUUID();
    if ((input !== null && !parseStayInput(input).ok)
      || (method !== "POST" && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1))) {
      throw new ApiClientError("VALIDATION_FAILED", "住宿資料格式不正確。", requestId);
    }
    const body = JSON.stringify({ ...input, ...(method === "POST" ? {} : { expectedVersion }) });
    const signature = JSON.stringify([method, id, body]);
    const key = this.pendingKeys.get(signature) ?? crypto.randomUUID();
    this.pendingKeys.set(signature, key);
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl.replace(/\/$/, "")}/v1/stays${id ? `/${encodeURIComponent(id)}` : ""}`, {
        method, headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json",
          "idempotency-key": key, "x-request-id": requestId }, body,
      });
    } catch {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "目前無法連線，草稿仍保留。", requestId);
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = parseApiError(payload);
      if (error.ok) {
        const { code, message, requestId: id, details } = error.value.error;
        throw new ApiClientError(code, message, id, details);
      }
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "目前無法保存住宿。", requestId);
    }
    const parsed = parseStaysResponse(payload);
    if (!parsed.ok || (method !== "DELETE" && parsed.value.stays.length !== 1)
      || (method === "PATCH" && parsed.value.stays[0].id !== id)
      || (method === "DELETE" && parsed.value.stays.length !== 0)) {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId);
    }
    this.pendingKeys.delete(signature);
    return parsed.value.stays;
  }

  async getStays(): Promise<Stay[]> {
    const requestId = crypto.randomUUID();
    let response: Response;
    try {
      const fetcher = this.fetcher;
      response = await fetcher(`${this.baseUrl.replace(/\/$/, "")}/v1/stays`, {
        headers: { authorization: `Bearer ${this.token}`, "x-request-id": requestId },
      });
    } catch {
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "目前無法連線，請稍後再試。", requestId);
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = parseApiError(body);
      if (error.ok) {
        const { code, message, requestId: id, details } = error.value.error;
        throw new ApiClientError(code, message, id, details);
      }
      throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "服務暫時無法使用。", requestId);
    }
    const parsed = parseStaysResponse(body);
    if (!parsed.ok) throw new ApiClientError("EXTERNAL_SERVICE_UNAVAILABLE", "伺服器回應格式不正確。", requestId);
    return parsed.value.stays.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  }
}
