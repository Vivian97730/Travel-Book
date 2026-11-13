import { isRecord, parseSharedChecklistResponse, type SharedChecklistMutation } from "../../../../../packages/contracts/src/index.ts";

export class SharedChecklistStoreError extends Error {
  constructor(readonly code: "VERSION_CONFLICT" | "RESOURCE_NOT_FOUND" | "VALIDATION_FAILED") { super(code); }
}

export class SupabaseSharedChecklistStore {
  constructor(private readonly baseUrl: string, private readonly secretKey: string) {}

  getSharedChecklist(tripId: string) {
    return this.call("get_trip_shared_checklist", { p_trip_id: tripId });
  }

  async mutateSharedChecklist(tripId: string, mutation: SharedChecklistMutation, key: string) {
    const result = await this.call("mutate_trip_shared_checklist", {
      p_trip_id: tripId,
      p_action: mutation.action,
      p_id: mutation.action === "create" ? null : mutation.id,
      p_input: mutation.action === "delete" ? null : mutation.input,
      p_expected_version: mutation.action === "create" ? 0 : mutation.expectedVersion,
      p_idempotency_key: key,
    });
    if (!result) throw new Error("SHARED_CHECKLIST_STORE_INVALID_RESPONSE");
    return result;
  }

  private async call(rpc: string, body: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const code = isRecord(payload) ? payload.message : null;
      if (code === "VERSION_CONFLICT" || code === "RESOURCE_NOT_FOUND" || code === "VALIDATION_FAILED") {
        throw new SharedChecklistStoreError(code);
      }
      throw new Error("SHARED_CHECKLIST_STORE_UNAVAILABLE");
    }
    if (payload === null) return null;
    const parsed = parseSharedChecklistResponse(payload);
    if (!parsed.ok) throw new Error("SHARED_CHECKLIST_STORE_INVALID_RESPONSE");
    return parsed.value;
  }
}
