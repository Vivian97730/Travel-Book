import { parseExpensesResponse, type ExpensesResponse } from "../../../../../packages/contracts/src/index.ts";

export class SupabaseExpensesStore {
  constructor(private readonly baseUrl: string, private readonly secretKey: string) {}

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
