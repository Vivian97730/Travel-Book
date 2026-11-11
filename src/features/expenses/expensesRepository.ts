import type { ExpensesResponse } from "@travel-book/contracts";

export interface ExpensesRepository {
  getExpenses(): Promise<ExpensesResponse>;
}
