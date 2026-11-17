import type { ExpenseCurrency, ExpenseMutation, ExpensesResponse, ExchangeRateSnapshot, ForeignExpenseCurrency } from "@travel-book/contracts";

export type ReferenceRate = Pick<ExchangeRateSnapshot, "rate" | "sourceDate">;
export interface ExpensesRepository {
  getExpenses(): Promise<ExpensesResponse>;
  getRate(currency: ExpenseCurrency, date: string): Promise<string | null>;
  getReferenceRate(currency: ForeignExpenseCurrency, date: string): Promise<ReferenceRate | null>;
  mutateExpense(mutation: ExpenseMutation, idempotencyKey: string): Promise<ExpensesResponse>;
}
