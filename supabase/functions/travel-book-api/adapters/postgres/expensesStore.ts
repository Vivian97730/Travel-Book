import { parseExpensesResponse, type ExpenseMutation, type ExpensesResponse } from "../../../../../packages/contracts/src/index.ts";

export class SupabaseExpensesStore {
  constructor(private readonly baseUrl: string, private readonly secretKey: string) {}

  async mutateExpense(tripId: string, mutation: ExpenseMutation, key: string, snapshotId: string | null) {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/rpc/mutate_trip_expense`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({
        p_trip_id: tripId, p_action: mutation.action, p_id: mutation.id, p_input: mutation.input,
        p_expected_version: mutation.expectedVersion, p_idempotency_key: key, p_rate_snapshot_id: snapshotId,
      }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof payload === "object" && payload !== null && "message" in payload ? payload.message : null;
      if (message === "VERSION_CONFLICT" || message === "RESOURCE_NOT_FOUND" || message === "VALIDATION_FAILED") {
        throw new ExpenseMutationError(message);
      }
      throw new Error("EXPENSES_STORE_UNAVAILABLE");
    }
    const parsed = parseExpensesResponse(payload);
    if (!parsed.ok) throw new Error("EXPENSES_STORE_INVALID_RESPONSE");
    return parsed.value;
  }

  async getExpenses(tripId: string): Promise<ExpensesResponse | null> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_trip_expenses`, {
      method: "POST",
      headers: { apikey: this.secretKey, "content-type": "application/json" },
      body: JSON.stringify({ p_trip_id: tripId }),
    });
    if (!response.ok) throw new Error("EXPENSES_STORE_UNAVAILABLE");
    const payload: unknown = await response.json();
    if (payload === null) return null;
    const parsed = parseExpensesResponse(payload);
    if (!parsed.ok) throw new Error("EXPENSES_STORE_INVALID_RESPONSE");
    return parsed.value;
  }
}

export class ExpenseMutationError extends Error {
  constructor(readonly code: "VERSION_CONFLICT" | "RESOURCE_NOT_FOUND" | "VALIDATION_FAILED") { super(code); }
}
